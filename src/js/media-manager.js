/**
 * Pingo - Media Manager (Video & Screen Sharing)
 */

import { state, elements } from './state.js';
import { updateLocationStatus } from './utils.js';
import { getConnectionStats } from './peer-manager.js';

export async function startCamera() {
    if (!state.activeChatPeerId) {
        alert('Debes abrir un chat con un pingo para iniciar la cámara.');
        return;
    }
    
    try {
        const stats = await getConnectionStats(state.activeChatPeerId);
        if (stats && stats.type === 'relay') {
            alert('El uso de video está deshabilitado en conexiones de tipo TURN para ahorrar ancho de banda.');
            return;
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
            alert('El uso de pantalla compartida está deshabilitado en conexiones de tipo TURN para ahorrar ancho de banda.');
            return;
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
    
    // Add local video to UI
    addVideoElement('local-video', stream, true, `Mi ${type === 'camera' ? 'Cámara' : 'Pantalla'}`, type);
    
    // If user stops sharing from browser UI (especially for screen share)
    stream.getVideoTracks()[0].onended = () => {
        stopLocalStream();
    };

    updateLocationStatus(`Transmitiendo ${type === 'camera' ? 'Cámara' : 'Pantalla'}`, type === 'camera' ? 'fa-video' : 'fa-desktop');
    
    // Notify peers that a stream is available (origin: me, relayedBy: me)
    broadcastStreamStatus('stream-available', state.myPeerId, state.myPeerId, type);
}

function broadcastStreamStatus(statusType, origin = state.myPeerId, relayedBy = state.myPeerId, streamType = 'camera') {
    const data = { type: statusType, origin, relayedBy, streamType };
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
        container.onclick = () => {
            container.classList.toggle('enlarged');
        };
        
        // Stop button for local stream
        if (isLocal) {
            const stopBtn = document.createElement('button');
            stopBtn.innerHTML = '<i class="fas fa-times"></i>';
            stopBtn.style.position = 'absolute';
            stopBtn.style.top = '5px';
            stopBtn.style.right = '5px';
            stopBtn.style.background = 'var(--danger)';
            stopBtn.style.border = 'none';
            stopBtn.style.color = 'white';
            stopBtn.style.borderRadius = '50%';
            stopBtn.style.width = '24px';
            stopBtn.style.height = '24px';
            stopBtn.style.cursor = 'pointer';
            stopBtn.style.zIndex = '10';
            stopBtn.onclick = (e) => {
                e.stopPropagation();
                stopLocalStream();
            };
            container.appendChild(stopBtn);
        }

        const video = document.createElement('video');
        video.id = id;
        video.autoplay = true;
        video.playsInline = true;
        if (isLocal) {
            video.muted = true; // Mute local video to prevent echo
        }
        video.style.width = '100%';
        video.style.display = 'block';
        
        container.appendChild(video);
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

function removeVideoElement(id) {
    const container = document.getElementById(`${id}-container`);
    if (container) {
        container.remove();
    }
    
    if (elements.videoContainer && elements.videoContainer.children.length === 0) {
        elements.videoContainer.style.display = 'none';
    }
}
