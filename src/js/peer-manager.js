/**
 * Pingo - PeerJS Communication Management
 */

import { Peer } from 'peerjs';
import { state, elements } from './state.js';
import { PEER_CONFIG, CLOUD_CONFIG, getActivePeerConfig, getServerConfig, saveServerConfig } from './constants.js';
import { generateAuthToken, verifyAuthToken, updateLocationStatus } from './utils.js';
import { 
    updatePeerMarker, removePeerMarker, updateTrail, 
    fitMapBounds 
} from './map-manager.js';
import { getAliasForPeer } from './identity-manager.js';
import { checkRemoteGeofence } from './geofence-manager.js';
import { initPushNotifications } from '../push-notifications.js';
import { handleIncomingStream, handleStreamEnded, getAvailableStreamFor } from './media-manager.js';

// Registry for data handlers to avoid circular dependencies
const dataHandlers = {};

export function registerDataHandler(type, handler) {
    console.log(`[Peer] Registering handler for: ${type}`);
    dataHandlers[type] = handler;
}

/**
 * Dynamic import for UI functions to break circular dependencies
 */
async function getUI() {
    return await import('./ui-manager.js');
}

async function fetchTurnCredentials(myPeerId) {
    if (!state.useCloudServices) return null;
    
    try {
        const token = await generateAuthToken(state.myIdentity.salt);
        const url = `${CLOUD_CONFIG.apiEndpoint}${CLOUD_CONFIG.turnCredentialsPath}?peerId=${myPeerId}`;
        
        const response = await fetch(url, {
            headers: { 'X-Pingo-Auth': token }
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (err) {
        console.error('[Relay] Error fetching TURN credentials:', err);
    }
    return null;
}

function processURLServerConfig() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedConfig = urlParams.get('serverConfig');
        if (encodedConfig) {
            let jsonStr = '';
            try {
                // Try Base64URL decode
                const normalized = encodedConfig.replace(/-/g, '+').replace(/_/g, '/');
                jsonStr = atob(normalized);
            } catch (e) {
                // Fallback to direct URI decode
                jsonStr = decodeURIComponent(encodedConfig);
            }

            if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                const current = getServerConfig();
                if (parsed.signaling) current.signaling = { ...current.signaling, ...parsed.signaling };
                if (parsed.turn) current.turn = { ...current.turn, ...parsed.turn };
                if (parsed.cloud) current.cloud = { ...current.cloud, ...parsed.cloud };
                saveServerConfig(current);
                console.log('[Config] Imported custom server configuration from URL:', current);
            }
        }
    } catch (err) {
        console.warn('[Config] Failed to parse server config from URL query parameter:', err);
    }
}

export function initPeer(onOpen, onConnection, onError, onDisconnected) {
    processURLServerConfig();

    let randomId = localStorage.getItem('pingo_my_id');
    if (!randomId) {
        randomId = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem('pingo_my_id', randomId);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const useLocalSignaling = urlParams.get('localSignaling') === '1' ||
                              localStorage.getItem('pingo_local_signaling') === '1';

    let configToUse = getActivePeerConfig();
    if (useLocalSignaling) {
        console.log('[Peer] Overriding signaling configuration for local testing...');
        configToUse = {
            host: window.location.hostname || 'localhost',
            port: 9005,
            path: '/',
            secure: false,
            proxied: false,
            config: {
                iceServers: [] // STUN/TURN not needed for local testing
            }
        };
    }

    console.log('[Peer] Initializing Peer with configuration:', configToUse);
    state.peer = new Peer(randomId, configToUse);

    state.peer.on('open', async (id) => {
        console.log('[Peer] Signaling server connection established. My ID:', id);
        state.myPeerId = id;

        // Proactive cloud registration and TURN fetch (Non-blocking)
        if (state.useCloudServices) {
            (async () => {
                try {
                    console.log('[Cloud] Ensuring registration in background...');
                    await initPushNotifications(id, updateLocationStatus);
                    
                    const iceConfig = await fetchTurnCredentials(id);
                    if (iceConfig && state.peer && state.peer.socket) {
                        console.log('[Relay] Dynamic Cloud TURN credentials applied.');
                        const baseIce = configToUse.config.iceServers || [];
                        if (state.peer._options.config) {
                            state.peer._options.config.iceServers = [
                                ...baseIce,
                                ...iceConfig.iceServers || [iceConfig]
                            ];
                        }
                    }
                } catch (err) {
                    console.warn('[Cloud] Background initialization failed:', err);
                }
            })();
        }

        if (onOpen) onOpen(id);
    });

    state.peer.on('connection', (conn) => {
        handleIncomingConnection(conn);
        if (onConnection) onConnection(conn);
    });

    state.peer.on('call', (call) => {
        console.log(`[Peer] Incoming media call from ${call.peer}`);
        // We auto-answer the call. If we have a local stream, we can send it (two-way video), 
        // but typically the viewer answers without a stream, or with their own if they want.
        // For simplicity, we answer and optionally provide our localStream if we are sharing.
        call.answer(state.localStream || undefined);
        
        state.mediaConnections[call.peer] = call;

        call.on('stream', (remoteStream) => {
            const originId = call.metadata?.origin || call.peer;
            const streamType = call.metadata?.streamType || 'camera';
            console.log(`[Peer] Received remote stream from ${call.peer} (origin: ${originId}, type: ${streamType})`);
            handleIncomingStream(call.peer, remoteStream, originId, streamType);
        });

        call.on('close', () => {
            const originId = call.metadata?.origin || call.peer;
            handleStreamEnded(originId, call.peer);
        });

        call.on('error', (err) => {
            const originId = call.metadata?.origin || call.peer;
            console.error(`[Peer] Call error from ${call.peer}:`, err);
            handleStreamEnded(originId, call.peer);
        });
    });

    state.peer.on('error', (err) => {
        console.error('[Peer] Signaling Server Error:', err.type, '-', err.message);
        if (err.type === 'network') {
            updateLocationStatus('Error de red con el servidor', 'fa-wifi');
        } else if (err.type === 'peer-unavailable') {
            console.log('[Peer] Target peer not found (offline).');
        }
        if (onError) onError(err);
    });

    state.peer.on('disconnected', () => {
        console.warn('[Peer] Disconnected from signaling server.');
        if (onDisconnected) onDisconnected();
        // Automatic reconnection attempt with a small delay
        setTimeout(() => {
            if (state.peer && !state.peer.destroyed && state.peer.disconnected) {
                console.log('[Peer] Attempting to reconnect to signaling server...');
                state.peer.reconnect();
            }
        }, 3000);
    });
}

export function reconnectPeer(onOpen, onConnection, onError, onDisconnected) {
    console.log('[Peer] Reconnecting Peer with updated server configuration...');
    if (state.peer) {
        try {
            state.peer.destroy();
        } catch (e) {
            console.warn('[Peer] Error destroying old peer instance:', e);
        }
        state.peer = null;
    }
    return initPeer(onOpen, onConnection, onError, onDisconnected);
}

/**
 * Ensures the PeerJS signaling connection is alive.
 * Call this when the app returns to foreground.
 */
export function ensureSignalingConnection() {
    if (!state.peer) {
        console.log('[Peer] Peer not initialized, initializing...');
        initPeer();
        return;
    }

    if (state.peer.destroyed) {
        console.log('[Peer] Peer was destroyed, re-initializing...');
        initPeer();
    } else if (state.peer.disconnected) {
        console.log('[Peer] Peer disconnected, reconnecting...');
        state.peer.reconnect();
    } else {
        console.log('[Peer] Signaling connection is healthy.');
    }
}

/**
 * Re-establishes data channels with peers that were previously connected
 * or are in the agenda and should be reachable.
 */
const reconnectTimers = {};
const reconnectAttempts = {};

export function cancelReconnect(peerId) {
    const id = String(peerId);
    if (reconnectTimers[id]) {
        clearTimeout(reconnectTimers[id]);
        delete reconnectTimers[id];
    }
    delete reconnectAttempts[id];
}

export function scheduleReconnect(peerId) {
    const id = String(peerId);
    if (state.connections[id] && state.connections[id].open) {
        cancelReconnect(id);
        return;
    }
    if (reconnectTimers[id]) {
        return; // Already scheduled
    }

    const attempts = (reconnectAttempts[id] || 0) + 1;
    reconnectAttempts[id] = attempts;

    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(Math.pow(2, attempts) * 1000, 30000);
    console.log(`[Peer] Auto-reconexión programada a ${id} (#${attempts}) en ${delay / 1000}s`);

    reconnectTimers[id] = setTimeout(async () => {
        delete reconnectTimers[id];
        if (state.connections[id] && state.connections[id].open) {
            cancelReconnect(id);
            return;
        }
        console.log(`[Peer] 🔄 Reintentando conectar automáticamente con ${id}...`);
        try {
            await connectToPeer(id);
            cancelReconnect(id);
            console.log(`[Peer] ✅ Auto-reconexión exitosa con ${id}.`);
        } catch (err) {
            console.warn(`[Peer] Reintento fallido con ${id}:`, err.message);
            if (attempts < 15) {
                scheduleReconnect(id);
            }
        }
    }, delay);
}

export async function restoreActiveConnections() {
    console.log('[Peer] Restoring active connections...');
    
    // 1. Identify which peers we should try to connect to.
    for (const contact of state.agenda) {
        const id = String(contact.derivedId);
        if (!state.connections[id] || !state.connections[id].open) {
            scheduleReconnect(id);
        }
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[Network] Conexión a Internet recuperada (online). Restableciendo señalización y conexiones...');
        ensureSignalingConnection();
        setTimeout(() => restoreActiveConnections(), 1000);
    });
}

export function handleIncomingConnection(conn) {
    let authenticated = (state.myIdentity.salt === '');
    let pendingBuffer = [];
    console.log('[Peer] Incoming connection from:', conn.peer, 'Open:', conn.open);

    const authTimeout = setTimeout(() => {
        if (!authenticated) {
            console.warn('[Peer] Auth timeout from:', conn.peer);
            updateLocationStatus(`Tiempo de espera agotado: ${conn.peer}`, 'fa-hourglass-end');
            conn.close();
        }
    }, 30000);

    const onOpen = () => {
        // Prevent redundant connections
        if (state.connections[conn.peer] && state.connections[conn.peer].open && state.connections[conn.peer] !== conn) {
            console.log('[Peer] Already connected to', conn.peer, '. Closing duplicate.');
            conn.close();
            clearTimeout(authTimeout);
            return;
        }

        // Diagnostic: Monitor ICE if possible
        const pc = conn.peerConnection;
        if (pc) {
            console.log('[Peer] ICE Transport Policy:', pc.getConfiguration?.().iceTransportPolicy || 'default');
            pc.addEventListener('iceconnectionstatechange', () => {
                console.log(`[ICE] ${conn.peer} State:`, pc.iceConnectionState);
            });
        }

        console.log('[Peer] Awaiting auth from:', conn.peer);
        state.connections[conn.peer] = conn;
    };

    if (conn.open) onOpen();
    else conn.on('open', onOpen);

    conn.on('data', async (data) => {
        try {
            console.log(`[Peer] Data received from ${conn.peer}:`, data.type);
            if (data.type === 'auth') {
                const isValid = await verifyAuthToken(data.token, state.myIdentity.salt);
                console.log(`[Peer] Auth attempt from ${conn.peer}. Valid: ${isValid}`);
                if (isValid || state.myIdentity.salt === '') {
                    authenticated = true;
                    clearTimeout(authTimeout);
                    const alias = getAliasForPeer(conn.peer) || conn.peer;
                    console.log('[Peer] Authenticated incoming connection:', conn.peer);
                    updateLocationStatus(`Pingo conectado: ${alias}`, 'fa-check-circle');
                    getUI().then(ui => {
                        ui.renderAgenda();
                        ui.updateDisconnectButton();
                    });
                    // Send initial location (even if 0,0) to provide life signal
                    console.log('[Peer] Sending initial location for handshake feedback:', conn.peer);
                    conn.send({ type: 'location', lat: state.myCoords.lat, lng: state.myCoords.lng });

                    // Process any packets received before auth
                    while (pendingBuffer.length > 0) {
                        const queued = pendingBuffer.shift();
                        console.log(`[Peer] Processing buffered packet from ${conn.peer}:`, queued.type);
                        handlePeerData(conn.peer, queued);
                    }
                } else {
                    const alias = getAliasForPeer(conn.peer) || conn.peer;
                    console.error('[Peer] Auth failed from:', conn.peer);
                    updateLocationStatus(`Fallo de autoría: ${alias}`, 'fa-shield-halved');
                    conn.close();
                }
            } else if (authenticated) {
                handlePeerData(conn.peer, data);
            } else {
                console.log(`[Peer] Buffering packet from ${conn.peer} while authenticating:`, data.type);
                pendingBuffer.push(data);
            }
        } catch (err) {
            console.error(`[Peer] Error handling data from ${conn.peer}:`, err);
        }
    });

    conn.on('close', () => {
        removePeerMarker(conn.peer);
        delete state.connections[conn.peer];
        clearTimeout(authTimeout);
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });
    });

    conn.on('error', (err) => {
        console.error(`[Peer] Incoming connection error from ${conn.peer}:`, err);
        updateLocationStatus(`Error de pingo ${conn.peer}`, 'fa-triangle-exclamation');
    });
}

export function handlePeerData(peerId, data) {
    if (data.type === 'location') {
        const alias = getAliasForPeer(peerId);
        updatePeerMarker(peerId, data.lat, data.lng, alias);
        updateTrail(peerId, data.lat, data.lng, data.isRecording);
        checkRemoteGeofence(peerId, data.lat, data.lng);
    } else if (data.type === 'alert') {
        updateLocationStatus(`Alerta de Pingo ${peerId}: ${data.message}`, 'fa-bell');
        console.warn(`Alert from ${peerId}: ${data.message}`);
    } else if (data.type === 'stop') {
        cancelReconnect(peerId);
        alert('Un pingo ha dejado de compartir su ubicación.');
        removePeerMarker(peerId);
        delete state.connections[peerId];
        updateLocationStatus(`Pingo ${peerId} dejó de compartir`, 'fa-circle-stop');
    } else if (data.type === 'chat') {
        // De-duplication check for multicast/relayed messages
        if (data.msgId && state.seenMessages.has(data.msgId)) {
            console.log(`[Chat] Duplicate message ignored: ${data.msgId}`);
            return;
        }
        if (data.msgId) {
            state.seenMessages.add(data.msgId);
            if (state.seenMessages.size > 100) {
                const oldest = state.seenMessages.values().next().value;
                state.seenMessages.delete(oldest);
            }
        }
        const senderAlias = data.relayedAlias || getAliasForPeer(peerId);
        const displayName = senderAlias || (data.relayedFrom || peerId);

        getUI().then(ui => ui.appendMessage('received', data.text, displayName));
        updateLocationStatus(`Mensaje de ${displayName}`, 'fa-comment-dots');

        if (state.uiMode !== 'comm') {
            if (elements.chatBadge) elements.chatBadge.style.display = 'block';
        }

        // Relay logic
        if (!data.relayedFrom) {
            Object.keys(state.connections).forEach(id => {
                if (id !== peerId && state.connections[id].open) {
                    state.connections[id].send({
                        type: 'chat',
                        text: data.text,
                        msgId: data.msgId,
                        relayedFrom: peerId,
                        relayedAlias: senderAlias
                    });
                }
            });
        }
    } else if (data.type === 'stream-available') {
        const origin = data.origin || peerId;
        const relayedBy = data.relayedBy || peerId;
        
        console.log(`[Peer] Stream available from origin ${origin} via ${relayedBy}`);
        
        // Register in our local registry to know who has this stream
        state.streamRegistry[origin] = state.streamRegistry[origin] || [];
        if (!state.streamRegistry[origin].includes(relayedBy)) {
            state.streamRegistry[origin].push(relayedBy);
        }

        const alias = getAliasForPeer(origin) || origin;
        const relayedAlias = relayedBy !== origin ? getAliasForPeer(relayedBy) || relayedBy : null;
        
        getUI().then(ui => ui.showStreamAvailableNotification(origin, alias, relayedBy, relayedAlias));
    } else if (data.type === 'stream-request') {
        const originRequested = data.origin || state.myPeerId;
        console.log(`[Peer] Stream requested by ${peerId} for origin ${originRequested}`);
        
        const streamToSend = getAvailableStreamFor(originRequested);
        
        if (streamToSend && state.peer) {
            // Check capacity limit
            if (state.activeVideoConnectionsCount >= state.MAX_DIRECT_VIDEO_CONNECTIONS) {
                console.log(`[Peer] Capacity reached. Redirecting ${peerId} to another peer for stream ${originRequested}`);
                // Find a peer that we know is relaying this stream, other than the requester
                const possibleRelays = (state.streamRegistry[originRequested] || []).filter(p => p !== peerId && p !== state.myPeerId);
                const suggestedRelay = possibleRelays.length > 0 ? possibleRelays[0] : null;
                
                if (suggestedRelay) {
                    if (state.connections[peerId] && state.connections[peerId].open) {
                        state.connections[peerId].send({
                            type: 'stream-redirect',
                            origin: originRequested,
                            askPeer: suggestedRelay
                        });
                    }
                    return;
                } else {
                    console.log(`[Peer] No known relays for ${originRequested}. Accepting despite limit.`);
                }
            }

            console.log(`[Peer] Calling ${peerId} with stream (origin: ${originRequested})`);
            state.activeVideoConnectionsCount++;
            
            const typeToSend = (state.streamTypes && state.streamTypes[originRequested]) || 'camera';
            const call = state.peer.call(peerId, streamToSend, { metadata: { origin: originRequested, streamType: typeToSend } });
            state.mediaConnections[peerId] = call;
            
            call.on('close', () => {
                delete state.mediaConnections[peerId];
                state.activeVideoConnectionsCount = Math.max(0, state.activeVideoConnectionsCount - 1);
            });
            call.on('error', (err) => {
                console.error(`[Peer] Call error to ${peerId}:`, err);
                delete state.mediaConnections[peerId];
                state.activeVideoConnectionsCount = Math.max(0, state.activeVideoConnectionsCount - 1);
            });
        } else {
            console.warn(`[Peer] Stream requested but no stream available for origin ${originRequested}`);
        }
    } else if (data.type === 'stream-redirect') {
        console.log(`[Peer] Redirected to ask ${data.askPeer} for stream ${data.origin}`);
        if (data.askPeer && state.connections[data.askPeer] && state.connections[data.askPeer].open) {
            state.connections[data.askPeer].send({ type: 'stream-request', origin: data.origin });
            updateLocationStatus(`Redirigido a ${getAliasForPeer(data.askPeer)}...`, 'fa-random');
        } else {
            console.error(`[Peer] Cannot follow redirect to ${data.askPeer} (Not connected)`);
        }
    } else if (data.type === 'stream-ended') {
        const origin = data.origin || peerId;
        console.log(`[Peer] Stream ended from ${origin}`);
        handleStreamEnded(origin, peerId);
        if (state.streamRegistry[origin]) delete state.streamRegistry[origin];
        getUI().then(ui => ui.removeStreamAvailableNotification(origin));
    } else if (data.type === 'search-query') {
        getUI().then(ui => ui.handleIncomingSearch(peerId, data));
    } else if (data.type === 'search-result') {
        getUI().then(ui => ui.handleIncomingSearchResult(peerId, data));
    } else if (data.type === 'file-transfer') {
        console.log(`[Peer] Received file ${data.fileName} from ${peerId}`);
        const alias = getAliasForPeer(peerId) || peerId;
        
        let fileData = data.file;
        if (typeof fileData === 'object' && !(fileData instanceof ArrayBuffer) && !(fileData instanceof Uint8Array) && !(fileData instanceof Blob)) {
            try { fileData = JSON.stringify(fileData); } catch(e) {}
        }
        const blob = new Blob([fileData], { type: data.mimeType || 'application/octet-stream' });
        const fileName = data.fileName || 'shared-file.json';
        const file = new File([blob], fileName, { type: blob.type });

        const downloadFile = (b, name) => {
            const url = URL.createObjectURL(b);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        };

        updateLocationStatus(`Archivo recibido de ${alias}: ${fileName}`, 'fa-file-arrow-down');
        getUI().then(ui => ui.appendMessage('received', `📁 Archivo recibido: ${fileName}`, alias));
        if (state.uiMode !== 'comm') {
            if (elements.chatBadge) elements.chatBadge.style.display = 'block';
        }

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            setTimeout(() => {
                const confirmShare = confirm(`Has recibido "${fileName}" de ${alias}.\n\n¿Deseas compartirlo o abrirlo con otra App? (Si cancelas, se descargará)`);
                if (confirmShare) {
                    navigator.share({
                        title: 'Archivo recibido en Pingo',
                        text: `Archivo recibido de ${alias}`,
                        files: [file]
                    }).catch(err => {
                        if (err.name !== 'AbortError') {
                            console.error('Error sharing file:', err);
                            downloadFile(blob, fileName);
                        }
                    });
                } else {
                    downloadFile(blob, fileName);
                }
            }, 300);
        } else {
            downloadFile(blob, fileName);
        }
    } else if (dataHandlers[data.type]) {
        console.log(`[Peer] Calling registered handler for ${data.type}`);
        dataHandlers[data.type](peerId, data);
    } else {
        console.warn(`[Peer] No handler registered for data type: ${data.type}`);
    }
}

export async function connectToPeer(targetId) {
    if (!targetId) return null;

    // Ensure signaling connection is healthy
    ensureSignalingConnection();

    // Stringify IDs for robust comparison
    const targetIdStr = String(targetId);

    if (state.connections[targetIdStr] && state.connections[targetIdStr].open) {
        console.log('[Peer] Connection to', targetIdStr, 'is already open.');
        return state.connections[targetIdStr];
    }

    // Wait until local state.peer is ready if it's still connecting to signaling
    if (!state.peer || !state.peer.open) {
        console.log('[Peer] Waiting for local peer signaling to be open...');
        try {
            await new Promise((resolve, reject) => {
                if (state.peer && state.peer.open) { resolve(); return; }
                const timeout = setTimeout(() => reject(new Error('Servidor de señalización no responde')), 4000);
                if (!state.peer) initPeer();
                state.peer.once('open', () => { clearTimeout(timeout); resolve(); });
                state.peer.once('error', (e) => { clearTimeout(timeout); reject(e); });
            });
        } catch (e) {
            console.warn('[Peer] Peer ready wait error:', e);
        }
    }

    const contact = state.agenda.find(c => String(c.derivedId) === targetIdStr);
    const saltToUse = contact ? contact.salt : '';
    const alias = contact ? contact.alias : targetIdStr;

    console.log('Connecting to:', targetId);
    updateLocationStatus(`Conectando con ${alias}...`, 'fa-spinner fa-spin');

    const conn = state.peer.connect(targetId, { reliable: true });

    // Track as pending outgoing connection
    state.pendingConnections = state.pendingConnections || {};
    state.pendingConnections[targetIdStr] = conn;

    conn.on('open', async () => {
        delete state.pendingConnections[targetIdStr];
        // Diagnostic: Monitor ICE if possible
        const pc = conn.peerConnection;
        if (pc) {
            pc.addEventListener('iceconnectionstatechange', () => {
                console.log(`[ICE] Outgoing to ${targetId} State:`, pc.iceConnectionState);
                if (pc.iceConnectionState === 'failed') {
                    updateLocationStatus(`Conexión directa fallida con ${alias}`, 'fa-triangle-exclamation');
                    if (state.agenda.some(c => String(c.derivedId) === targetIdStr)) {
                        scheduleReconnect(targetIdStr);
                    }
                }
            });
        }

        console.log('[Peer] Connection open to:', targetId, 'Sending auth...');
        updateLocationStatus(`Pingo conectado: ${alias}`, 'fa-check-circle');
        const token = await generateAuthToken(saltToUse);
        console.log('[Peer] Generated auth token for:', targetId);
        conn.send({ type: 'auth', token: token });

        state.connections[targetIdStr] = conn;
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });

        // Send initial location (even if 0,0) to provide life signal
        console.log('[Peer] Sending initial location for handshake feedback:', targetId);
        conn.send({ type: 'location', lat: state.myCoords.lat, lng: state.myCoords.lng });
    });

    conn.on('data', (data) => {
        console.log(`[Peer] Data received from ${targetId}:`, data.type);
        handlePeerData(targetId, data);
    });

    conn.on('close', () => {
        delete state.pendingConnections[targetIdStr];
        removePeerMarker(targetId);
        delete state.connections[targetId];
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });
        if (state.agenda.some(c => String(c.derivedId) === targetIdStr)) {
            scheduleReconnect(targetIdStr);
        }
    });

    conn.on('error', async (err) => {
        delete state.pendingConnections[targetIdStr];
        console.error(`[Peer] Outgoing connection error to ${targetIdStr}:`, err);
        
        // RELAY FALLBACK: If direct connection failed and cloud is enabled
        if (state.useCloudServices && !conn.open) {
            updateLocationStatus(`Fallo directo con ${alias}. Reintentando via Relé...`, 'fa-cloud');
        } else {
            updateLocationStatus(`Error al conectar con ${alias}`, 'fa-triangle-exclamation');
        }
        
        // Cleanup if it failed to open
        if (!conn.open) {
            delete state.connections[targetIdStr];
            getUI().then(ui => ui.renderAgenda());
        }
    });

    return conn;
}

export function disconnectFromPeer(targetId) {
    const id = String(targetId);
    cancelReconnect(id);
    const conn = state.connections[id];
    if (conn) {
        conn.send({ type: 'stop' });
        setTimeout(() => conn.close(), 500);
        delete state.connections[id];
        removePeerMarker(id);
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });
        updateLocationStatus(`Pingo desconectado: ${id}`, 'fa-circle-stop');
    }
}

export function stopAllConnections() {
    console.log('[Peer] Stopping all active connections (Passive Mode)...');
    Object.keys(reconnectTimers).forEach(id => cancelReconnect(id));
    Object.keys(state.connections).forEach(id => {
        disconnectFromPeer(id);
    });
    if (state.peer) {
        state.peer.disconnect();
    }
}

export function broadcastLocation(lat, lng) {
    if (lat === 0 && lng === 0) return;
    const data = { 
        type: 'location', 
        lat, 
        lng,
        isRecording: state.isRecording 
    };
    Object.values(state.connections).forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

export function broadcastSearchQuery(queryId, searchType, queryContent, ttl = 1, originId = null, excludePeerId = null) {
    const data = {
        type: 'search-query',
        queryId,
        searchType, // 'exact' or 'semantic'
        query: queryContent,
        originId: originId || state.myPeerId,
        timestamp: Date.now(),
        ttl
    };
    Object.keys(state.connections).forEach(id => {
        if (id !== excludePeerId && state.connections[id].open) {
            state.connections[id].send(data);
        }
    });
}

/**
 * Extracts connection quality and type (Direct, STUN, TURN)
 * @param {string} peerId 
 * @returns {Promise<Object|null>}
 */
export async function getConnectionStats(peerId) {
    const conn = state.connections[peerId];
    if (!conn || !conn.peerConnection) return null;

    const pc = conn.peerConnection;
    try {
        const stats = await pc.getStats();
        let selectedPair = null;

        stats.forEach(report => {
            if (report.type === 'transport' && report.selectedCandidatePairId) {
                selectedPair = stats.get(report.selectedCandidatePairId);
            }
        });

        if (!selectedPair) {
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
                    selectedPair = report;
                }
            });
        }

        if (selectedPair && selectedPair.localCandidateId) {
            const local = stats.get(selectedPair.localCandidateId);
            const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

            return {
                type: local?.candidateType || 'unknown', // 'host', 'srflx', 'relay'
                localAddress: local?.ip || local?.address || '',
                remoteAddress: remote?.ip || remote?.address || '',
                protocol: local?.protocol || 'udp',
                bytesSent: selectedPair.bytesSent,
                bytesReceived: selectedPair.bytesReceived,
                currentRoundTripTime: selectedPair.currentRoundTripTime,
                availableOutgoingBitrate: selectedPair.availableOutgoingBitrate
            };
        }
    } catch (err) {
        console.error('[Peer] Error getting stats:', err);
    }
    return null;
}
