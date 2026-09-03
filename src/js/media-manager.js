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
        video.style.display = 'block';
        
        container.appendChild(video);
        setupVideoControls(container, video, isLocal, streamType);
        
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

function setupVideoControls(container, video, isLocal, streamType) {
    const controls = document.createElement('div');
    controls.className = 'video-floating-controls';

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
