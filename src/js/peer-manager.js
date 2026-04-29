/**
 * P2PT - PeerJS Communication Management
 */

import { Peer } from 'peerjs';
import { state, elements } from './state.js';
import { PEER_CONFIG, CLOUD_CONFIG } from './constants.js';
import { generateAuthToken } from './utils.js';
import { 
    updatePeerMarker, removePeerMarker, updateTrail, 
    fitMapBounds 
} from './map-manager.js';
import { updateLocationStatus } from './utils.js';
import { getAliasForPeer } from './identity-manager.js';
import { checkRemoteGeofence } from './geofence-manager.js';
import { initPushNotifications } from '../push-notifications.js';

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
// ... (lines 21-46 remain mostly same, but I'll replace the block to be sure)
    if (!state.useCloudServices) return null;
    
    try {
        const token = await generateAuthToken(state.myIdentity.salt);
        const url = `${CLOUD_CONFIG.apiEndpoint}${CLOUD_CONFIG.turnCredentialsPath}?peerId=${myPeerId}`;
        
        const response = await fetch(url, {
            headers: {
                'X-P2PT-Auth': token
            }
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (err) {
        console.error('[Relay] Error fetching TURN credentials:', err);
    }
    return null;
}

export function initPeer(onOpen, onConnection, onError, onDisconnected) {
    let randomId = localStorage.getItem('p2pt_my_id');
    if (!randomId) {
        randomId = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem('p2pt_my_id', randomId);
    }

    state.peer = new Peer(randomId, PEER_CONFIG);

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
                        console.log('[Relay] TURN credentials applied.');
                        if (state.peer._options.config) {
                            state.peer._options.config.iceServers = [
                                ...PEER_CONFIG.config.iceServers,
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
export async function restoreActiveConnections() {
    console.log('[Peer] Restoring active connections...');
    
    // 1. Identify which peers we should try to connect to.
    // We'll try to reconnect to everyone in the agenda who isn't currently connected.
    // In a more complex app, we might track who was 'last seen'.
    for (const contact of state.agenda) {
        const id = String(contact.derivedId);
        if (!state.connections[id] || !state.connections[id].open) {
            console.log(`[Peer] Auto-reconnecting to ${contact.alias} (${id})...`);
            connectToPeer(id).catch(err => {
                console.warn(`[Peer] Failed auto-reconnect to ${id}:`, err.message);
            });
        }
    }
}

export function handleIncomingConnection(conn) {
    let authenticated = (state.myIdentity.salt === '');
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
                const expected = await generateAuthToken(state.myIdentity.salt);
                console.log(`[Peer] Auth attempt from ${conn.peer}. Token match: ${data.token === expected}`);
                if (data.token === expected || state.myIdentity.salt === '') {
                    authenticated = true;
                    clearTimeout(authTimeout);
                    console.log('[Peer] Authenticated incoming connection:', conn.peer);
                    updateLocationStatus(`P2PT conectado: ${conn.peer}`, 'fa-check-circle');
                    getUI().then(ui => {
                        ui.renderAgenda();
                        ui.updateDisconnectButton();
                    });
                    // Send initial location (even if 0,0) to provide life signal
                    console.log('[Peer] Sending initial location for handshake feedback:', conn.peer);
                    conn.send({ type: 'location', lat: state.myCoords.lat, lng: state.myCoords.lng });
                } else {
                    console.error('[Peer] Auth failed from:', conn.peer);
                    updateLocationStatus(`Fallo de autoría: ${conn.peer}`, 'fa-shield-halved');
                    conn.close();
                }
            } else if (authenticated) {
                handlePeerData(conn.peer, data);
            } else {
                console.warn(`[Peer] Data ignored from ${conn.peer} (not authenticated):`, data.type);
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
        updateLocationStatus(`Error de P2PT ${conn.peer}`, 'fa-triangle-exclamation');
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

        if (elements.chatPanel && elements.chatPanel.classList.contains('collapsed')) {
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
    } else if (dataHandlers[data.type]) {
        console.log(`[Peer] Calling registered handler for ${data.type}`);
        dataHandlers[data.type](peerId, data);
    } else {
        console.warn(`[Peer] No handler registered for data type: ${data.type}`);
    }
}

export async function connectToPeer(targetId) {
    if (!state.peer || !targetId) return;

    // Stringify IDs for robust comparison
    const targetIdStr = String(targetId);

    if (state.connections[targetIdStr] && state.connections[targetIdStr].open) {
        console.log('[Peer] Connection to', targetIdStr, 'is already open.');
        return;
    }

    const contact = state.agenda.find(c => String(c.derivedId) === targetIdStr);
    const saltToUse = contact ? contact.salt : '';

    console.log('Connecting to:', targetId);
    const conn = state.peer.connect(targetId, { reliable: true });

    conn.on('open', async () => {
        // Diagnostic: Monitor ICE if possible
        const pc = conn.peerConnection;
        if (pc) {
            pc.addEventListener('iceconnectionstatechange', () => {
                console.log(`[ICE] Outgoing to ${targetId} State:`, pc.iceConnectionState);
            });
        }

        console.log('[Peer] Connection open to:', targetId, 'Sending auth...');
        updateLocationStatus(`Conectando con ${targetId}...`, 'fa-spinner');
        const token = await generateAuthToken(saltToUse);
        console.log('[Peer] Generated auth token for:', targetId);
        conn.send({ type: 'auth', token: token });

        state.connections[targetId] = conn;
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
        removePeerMarker(targetId);
        delete state.connections[targetId];
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });
    });

    conn.on('error', async (err) => {
        console.error(`[Peer] Outgoing connection error to ${targetIdStr}:`, err);
        
        // RELAY FALLBACK: If direct connection failed and cloud is enabled
        if (state.useCloudServices && !conn.open) {
            updateLocationStatus(`Fallo directo con ${targetIdStr}. Reintentando via Relé...`, 'fa-cloud');
        }

        updateLocationStatus(`Error al conectar con ${targetIdStr}`, 'fa-triangle-exclamation');
        
        // Cleanup if it failed to open
        if (!conn.open) {
            delete state.connections[targetIdStr];
            getUI().then(ui => ui.renderAgenda());
        }
    });

    return conn;
}

export function disconnectFromPeer(targetId) {
    const conn = state.connections[targetId];
    if (conn) {
        conn.send({ type: 'stop' });
        setTimeout(() => conn.close(), 500);
        delete state.connections[targetId];
        removePeerMarker(targetId);
        getUI().then(ui => {
            ui.renderAgenda();
            ui.updateDisconnectButton();
        });
        updateLocationStatus(`Pingo desconectado: ${targetId}`, 'fa-circle-stop');
    }
}

export function stopAllConnections() {
    console.log('[Peer] Stopping all active connections (Passive Mode)...');
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

        if (selectedPair) {
            const local = stats.get(selectedPair.localCandidateId);
            const remote = stats.get(selectedPair.remoteCandidateId);

            return {
                type: local.candidateType, // 'host', 'srflx', 'relay'
                localAddress: local.ip || local.address,
                remoteAddress: remote.ip || remote.address,
                protocol: local.protocol,
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
