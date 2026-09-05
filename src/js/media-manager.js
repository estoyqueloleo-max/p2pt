/**
 * Pingo - Media Manager (Video & Screen Sharing)
 */

import { state, elements } from './state.js';
import { updateLocationStatus } from './utils.js';
import { getConnectionStats } from './peer-manager.js';
import { isTurnAllowedForMedia, isBroadcastRelayAvailable, getServerConfig } from './constants.js';

export async function publishStreamToWHIP(stream, streamId) {
    const config = getServerConfig();
    const whipBase = config.broadcast && config.broadcast.whipUrl;
    if (!whipBase) return null;
    
    const whipEndpoint = `${whipBase.replace(/\/+$/, '')}/${encodeURIComponent(streamId)}`;
    console.log(`[WHIP] Iniciando publicación hacia ${whipEndpoint}`);
    
    const pc = new RTCPeerConnection(config.turn && config.turn.urls && config.turn.urls.length > 0 ? {
        iceServers: [{ urls: config.turn.urls, username: config.turn.username, credential: config.turn.credential }]
    } : {});
    
    stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
    });
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
        } else {
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            setTimeout(resolve, 1500);
        }
    });
    
    const resp = await fetch(whipEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp
    });
    
    if (!resp.ok) {
        throw new Error(`Servidor WHIP respondió con estado ${resp.status}`);
    }
    
    const answerSDP = await resp.text();
    await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSDP
    });
    
    state.activeWhipSession = {
        streamId,
        pc,
        whipEndpoint
    };
    
    console.log(`[WHIP] Publicación completada con éxito para stream ${streamId}`);
    return whipEndpoint;
}

export async function subscribeStreamViaWHEP(streamId, whepBase, originId, streamType = 'camera') {
    const config = getServerConfig();
    const whepEndpoint = `${whepBase.replace(/\/+$/, '')}/${encodeURIComponent(streamId)}`;
    console.log(`[WHEP] Suscribiéndose a stream ${streamId} en ${whepEndpoint}`);
    
    const pc = new RTCPeerConnection(config.turn && config.turn.urls && config.turn.urls.length > 0 ? {
        iceServers: [{ urls: config.turn.urls, username: config.turn.username, credential: config.turn.credential }]
    } : {});
    
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
        console.log(`[WHEP] Track recibido: ${event.track.kind}`);
        remoteStream.addTrack(event.track);
        handleIncomingStream('server-relay', remoteStream, originId, streamType);
    };
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') {
            resolve();
        } else {
            const check = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', check);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', check);
            setTimeout(resolve, 1500);
        }
    });
    
    const resp = await fetch(whepEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp
    });
    
    if (!resp.ok) {
        throw new Error(`Suscripción WHEP falló con estado ${resp.status}`);
    }
    
    const resourceLocation = resp.headers.get('Location');
    const answerSDP = await resp.text();
    await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSDP
    });
    
    state.whepSubscriptions[originId] = {
        pc,
        resourceLocation: resourceLocation ? new URL(resourceLocation, whepEndpoint).href : whepEndpoint,
        stream: remoteStream
    };
    
    console.log(`[WHEP] Suscripción WHEP establecida para stream ${streamId}`);
    return remoteStream;
}

export async function startAudioCall() {
    if (!state.activeChatPeerId) {
        alert('Debes abrir un chat con un pingo para iniciar la llamada de voz.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }, 
            video: false 
        });
        handleLocalStream(stream, 'audio');
    } catch (err) {
        console.error('[Media] Error accessing microphone:', err);
        updateLocationStatus('Error al acceder al micrófono', 'fa-microphone-slash');
        alert('No se pudo acceder al micrófono. Revisa los permisos.');
    }
}

export async function startCamera() {
    if (!state.activeChatPeerId) {
        alert('Debes abrir un chat con un pingo para iniciar la cámara.');
        return;
    }
    
    try {
        const stats = await getConnectionStats(state.activeChatPeerId);
        if (stats && stats.type === 'relay') {
            if (!isTurnAllowedForMedia()) {
                alert('El uso de video está deshabilitado en conexiones de tipo TURN público para ahorrar ancho de banda. Vincula un Servidor Amigo para habilitar TURN.');
                return;
            } else {
                console.log('[Media] Conexión TURN autorizada para video por Servidor Amigo.');
            }
        }
    } catch (e) {
        console.error('Error checking connection stats:', e);
    }

    try {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' }, 
                audio: true 
            });
        } catch (audioErr) {
            console.warn('[Media] Audio not available, falling back to video-only:', audioErr);
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
        }
        handleLocalStream(stream, 'camera');
    } catch (err) {
        console.error('[Media] Error accessing camera:', err);
        updateLocationStatus('Error al acceder a la cámara', 'fa-video-slash');
        alert('No se pudo acceder a la cámara. Revisa los permisos.');
    }
}

export async function startScreenShare() {
    if (!state.activeChatPeerId) {
        alert('Debes abrir un chat con un pingo para compartir pantalla.');
        return;
    }
    
    try {
        const stats = await getConnectionStats(state.activeChatPeerId);
        if (stats && stats.type === 'relay') {
            if (!isTurnAllowedForMedia()) {
                alert('El uso de pantalla compartida está deshabilitado en conexiones de tipo TURN público para ahorrar ancho de banda. Vincula un Servidor Amigo para habilitar TURN.');
                return;
            } else {
                console.log('[Media] Conexión TURN autorizada para pantalla compartida por Servidor Amigo.');
            }
        }
    } catch (e) {
        console.error('Error checking connection stats:', e);
    }

    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            throw new Error('La compartición de pantalla no está soportada en este navegador o dispositivo móvil.');
        }
        
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: true, 
            audio: true 
        });
        handleLocalStream(stream, 'screen');
    } catch (err) {
        console.error('[Media] Error accessing screen share:', err);
        updateLocationStatus('Error al compartir pantalla', 'fa-desktop');
        alert(`No se pudo compartir la pantalla: ${err.message}`);
    }
}

export function stopLocalStream() {
    if (state.activeWhipSession) {
        try {
            state.activeWhipSession.pc.close();
            fetch(state.activeWhipSession.whipEndpoint, { method: 'DELETE' }).catch(() => {});
        } catch (e) {
            console.warn('[WHIP] Error cerrando sesión WHIP:', e);
        }
        state.activeWhipSession = null;
    }

    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
        if (state.streamTypes) delete state.streamTypes[state.myPeerId];
        removeVideoElement('local-video');
        
        // Hide container if empty
        if (elements.videoContainer && elements.videoContainer.children.length === 0) {
            elements.videoContainer.style.display = 'none';
        }

        updateLocationStatus('Transmisión detenida', 'fa-stop');
        
        // Notify peers that the stream ended
        broadcastStreamStatus('stream-ended');
    }
}

function handleLocalStream(stream, type) {
    // Stop any existing stream
    if (state.localStream) {
        stopLocalStream();
    }

    state.localStream = stream;
    if (state.streamTypes) state.streamTypes[state.myPeerId] = type;
    
    // Add local video/audio to UI
    const defaultLabel = type === 'audio' ? 'Mi Micrófono' : `Mi ${type === 'camera' ? 'Cámara' : 'Pantalla'}`;
    addVideoElement('local-video', stream, true, defaultLabel, type);
    
    // If user stops sharing from browser UI
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
        videoTracks[0].onended = () => {
            stopLocalStream();
        };
    } else {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioTracks[0].onended = () => {
                stopLocalStream();
            };
        }
    }

    const iconType = type === 'audio' ? 'fa-microphone' : (type === 'camera' ? 'fa-video' : 'fa-desktop');
    const labelStatus = type === 'audio' ? 'Llamada de Voz (Audio)' : (type === 'camera' ? 'Cámara' : 'Pantalla');
    
    // Transparent Broadcast logic: WHIP on Servidor Amigo vs P2P Direct
    if (isBroadcastRelayAvailable() && type !== 'audio') {
        const streamId = `${state.myPeerId}-${Date.now()}`;
        updateLocationStatus(`Publicando en Servidor Amigo...`, 'fa-tower-broadcast');
        publishStreamToWHIP(stream, streamId).then(() => {
            const config = getServerConfig();
            updateLocationStatus(`Transmitiendo ${labelStatus} (vía Servidor Amigo)`, 'fa-tower-broadcast');
            broadcastStreamStatus('stream-available', state.myPeerId, state.myPeerId, type, {
                mode: 'server-relay',
                streamId: streamId,
                whepUrl: config.broadcast.whepUrl
            });
            const localBadge = document.querySelector('#local-video-container .video-conn-badge');
            if (localBadge) {
                localBadge.innerHTML = '<span class="badge-conn-tag relay" title="Emitiendo vía Servidor Amigo (Broadcast Relay)"><i class="fas fa-tower-broadcast"></i> Servidor Amigo</span>';
            }
        }).catch(err => {
            console.warn('[Media] Fallo al publicar en WHIP, fallback a P2P directo:', err);
            updateLocationStatus(`Transmitiendo ${labelStatus}`, iconType);
            broadcastStreamStatus('stream-available', state.myPeerId, state.myPeerId, type, { mode: 'p2p' });
        });
    } else {
        updateLocationStatus(`Transmitiendo ${labelStatus}`, iconType);
        broadcastStreamStatus('stream-available', state.myPeerId, state.myPeerId, type, { mode: 'p2p' });
    }
}

function broadcastStreamStatus(statusType, origin = state.myPeerId, relayedBy = state.myPeerId, streamType = 'camera', extra = {}) {
    const data = { type: statusType, origin, relayedBy, streamType, ...extra };
    Object.values(state.connections).forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
}

export function handleIncomingStream(peerId, stream, originId = peerId, streamType = 'camera') {
    console.log(`[Media] Received incoming stream from ${peerId} (origin: ${originId}, type: ${streamType})`);
    
    // Save to relayedStreams so we can relay it to others
    state.relayedStreams[originId] = stream;
    if (state.streamTypes) state.streamTypes[originId] = streamType;
    
    const labelText = originId === peerId ? `Pingo: ${peerId}` : `Pingo: ${originId} (vía ${peerId})`;
    addVideoElement(`remote-video-${originId}`, stream, false, labelText, streamType);
    
    // Broadcast to others that we are now relaying this stream
    broadcastStreamStatus('stream-available', originId, state.myPeerId, streamType);
    
    stream.oninactive = () => {
        handleStreamEnded(originId, peerId);
    };
}

export function handleStreamEnded(originId, peerId = originId) {
    console.log(`[Media] Stream ended for ${originId}`);
    if (state.whepSubscriptions && state.whepSubscriptions[originId]) {
        try {
            state.whepSubscriptions[originId].pc.close();
            if (state.whepSubscriptions[originId].resourceLocation) {
                fetch(state.whepSubscriptions[originId].resourceLocation, { method: 'DELETE' }).catch(() => {});
            }
        } catch (e) {}
        delete state.whepSubscriptions[originId];
    }

    removeVideoElement(`remote-video-${originId}`);
    
    if (state.relayedStreams[originId]) {
        delete state.relayedStreams[originId];
        broadcastStreamStatus('stream-ended', originId, state.myPeerId);
    }
    
    if (state.mediaConnections[peerId]) {
        state.mediaConnections[peerId].close();
        delete state.mediaConnections[peerId];
    }
}

export function getAvailableStreamFor(originId) {
    if (originId === state.myPeerId) return state.localStream;
    return state.relayedStreams[originId];
}

function addVideoElement(id, stream, isLocal = false, labelText = '', streamType = 'camera') {
    if (!elements.videoContainer) return;
    
    elements.videoContainer.style.display = 'flex';
    
    let container = document.getElementById(`${id}-container`);
    if (!container) {
        container = document.createElement('div');
        container.id = `${id}-container`;
        container.className = 'video-wrapper';
        
        if (streamType === 'screen') {
            container.classList.add('screen-share-view');
        } else if (streamType === 'audio') {
            container.classList.add('audio-call-view');
            const audioCard = document.createElement('div');
            audioCard.className = 'audio-call-card';
            audioCard.innerHTML = `
                <div class="audio-pulse-avatar">
                    <i class="fas fa-microphone"></i>
                </div>
                <div style="font-weight:600; font-size:0.95rem; color:#fff; margin-bottom:4px;">${labelText || 'Llamada de Voz P2P'}</div>
                <div style="font-size:0.75rem; color:#94a3b8;"><i class="fas fa-signal"></i> Códec Opus (~20 kbps)</div>
            `;
            container.appendChild(audioCard);
        } else {
            container.classList.add('camera-view');
        }
        
        const label = document.createElement('div');
        label.className = 'video-label';
        label.innerText = labelText;
        label.style.position = 'absolute';
        label.style.bottom = '5px';
        label.style.left = '5px';
        label.style.backgroundColor = 'rgba(0,0,0,0.6)';
        label.style.color = '#fff';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '4px';
        label.style.fontSize = '0.7rem';
        label.style.zIndex = '10';
        container.appendChild(label);

        // Click to enlarge/shrink
        container.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('.video-floating-controls')) return;
            container.classList.toggle('enlarged');
        };

        const video = document.createElement('video');
        video.id = id;
        video.autoplay = true;
        video.playsInline = true;
        if (isLocal) {
            video.muted = true; // Mute local video to prevent echo
        }
        video.style.width = '100%';
        if (streamType === 'audio') {
            video.style.display = 'none';
        } else {
            video.style.display = 'block';
        }
        
        container.appendChild(video);
        setupVideoControls(container, video, isLocal, streamType, id);
        
        if (streamType === 'screen') {
            setupTouchZoomAndPan(container, video);
        }

        elements.videoContainer.appendChild(container);
    }
    
    const videoEl = document.getElementById(id);
    if (videoEl) {
        if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
        }
        videoEl.play().catch(e => console.warn('[Media] Video play interrupted/pending:', e));
    }
}

function setupVideoControls(container, video, isLocal, streamType, elementId = '') {
    const controls = document.createElement('div');
    controls.className = 'video-floating-controls';

    // Live Connection Type Badge
    const connBadge = document.createElement('div');
    connBadge.className = 'video-conn-badge';
    container.appendChild(connBadge);

    async function updateConnBadge() {
        if (!document.getElementById(container.id)) return;
        if (isLocal) {
            if (state.activeWhipSession) {
                connBadge.innerHTML = '<span class="badge-conn-tag relay" title="Emitiendo vía Servidor Amigo (Broadcast Relay)"><i class="fas fa-tower-broadcast"></i> Servidor Amigo</span>';
            } else {
                connBadge.innerHTML = '<span class="badge-conn-tag local"><i class="fas fa-circle" style="font-size:0.5rem; color:#4ade80;"></i> Local</span>';
            }
            return;
        }
        const targetId = elementId.replace('remote-video-', '');
        if (state.whepSubscriptions && state.whepSubscriptions[targetId]) {
            connBadge.innerHTML = '<span class="badge-conn-tag relay" title="Recibiendo vía Servidor Amigo (Broadcast WHEP)"><i class="fas fa-tower-broadcast"></i> Servidor Amigo</span>';
            return;
        }
        try {
            const stats = await getConnectionStats(targetId);
            if (!stats) {
                connBadge.innerHTML = '<span class="badge-conn-tag direct"><i class="fas fa-bolt"></i> P2P</span>';
                return;
            }
            const isRelay = stats.type === 'relay';
            const isIpv6 = stats.remoteAddress && stats.remoteAddress.includes(':');
            const rtt = stats.currentRoundTripTime ? ` ${Math.round(stats.currentRoundTripTime * 1000)}ms` : '';
            
            if (isRelay) {
                connBadge.innerHTML = `<span class="badge-conn-tag relay" title="Retransmitido por servidor TURN"><i class="fas fa-tower-broadcast"></i> Relay TURN${rtt}</span>`;
            } else {
                const addrLabel = isIpv6 ? 'IPv6' : 'Directo';
                connBadge.innerHTML = `<span class="badge-conn-tag direct" title="Conexión directa P2P (0 consumo de relé)"><i class="fas fa-bolt"></i> P2P ${addrLabel}${rtt}</span>`;
            }
        } catch (e) {
            connBadge.innerHTML = '<span class="badge-conn-tag direct"><i class="fas fa-bolt"></i> P2P</span>';
        }
    }
    updateConnBadge();
    const badgeTimer = setInterval(updateConnBadge, 4000);

    // Screen Share FPS / Quality Mode Toggle (reading 10fps vs fluid 30fps)
    if (isLocal && streamType === 'screen') {
        const fpsBtn = document.createElement('button');
        fpsBtn.className = 'video-ctrl-btn';
        let isReadingMode = false;
        fpsBtn.innerHTML = '<span style="font-size:0.7rem; font-weight:700;">30fps</span>';
        fpsBtn.title = 'Alternar calidad: 30fps (Fluido) vs 10fps (Modo lectura/ahorro 5G)';
        fpsBtn.onclick = async (e) => {
            e.stopPropagation();
            const track = state.localStream ? state.localStream.getVideoTracks()[0] : null;
            if (track) {
                isReadingMode = !isReadingMode;
                try {
                    await track.applyConstraints({
                        frameRate: isReadingMode ? { ideal: 10, max: 10 } : { ideal: 30, max: 30 }
                    });
                    fpsBtn.innerHTML = isReadingMode 
                        ? '<span style="font-size:0.7rem; font-weight:700; color:#4ade80;">10fps</span>' 
                        : '<span style="font-size:0.7rem; font-weight:700;">30fps</span>';
                    fpsBtn.title = isReadingMode ? 'Modo lectura activo (10 fps, ahorro 5G)' : 'Modo fluido (30 fps)';
                    updateLocationStatus(isReadingMode ? 'Pantalla a 10 FPS (Modo lectura)' : 'Pantalla a 30 FPS (Fluido)', 'fa-desktop');
                } catch (err) {
                    console.warn('[Media] applyConstraints error:', err);
                }
            }
        };
        controls.appendChild(fpsBtn);
    }

    // Fullscreen / Landscape toggle
    const fsBtn = document.createElement('button');
    fsBtn.className = 'video-ctrl-btn';
    fsBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fsBtn.title = 'Pantalla completa';
    fsBtn.onclick = (e) => {
        e.stopPropagation();
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    };
    controls.appendChild(fsBtn);

    // Picture-in-Picture / Floating Mode
    const pipBtn = document.createElement('button');
    pipBtn.className = 'video-ctrl-btn';
    pipBtn.innerHTML = '<i class="fas fa-window-restore"></i>';
    pipBtn.title = 'Modo ventana flotante (PiP)';
    pipBtn.onclick = async (e) => {
        e.stopPropagation();
        if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
            try {
                if (document.pictureInPictureElement === video) {
                    await document.exitPictureInPicture();
                    return;
                } else {
                    await video.requestPictureInPicture();
                    return;
                }
            } catch (err) {
                console.warn('[PiP] Fallback a PiP CSS:', err);
            }
        }
        container.classList.toggle('pip-floating');
    };
    controls.appendChild(pipBtn);

    // Audio Mute/Unmute
    if (isLocal && state.localStream && state.localStream.getAudioTracks().length > 0) {
        const audioBtn = document.createElement('button');
        audioBtn.className = 'video-ctrl-btn';
        audioBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        audioBtn.title = 'Silenciar / Activar Micro';
        audioBtn.onclick = (e) => {
            e.stopPropagation();
            const tracks = state.localStream.getAudioTracks();
            if (tracks.length > 0) {
                const newState = !tracks[0].enabled;
                tracks.forEach(t => t.enabled = newState);
                audioBtn.innerHTML = newState ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash" style="color:var(--danger)"></i>';
                audioBtn.classList.toggle('muted', !newState);
            }
        };
        controls.appendChild(audioBtn);
    }

    // End call / Stop stream
    if (isLocal) {
        const endBtn = document.createElement('button');
        endBtn.className = 'video-ctrl-btn video-ctrl-danger';
        endBtn.innerHTML = '<i class="fas fa-phone-slash"></i>';
        endBtn.title = 'Finalizar transmisión';
        endBtn.onclick = (e) => {
            e.stopPropagation();
            stopLocalStream();
        };
        controls.appendChild(endBtn);
    }

    container.appendChild(controls);
}

function setupTouchZoomAndPan(container, video) {
    let scale = 1;
    let startScale = 1;
    let startDist = 0;
    let posX = 0, posY = 0;
    let startX = 0, startY = 0;
    let lastTap = 0;
    let isPanning = false;

    video.style.transformOrigin = 'center center';
    video.style.willChange = 'transform';

    function updateTransform() {
        video.style.transform = `scale(${scale}) translate(${posX / scale}px, ${posY / scale}px)`;
        if (zoomBadge) {
            if (scale > 1.05) {
                zoomBadge.style.display = 'inline-flex';
                zoomBadge.innerHTML = `<i class="fas fa-search-plus"></i> ${scale.toFixed(1)}x`;
            } else {
                zoomBadge.style.display = 'none';
            }
        }
    }

    // Zoom badge / Reset
    const zoomBadge = document.createElement('button');
    zoomBadge.className = 'video-zoom-badge';
    zoomBadge.title = 'Toca para restablecer zoom (1x)';
    zoomBadge.style.display = 'none';
    zoomBadge.onclick = (e) => {
        e.stopPropagation();
        scale = 1;
        posX = 0;
        posY = 0;
        video.style.transition = 'transform 0.2s ease-out';
        updateTransform();
        setTimeout(() => { video.style.transition = 'none'; }, 200);
    };
    container.appendChild(zoomBadge);

    container.addEventListener('touchstart', (e) => {
        video.style.transition = 'none';
        if (e.touches.length === 2) {
            startDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            startScale = scale;
        } else if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastTap < 300) {
                // Double tap toggle
                e.preventDefault();
                video.style.transition = 'transform 0.25s ease-out';
                scale = scale > 1.2 ? 1 : 2.5;
                posX = 0;
                posY = 0;
                updateTransform();
                setTimeout(() => { video.style.transition = 'none'; }, 250);
                lastTap = 0;
                return;
            }
            lastTap = now;

            if (scale > 1.05) {
                isPanning = true;
                startX = e.touches[0].clientX - posX;
                startY = e.touches[0].clientY - posY;
            }
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (startDist > 0) {
                scale = Math.min(Math.max(1, startScale * (dist / startDist)), 4.5);
                if (scale === 1) {
                    posX = 0;
                    posY = 0;
                }
                updateTransform();
            }
        } else if (e.touches.length === 1 && isPanning && scale > 1.05) {
            e.preventDefault();
            const maxPan = (scale - 1) * (container.clientWidth / 2);
            posX = Math.min(Math.max(e.touches[0].clientX - startX, -maxPan), maxPan);
            posY = Math.min(Math.max(e.touches[0].clientY - startY, -maxPan), maxPan);
            updateTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            startDist = 0;
        }
        if (e.touches.length === 0) {
            isPanning = false;
        }
    });

    container.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey || container.classList.contains('enlarged')) {
            e.preventDefault();
            video.style.transition = 'transform 0.1s ease-out';
            const delta = -Math.sign(e.deltaY) * 0.25;
            scale = Math.min(Math.max(1, scale + delta), 4.5);
            if (scale === 1) {
                posX = 0;
                posY = 0;
            }
            updateTransform();
        }
    }, { passive: false });
}

function removeVideoElement(id) {
    const container = document.getElementById(`${id}-container`);
    if (container) {
        container.remove();
    }
    
    if (elements.videoContainer && elements.videoContainer.children.length === 0) {
        elements.videoContainer.style.display = 'none';
    }
}
