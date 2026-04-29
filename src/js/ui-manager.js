/**
 * Pingo - UI Management
 */

import { state, elements } from './state.js';
import { VERSION, REFRESH_RATE_FG } from './constants.js';
import { updateTrail, fitMapBounds, updateGeofenceCircle } from './map-manager.js';
import { 
    ensureSignalingConnection, restoreActiveConnections, broadcastLocation, 
    connectToPeer, disconnectFromPeer, getConnectionStats 
} from './peer-manager.js';
import { saveIdentity, saveAgenda, getAliasForPeer } from './identity-manager.js';
import { saveGeofenceState, loadGeofenceState } from './geofence-manager.js';
import { derivePeerId, getPeerColor, updateLocationStatus } from './utils.js';
import { initPushNotifications, sendPushPing } from '../push-notifications.js';
import { startRecording, stopRecording, saveRoute } from './route-manager.js';
import { pushToRemote, pullFromRemote, loadRoutesFromGit, commitLinkFile, readRawFile, deleteGitRepo } from './git-manager.js';
import { renderRoute, clearRoute } from './map-manager.js';
import { shareRouteP2P } from './sync-manager.js';
import { vectorManager } from './vector-manager.js';
import { marked } from 'marked';
import README from '../../README.md?raw';

export function syncVersions() {
    const v = VERSION.toString();
    // Update UI Header
    if (elements.appVersionHeader) {
        elements.appVersionHeader.innerText = 'v' + v;
    }
    // Note: Manual asset query string updates removed. Vite handles this via hashing.
}

export function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const pingoId = params.get('pingo');
    const remoteLat = params.get('glat');
    const remoteLng = params.get('glng');
    const remoteRad = params.get('grad');

    if (pingoId) {
        localStorage.setItem('pingo_remote_id', pingoId);
        updateLocationStatus(`Conectando con Pingo ${pingoId}...`, 'fa-link');
        setTimeout(() => {
            connectToPeer(pingoId);
            // Si el link trae chat=1, abrir el chat automáticamente
            if (params.get('chat') === '1') {
                setTimeout(() => openChatFor(pingoId), 1000);
            }
        }, 2000);
    }

    if (remoteRad) {
        state.geofenceEnabled = true;
        state.geofenceRadius = parseInt(remoteRad);
        if (remoteLat && remoteLng) {
            state.geofenceCenter = [parseFloat(remoteLat), parseFloat(remoteLng)];
            state.autoCenterGeofence = false;
        } else {
            state.autoCenterGeofence = true;
        }

        if (elements.remoteBadge) elements.remoteBadge.style.display = 'inline-block';
        updateGeofenceCircle();
        saveGeofenceState();
    }
}

export function renderAgenda() {
    if (!elements.agendaContainer) return;
    
    elements.agendaContainer.innerHTML = '';
    
    if (state.agenda.length === 0) {
        if (elements.emptyAgendaHint) {
            elements.emptyAgendaHint.style.display = 'block';
            elements.agendaContainer.appendChild(elements.emptyAgendaHint);
        }
        return;
    }

    if (elements.emptyAgendaHint) elements.emptyAgendaHint.style.display = 'none';
    
    state.agenda.forEach((contact, index) => {
        const id = String(contact.derivedId);
        const isConnected = !!state.connections[id];
        console.log(`[UI] Check Contact: ${contact.alias} | ID: ${id} | Online: ${isConnected}`);
        
        const statusClass = isConnected ? 'online' : '';
        const geofenceIcon = contact.geofenceEnabled ? 'fa-circle-dot' : 'fa-circle';

        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="contact-info">
                <div class="contact-main">
                    <span class="contact-status-dot ${statusClass}" style="border-color: ${getPeerColor(id)}"></span>
                    <span class="contact-name">${contact.alias}</span>
                </div>
                <span class="contact-id-hint">ID: ${contact.derivedId}</span>
            </div>
            <div class="contact-actions">
                <button class="btn btn-outline btn-sm open-chat" data-id="${contact.derivedId}" title="Abrir Chat">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="btn btn-outline btn-sm send-ping" data-id="${contact.derivedId}" title="Enviar Ping">
                    <i class="fas fa-bell"></i>
                </button>
                ${isConnected ? `
                <button class="btn btn-primary btn-sm share-quick-route" data-id="${contact.derivedId}" title="Enviar última ruta">
                    <i class="fas fa-folder-plus"></i>
                </button>
                ` : ''}
                <button class="btn btn-outline btn-sm toggle-contact-geofence" data-index="${index}" title="Geovalla local">
                    <i class="fas ${geofenceIcon}"></i>
                </button>
                <button class="btn ${isConnected ? 'btn-success' : 'btn-primary'} btn-sm connect-contact" data-id="${contact.derivedId}" title="${isConnected ? 'Desconectar' : 'Conectar'}">
                    <i class="fas ${isConnected ? 'fa-link-slash' : 'fa-location-arrow'}"></i>
                </button>
                <button class="btn btn-danger btn-sm remove-contact" data-index="${index}" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        elements.agendaContainer.appendChild(card);
    });

    // Event listeners for dynamic elements
    elements.agendaContainer.querySelectorAll('.connect-contact').forEach(btn => {
        btn.addEventListener('click', () => {
            const peerId = btn.dataset.id;
            if (state.connections[peerId]) {
                disconnectFromPeer(peerId);
            } else {
                connectToPeer(peerId);
            }
        });
    });
    elements.agendaContainer.querySelectorAll('.contact-status-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
            const card = e.target.closest('.contact-card');
            const btn = card.querySelector('.connect-contact');
            if (btn && btn.dataset.id) {
                showConnectionStats(btn.dataset.id);
            }
        });
    });
    elements.agendaContainer.querySelectorAll('.open-chat').forEach(btn => {
        btn.addEventListener('click', () => openChatFor(btn.dataset.id));
    });
    elements.agendaContainer.querySelectorAll('.toggle-contact-geofence').forEach(btn => {
        btn.addEventListener('click', () => toggleContactGeofence(btn.dataset.index));
    });
    elements.agendaContainer.querySelectorAll('.share-quick-route').forEach(btn => {
        btn.addEventListener('click', () => {
            const peerId = btn.dataset.id;
            if (state.routes.length === 0) {
                alert('No tienes rutas guardadas para compartir.');
                return;
            }
            const lastRoute = state.routes[state.routes.length - 1];
            showConfirmModal('Compartir Ruta', `¿Compartir tu última ruta "${lastRoute.name}" con ${getAliasForPeer(peerId)}?`).then(confirmImport => {
                if (confirmImport) {
                    shareRouteP2P(lastRoute.id, peerId);
                }
            });
        });
    });
    elements.agendaContainer.querySelectorAll('.remove-contact').forEach(btn => {
        btn.addEventListener('click', () => {
            showConfirmModal('Eliminar Contacto', '¿Estás seguro de que quieres eliminar este contacto de tu agenda?').then(ok => {
                if (ok) {
                    state.agenda.splice(btn.dataset.index, 1);
                    saveAgenda();
                    renderAgenda();
                }
            });
        });
    });
}

/**
 * Toggle between 'standard' and 'cartography' modes
 */
export function setUIMode(mode) {
    state.uiMode = mode;
    console.log(`[UI] Mode changed to: ${mode}`);

    // Update Buttons
    if (elements.modeStandardBtn) elements.modeStandardBtn.classList.toggle('active', mode === 'standard');
    if (elements.modeCartographyBtn) elements.modeCartographyBtn.classList.toggle('active', mode === 'cartography');

    // Update Panels
    if (elements.connectionPanel) elements.connectionPanel.style.display = mode === 'standard' ? 'block' : 'none';
    if (elements.routesPanel) elements.routesPanel.style.display = mode === 'cartography' ? 'block' : 'none';

    if (mode === 'cartography') {
        renderRoutes();
        updateLocationStatus('Modo Cartografía activo', 'fa-map-marked-alt');
    } else {
        updateLocationStatus('Modo Localización activo', 'fa-location-arrow');
    }

    // Refresh map size due to panel changes
    setTimeout(() => {
        if (state.map) state.map.invalidateSize();
    }, 400);
}

/**
 * Render the list of routes from Git
 */
export function renderRoutes() {
    if (!elements.routesContainer) return;
    elements.routesContainer.innerHTML = '';

    if (state.routes.length === 0) {
        elements.routesContainer.innerHTML = '<p class="small-hint" style="text-align: center; padding: 20px;">No hay rutas en tu repositorio Git.</p>';
        return;
    }

    state.routes.forEach(item => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const isLink = item.type === 'link';
        const isNote = item.type === 'note';
        const pts = item.stats?.points || 0;
        
        let icon = 'fas fa-location-dot';
        let color = 'inherit';
        let actionTitle = 'Ver en mapa';
        let actionIcon = 'fa-eye';
        let actionBtnClass = 'btn-primary';

        if (isLink) {
            icon = 'fab fa-youtube';
            color = '#ff0000';
            actionTitle = 'Abrir Link';
            actionIcon = 'fa-external-link-alt';
            actionBtnClass = 'btn-success';
        } else if (isNote) {
            icon = 'fas fa-sticky-note';
            color = '#f59e0b'; // Amber
            actionTitle = 'Ver Nota';
            actionIcon = 'fa-file-lines';
            actionBtnClass = 'btn-warning';
        }
        
        const card = document.createElement('div');
        card.className = 'contact-card route-card';
        card.innerHTML = `
            <div class="contact-info">
                <span class="contact-name"><i class="${icon}" style="color: ${color}; margin-right: 5px;"></i> ${item.name}</span>
                <div class="route-meta">
                    <span><i class="far fa-calendar"></i> ${date}</span>
                    ${item.type === 'route' ? `<span><i class="fas fa-location-dot"></i> ${pts} pts</span>` : ''}
                    ${isLink ? '<span><i class="fas fa-link"></i> YouTube</span>' : ''}
                    ${isNote ? '<span><i class="fas fa-comment-dots"></i> Nota</span>' : ''}
                    ${item.forkedFrom ? `<span><i class="fas fa-code-fork"></i> de ${getAliasForPeer(item.forkedFrom) || 'Pingo'}</span>` : ''}
                </div>
            </div>
            <div class="contact-actions">
                <button class="btn btn-outline btn-sm share-route" data-id="${item.id}" title="Compartir P2P">
                    <i class="fas fa-share-nodes"></i>
                </button>
                <button class="btn btn-outline btn-sm load-route" data-id="${item.id}" title="Cargar en Working Copy">
                    <i class="fas fa-folder-open"></i>
                </button>
                <button class="btn ${actionBtnClass} btn-sm view-route" data-id="${item.id}" title="${actionTitle}">
                    <i class="fas ${actionIcon}"></i>
                </button>
            </div>
        `;
        elements.routesContainer.appendChild(card);
    });

    // Event listeners for route cards
    elements.routesContainer.querySelectorAll('.view-route').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = state.routes.find(r => r.id === btn.dataset.id);
            if (item) {
                if (item.type === 'link') {
                    window.open(item.url, '_blank');
                } else if (item.type === 'note') {
                    readRawFile(item.id).then(content => {
                        if (content) alert(content);
                    });
                } else {
                    renderRoute(item);
                    updateLocationStatus(`Viendo: ${item.name}`, 'fa-eye');
                    // Auto-close panel on mobile
                    if (window.innerWidth < 600 && elements.mainPanel) {
                        elements.mainPanel.classList.add('collapsed');
                        elements.panelToggle.classList.remove('active');
                    }
                }
            }
        });
    });

    elements.routesContainer.querySelectorAll('.share-route').forEach(btn => {
        btn.addEventListener('click', () => {
            const routeId = btn.dataset.id;
            const connectedIds = Object.keys(state.connections).filter(id => state.connections[id].open);

            if (state.activeChatPeerId && state.connections[state.activeChatPeerId]?.open) {
                const alias = getAliasForPeer(state.activeChatPeerId);
                if (confirm(`¿Compartir ruta con ${alias}?`)) {
                    shareRouteP2P(routeId, state.activeChatPeerId);
                }
                return;
            }

            if (connectedIds.length === 0) {
                alert('No hay ningún Pingo conectado ahora mismo. Ve a la Agenda para conectar con alguien.');
                return;
            }

            if (connectedIds.length === 1) {
                const id = connectedIds[0];
                const alias = getAliasForPeer(id);
                if (confirm(`¿Enviar a ${alias}?`)) {
                    shareRouteP2P(routeId, id);
                }
            } else {
                const peerId = prompt('Escribe el ID (o abre un chat con alguien para compartir directamente):');
                if (peerId) shareRouteP2P(routeId, peerId);
            }
        });
    });

    elements.routesContainer.querySelectorAll('.load-route').forEach(btn => {
        btn.addEventListener('click', () => {
            loadItemToWorkingCopy(btn.dataset.id);
        });
    });
}

/**
 * Load a route or link file into the Working Copy state
 */
export async function loadItemToWorkingCopy(itemId) {
    const item = state.routes.find(r => r.id === itemId);
    if (!item) return;

    state.workingFile = {
        id: item.id,
        name: item.name,
        type: item.type
    };

    // Update UI Banner
    if (elements.workingCopyBanner) {
        elements.workingCopyBanner.style.display = 'flex';
        elements.workingCopyName.innerText = item.name;
        
        // Show edit button for text/note files
        if (elements.editWorkingCopyBtn) {
            elements.editWorkingCopyBtn.style.display = (item.type === 'link' || item.type === 'note') ? 'inline-flex' : 'none';
        }
    }

    if (item.type === 'route') {
        // Prepare route manager for editing (resuming recording)
        state.recordingPoints = [...(item.points || [])];
        state.isRecording = false; // Need to press "Record" to actually start adding points
        
        // Show points on map
        const { renderRoute } = await import('./map-manager.js');
        renderRoute(item);
        
        updateLocationStatus(`Cargada ruta: ${item.name}. Pulsa REC para añadir puntos.`, 'fa-folder-open');
    } else {
        updateLocationStatus(`Cargado fichero: ${item.name}. Nuevos links se añadirán aquí.`, 'fa-folder-open');
    }

    // Close panel to see the map/banner
    if (window.innerWidth < 600 && elements.mainPanel) {
        elements.mainPanel.classList.add('collapsed');
        elements.panelToggle.classList.remove('active');
    }
}

/**
 * Clear the working copy state
 */
export async function unloadWorkingCopy() {
    if (!state.workingFile) return;

    const name = state.workingFile.name;
    state.workingFile = null;
    
    if (elements.workingCopyBanner) {
        elements.workingCopyBanner.style.display = 'none';
    }

    // If it was a route, we might want to clear recording points if not currently recording
    if (!state.isRecording) {
        state.recordingPoints = [];
        const { clearRoute } = await import('./map-manager.js');
        clearRoute();
    }

    updateLocationStatus(`Cerrada copia: ${name}`, 'fa-times');
}

export function toggleChat() {
    if (!elements.chatPanel) return;
    
    elements.chatPanel.classList.toggle('collapsed');
    const isOpen = !elements.chatPanel.classList.contains('collapsed');

    if (isOpen) {
        if (elements.footerStatusMode) elements.footerStatusMode.style.display = 'none';
        if (elements.footerChatMode) elements.footerChatMode.style.display = 'flex';
        if (elements.chatBadge) elements.chatBadge.style.display = 'none';
        if (elements.chatMessages) elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
        if (elements.chatInput) setTimeout(() => elements.chatInput.focus(), 300);
    } else {
        if (elements.footerStatusMode) elements.footerStatusMode.style.display = 'flex';
        if (elements.footerChatMode) elements.footerChatMode.style.display = 'none';
    }
}

export function openChatFor(peerId) {
    state.activeChatPeerId = peerId;
    const alias = getAliasForPeer(peerId);
    if (elements.chatTitle) {
        elements.chatTitle.innerText = `Chat: ${alias || peerId}`;
    }
    if (elements.chatPanel && elements.chatPanel.classList.contains('collapsed')) {
        toggleChat();
    }
    if (elements.chatInput) elements.chatInput.focus();
    updateLocationStatus(`Chat abierto con ${alias || peerId}`, 'fa-comment');
}

export function toggleContactGeofence(index) {
    const contact = state.agenda[index];
    if (!contact) return;

    contact.geofenceEnabled = !contact.geofenceEnabled;

    if (contact.geofenceEnabled) {
        const marker = state.otherMarkers[contact.derivedId];
        if (marker) {
            const loc = marker.getLatLng();
            contact.geofenceCenter = [loc.lat, loc.lng];
        } else {
            contact.geofenceCenter = [state.myCoords.lat, state.myCoords.lng];
        }
        contact.geofenceRadius = state.geofenceRadius;
    }
    
    saveAgenda();
    renderAgenda();
    updateLocationStatus(`Geovalla para ${contact.alias}: ${contact.geofenceEnabled ? 'ON' : 'OFF'}`, 'fa-circle-dot');
}

export function sendChatMessage() {
    const text = elements.chatInput.value.trim();
    if (!text) return;

    // Generate unique ID for this message to prevent multicast duplicates
    const msgId = `${state.myPeerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    state.seenMessages.add(msgId);
    
    // Cleanup old messages from cache (keep last 100)
    if (state.seenMessages.size > 100) {
        const oldest = state.seenMessages.values().next().value;
        state.seenMessages.delete(oldest);
    }

    if (state.activeChatPeerId && state.connections[state.activeChatPeerId]?.open) {
        state.connections[state.activeChatPeerId].send({ type: 'chat', text, msgId });
        appendMessage('sent', text, 'Tú');
        elements.chatInput.value = '';
    } else {
        // Try relaying to everyone if no active peer or peer not connected
        const openConns = Object.values(state.connections).filter(c => c.open);
        if (openConns.length > 0) {
            openConns.forEach(conn => conn.send({ type: 'chat', text, msgId }));
            appendMessage('sent', text, 'Tú (Difusión)');
            elements.chatInput.value = '';
        } else {
            updateLocationStatus('No hay pingos conectados para chatear', 'fa-comment-slash');
        }
    }
}

export function appendMessage(side, text, sender = '') {
    if (!elements.chatMessages) return;
    
    const hint = elements.chatMessages.querySelector('.chat-hint');
    if (hint) hint.remove();

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${side}`;

    if (sender) {
        const span = document.createElement('span');
        span.style.display = 'block';
        span.style.fontSize = '0.7rem';
        span.style.fontWeight = 'bold';
        span.style.marginBottom = '2px';
        span.style.opacity = '0.8';
        span.textContent = sender;
        bubble.appendChild(span);
    }

    const msgText = document.createElement('span');
    msgText.textContent = text;
    bubble.appendChild(msgText);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save-chat';
    saveBtn.innerHTML = '<i class="fas fa-download"></i>';
    saveBtn.title = 'Guardar en Git';
    saveBtn.onclick = () => saveChatMessageToGit(text, sender);
    bubble.appendChild(saveBtn);

    elements.chatMessages.appendChild(bubble);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Saves a chat message to a Git file with metadata
 */
export async function saveChatMessageToGit(text, sender) {
    try {
        const alias = sender || 'Anónimo';
        const timestamp = new Date().toLocaleString();
        const msgId = Date.now();
        
        const isAppending = state.workingFile && (state.workingFile.type === 'note' || state.workingFile.type === 'link');
        const fileName = isAppending ? state.workingFile.id : `note-${msgId}.txt`;
        
        const newEntry = `De: ${alias}\nFecha: ${timestamp}\nContenido: ${text}\n-------------------\n`;
        
        let fileContent = newEntry;
        if (isAppending) {
            const currentContent = await readRawFile(fileName) || "";
            fileContent = currentContent + "\n" + newEntry;
        }

        await commitLinkFile(fileName, fileContent);
        
        updateLocationStatus(`Mensaje guardado en Git: ${fileName}`, 'fa-check');
        
        // Refresh routes list
        state.routes = await loadRoutesFromGit();
        renderRoutes();

        // Visual feedback
        const msg = isAppending ? `Añadido a ${state.workingFile.name}` : 'Nueva nota creada en Git';
        alert(`¡Guardado!\n${msg}`);
        
    } catch (err) {
        console.error('[UI] Error saving chat message:', err);
        alert('Error al guardar el mensaje en Git.');
    }
}



export function setupEventListeners() {
    setupVectorListeners();
    // Clear app badge on startup
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {});
    }
    elements.copyIdBtn.addEventListener('click', () => {
        if (!state.myPeerId) return;
        navigator.clipboard.writeText(state.myPeerId);
        elements.copyIdBtn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            elements.copyIdBtn.innerHTML = '<i class="far fa-copy"></i>';
        }, 2000);
    });

    if (elements.statusIndicator) {
        elements.statusIndicator.addEventListener('click', showSignalingStats);
    }

    elements.shareBtn.addEventListener('click', () => {
        if (!state.myPeerId) return;
        const baseUrl = window.location.origin + window.location.pathname;
        let shareUrl = `${baseUrl}?pingo=${state.myPeerId}`;

        if (state.geofenceEnabled && state.geofenceCenter) {
            shareUrl += `&glat=${state.geofenceCenter[0]}&glng=${state.geofenceCenter[1]}&grad=${state.geofenceRadius}`;
        }

        const title = 'Pingo - Mi Ubicación';
        const fullText = `📍 ¡Sigue mi ubicación en tiempo real! ${shareUrl}`;

        if (navigator.share) {
            navigator.share({ title, url: shareUrl }).catch(() => {
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`, '_blank');
            });
        } else {
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`, '_blank');
        }
    });

    elements.stopSharingBtn.addEventListener('click', () => {
        if (confirm('¿Dejar de compartir y desconectar?')) {
            Object.values(state.connections).forEach(conn => {
                if (conn.open) conn.send({ type: 'stop' });
            });
            localStorage.removeItem('pingo_remote_id');
            window.location.href = window.location.origin + window.location.pathname;
        }
    });

    elements.panelToggle.addEventListener('click', () => {
        const isCurrentlyCollapsed = elements.mainPanel.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            // Opening
            elements.mainPanel.classList.remove('collapsed');
            elements.panelToggle.classList.add('active');
        } else {
            // Closing
            elements.mainPanel.classList.add('collapsed');
            elements.panelToggle.classList.remove('active');
        }
        
        setTimeout(() => {
            if (state.map) state.map.invalidateSize();
        }, 450);
    });

    elements.geofenceToggle.addEventListener('change', (e) => {
        state.geofenceEnabled = e.target.checked;
        if (state.geofenceEnabled && !state.geofenceCenter) {
            state.geofenceCenter = [state.myCoords.lat, state.myCoords.lng];
        }
        saveGeofenceState();
        updateGeofenceCircle();
    });

    elements.geofenceRadius.addEventListener('input', (e) => {
        state.geofenceRadius = parseInt(e.target.value);
        elements.geofenceRadiusVal.innerText = state.geofenceRadius;
        saveGeofenceState();
        updateGeofenceCircle();
    });

    elements.setGeofenceCenter.addEventListener('click', () => {
        state.geofenceCenter = [state.myCoords.lat, state.myCoords.lng];
        saveGeofenceState();
        updateGeofenceCircle();
        updateLocationStatus('Centro de zona fijado', 'fa-crosshairs');
    });

    elements.forceResetBtn.addEventListener('click', forceAppReset);

    elements.toggleIdentityBtn.addEventListener('click', () => {
        elements.identityForm.style.display = 'block';
        elements.toggleIdentityBtn.style.display = 'none';
    });
    elements.cancelIdentityBtn.addEventListener('click', () => {
        elements.identityForm.style.display = 'none';
        elements.toggleIdentityBtn.style.display = 'block';
    });
    elements.saveIdentityBtn.addEventListener('click', saveIdentity);

    elements.addContactBtn.addEventListener('click', () => {
        elements.addContactForm.style.display = 'block';
        elements.addContactBtn.style.display = 'none';
    });
    elements.cancelContactBtn.addEventListener('click', () => {
        elements.addContactForm.style.display = 'none';
        elements.addContactBtn.style.display = 'block';
    });
    elements.saveContactBtn.addEventListener('click', async () => {
        const alias = elements.contactName.value.trim();
        const phrase = elements.contactPhrase.value.trim();
        const salt = elements.contactSalt.value.trim();
        const manualId = elements.contactId.value.trim();

        if (!alias || (!phrase && !manualId)) {
            alert('Nombre y (Frase o ID) son obligatorios.');
            return;
        }

        const derivedId = manualId || (await derivePeerId(phrase, salt));
        state.agenda.push({ alias, phrase, salt, derivedId });
        saveAgenda();
        renderAgenda();
        
        elements.addContactForm.style.display = 'none';
        elements.addContactBtn.style.display = 'block';
        
        // Clear inputs
        elements.contactName.value = '';
        elements.contactPhrase.value = '';
        elements.contactSalt.value = '';
        elements.contactId.value = '';
    });

    initAppGuide();

    elements.chatBtn.addEventListener('click', toggleChat);
    elements.closeChatBtn.addEventListener('click', toggleChat);
    elements.exitChatBtn.addEventListener('click', toggleChat);
    elements.sendChatBtn.addEventListener('click', sendChatMessage);

    elements.manualLocationBtn.addEventListener('click', () => {
        state.manualLocationMode = !state.manualLocationMode;
        if (state.manualLocationMode) {
            elements.manualLocationBtn.classList.remove('btn-outline');
            elements.manualLocationBtn.classList.add('btn-warning');
            updateLocationStatus('Haz clic en el mapa para situarte', 'fa-hand-pointer');
        } else {
            elements.manualLocationBtn.classList.remove('btn-warning');
            elements.manualLocationBtn.classList.add('btn-outline');
            updateLocationStatus('Modo automático (si hay GPS)', 'fa-location-arrow');
        }
    });

    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // --- MODO CORRESPONDENCIA / CARTOGRAFÍA ---
    elements.modeStandardBtn.addEventListener('click', () => setUIMode('standard'));
    elements.modeCartographyBtn.addEventListener('click', () => setUIMode('cartography'));

    elements.startRecordingBtn.addEventListener('click', () => {
        startRecording();
        elements.startRecordingBtn.style.display = 'none';
        elements.stopRecordingBtn.style.display = 'flex';
    });

    elements.stopRecordingBtn.addEventListener('click', () => {
        stopRecording();
        elements.startRecordingBtn.style.display = 'flex';
        elements.stopRecordingBtn.style.display = 'none';
    });

    elements.saveRouteConfirmBtn.addEventListener('click', async () => {
        const originalText = elements.saveRouteConfirmBtn.innerHTML;
        elements.saveRouteConfirmBtn.disabled = true;
        elements.saveRouteConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        const name = elements.routeNameInput.value.trim();
        const success = await saveRoute(name);
        
        if (success) {
            if (elements.saveRouteForm) elements.saveRouteForm.style.display = 'none';
            if (elements.recordingHud) elements.recordingHud.style.display = 'none';
            renderRoutes();
        } else {
            // Restore button if failed
            elements.saveRouteConfirmBtn.disabled = false;
            elements.saveRouteConfirmBtn.innerHTML = originalText;
        }
    });

    if (elements.shareActiveRouteBtn) {
        elements.shareActiveRouteBtn.addEventListener('click', () => {
            if (!state.activeChatPeerId) return;
            // Get last route
            if (state.routes.length === 0) {
                alert('No tienes rutas guardadas para compartir.');
                return;
            }
            const lastRoute = state.routes[state.routes.length - 1];
            if (confirm(`¿Compartir tu última ruta (${lastRoute.name}) por el chat?`)) {
                shareRouteP2P(lastRoute.id, state.activeChatPeerId);
            }
        });
    }

    elements.cancelRouteBtn.addEventListener('click', () => {
        if (elements.saveRouteForm) elements.saveRouteForm.style.display = 'none';
        state.recordingPoints = [];
        updateLocationStatus('Grabación descartada', 'fa-trash');
    });

    // --- SINCRONIZACIÓN GIT ---
    if (elements.gitPushBtn) {
        // Load saved config
        const savedGit = JSON.parse(localStorage.getItem('pingo_git_remote') || '{}');
        if (elements.gitRemoteUrl) elements.gitRemoteUrl.value = savedGit.url || '';
        if (elements.gitUsername) elements.gitUsername.value = savedGit.user || '';
        // Note: Password/Token handled with care

        elements.gitPushBtn.addEventListener('click', async () => {
            const url = elements.gitRemoteUrl.value.trim();
            const user = elements.gitUsername.value.trim();
            const token = elements.gitToken.value.trim() || savedGit.token;

            if (!url || !user || !token) {
                alert('URL, Usuario y Token son necesarios.');
                return;
            }

            const originalText = elements.gitPushBtn.innerHTML;
            elements.gitPushBtn.disabled = true;
            elements.gitPushBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';

            try {
                await pushToRemote(url, user, token);
                
                // Save config (URL and User permanently, Token too as requested)
                localStorage.setItem('pingo_git_remote', JSON.stringify({ url, user, token }));

                updateLocationStatus('Sincronización (Push) completada ✅', 'fa-cloud-arrow-up');
                alert('¡Rutas subidas con éxito a Gitea!');
            } catch (err) {
                if (err.message.includes('Push rechazado')) {
                    const choice = confirm('¡Push rechazado!\n\nEl servidor tiene cambios más recientes. ¿Quieres FORZAR la versión del móvil y sobreescribir el servidor?\n\n(Aceptar = Forzar Móvil, Cancelar = Intentar bajar primero)');
                    if (choice) {
                        try {
                            elements.gitPushBtn.innerHTML = '<i class="fas fa-bolt fa-spin"></i> Forzando...';
                            await import('./git-manager.js').then(m => m.forceSyncWithRemote('local', url, user, token));
                            alert('Servidor actualizado a la fuerza con tus cambios locales.');
                        } catch (forceErr) {
                            alert(`Fallo al forzar: ${forceErr.message}`);
                        }
                    }
                } else {
                    alert(`Error al subir: ${err.message}`);
                }
                updateLocationStatus('Error en Git Sync', 'fa-triangle-exclamation');
            } finally {
                elements.gitPushBtn.disabled = false;
                elements.gitPushBtn.innerHTML = originalText;
            }
        });

        elements.gitPullBtn.addEventListener('click', async () => {
            const url = elements.gitRemoteUrl.value.trim();
            const user = elements.gitUsername.value.trim();
            const token = elements.gitToken.value.trim() || savedGit.token;

            if (!url || !user || !token) {
                alert('URL, Usuario y Token son necesarios.');
                return;
            }

            const originalText = elements.gitPullBtn.innerHTML;
            elements.gitPullBtn.disabled = true;
            elements.gitPullBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Bajando...';

            try {
                await pullFromRemote(url, user, token);
                
                // Save config
                localStorage.setItem('pingo_git_remote', JSON.stringify({ url, user, token }));

                // Refresh local state
                state.routes = await loadRoutesFromGit();
                renderRoutes();

                updateLocationStatus('Sincronización (Pull) completada ✅', 'fa-cloud-arrow-down');
                alert('¡Datos descargados y combinados con éxito!');
            } catch (err) {
                if (err.message.includes('Merges with conflicts')) {
                    const choice = confirm('¡Conflicto detectado!\n\nNo puedo unir los cambios automáticamente. ¿Quieres RESETEAR el móvil con la versión del SERVIDOR?\n\n(Aceptar = Usar Servidor, Cancelar = No hacer nada)');
                    
                    if (choice) {
                        try {
                            elements.gitPullBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Reparando...';
                            await import('./git-manager.js').then(m => m.forceSyncWithRemote('remote', url, user, token));
                            state.routes = await loadRoutesFromGit();
                            renderRoutes();
                            alert('Repositorio restaurado con éxito desde el servidor.');
                        } catch (repairErr) {
                            alert(`Fallo en reparación: ${repairErr.message}`);
                        }
                    }
                } else {
                    alert(`Error al descargar: ${err.message}`);
                }
                updateLocationStatus('Error en Git Sync', 'fa-triangle-exclamation');
            } finally {
                elements.gitPullBtn.disabled = false;
                elements.gitPullBtn.innerHTML = originalText;
            }
        });
    }

    if (elements.gitClearBtn) {
        elements.gitClearBtn.addEventListener('click', async () => {
            const confirmed = confirm('¿ESTÁS TOTALMENTE SEGURO?\n\nEsto borrará todas las rutas y archivos del repositorio LOCAL de forma permanente.\n\n(No afectará a lo que ya hayas subido al servidor Gitea/GitHub)');
            
            if (confirmed) {
                try {
                    updateLocationStatus('Borrando repositorio local...', 'fa-trash-can');
                    const success = await deleteGitRepo();
                    if (success) {
                        await import('./git-manager.js').then(m => m.initGitRepo()); // Re-iniciar estructura .git
                        state.routes = [];
                        localStorage.removeItem('pingo_route_ids'); // Limpiar índice antiguo
                        renderRoutes();
                        updateLocationStatus('Tabula rasa: Repositorio borrado.', 'fa-sparkles');
                    }
                } catch (err) {
                    alert(`Error al borrar: ${err.message}`);
                }
            }
        });
    }

    if (elements.exportBackupBtn) {
        elements.exportBackupBtn.addEventListener('click', () => {
            const backupData = {
                version: VERSION,
                agenda: state.agenda,
                myIdentity: state.myIdentity,
                timestamp: new Date().toISOString()
            };
            const jsonContent = JSON.stringify(backupData, null, 2);
            const fileName = `pingo_backup_${new Date().toISOString().split('T')[0]}.json`;

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                window.Capacitor.Plugins.PingoNative.shareFile({
                    filename: fileName,
                    content: jsonContent
                }).catch(err => {
                    console.error('Error sharing file:', err);
                    alert('Error al exportar el archivo.');
                });
            } else {
                const blob = new Blob([jsonContent], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            updateLocationStatus('Copia de seguridad exportada ✅', 'fa-file-export');
        });
    }
    if (elements.importBackupBtn) {
        elements.importBackupBtn.addEventListener('click', () => {
            elements.importFileInput.click();
        });

        elements.importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.agenda && !data.myIdentity) {
                        throw new Error('Formato de archivo inválido');
                    }

                    if (data.agenda) {
                        state.agenda = data.agenda;
                        saveAgenda();
                        renderAgenda();
                    }

                    if (data.myIdentity) {
                        state.myIdentity = data.myIdentity;
                        localStorage.setItem('pingo_passphrase', state.myIdentity.phrase);
                        localStorage.setItem('pingo_salt', state.myIdentity.salt);
                        if (elements.identityPhrase) elements.identityPhrase.value = state.myIdentity.phrase;
                        if (elements.identitySalt) elements.identitySalt.value = state.myIdentity.salt;

                        // CRITICAL: Recalculate Peer ID for the new identity
                        if (state.myIdentity.phrase) {
                            const newId = await derivePeerId(state.myIdentity.phrase, state.myIdentity.salt || '');
                            if (newId) {
                                localStorage.setItem('pingo_my_id', newId);
                            }
                        }
                        
                        updateLocationStatus('Respaldo importado. Reiniciando...', 'fa-fingerprint');
                        setTimeout(() => window.location.reload(), 1500);
                        return; // Wait for reload
                    }

                    updateLocationStatus('Respaldo importado con éxito ✅', 'fa-check-circle');
                    alert('Agenda restaurada.');
                } catch (err) {
                    console.error('Error al importar:', err);
                    alert('Error al importar el archivo. Asegúrate de que es un JSON válido de Pingo.');
                }
            };
            reader.readAsText(file);
            // Reset input so the same file can be selected again
            e.target.value = '';
        });
    }

    // Cloud Services Toggle
    if (elements.cloudServicesToggle) {
        // Load initial state (now handled in state.js)
        elements.cloudServicesToggle.checked = state.useCloudServices;

        elements.cloudServicesToggle.addEventListener('change', (e) => {
            state.useCloudServices = e.target.checked;
            localStorage.setItem('pingo_use_cloud', state.useCloudServices);
            
            if (state.useCloudServices) {
                updateLocationStatus('Servicios en la nube activados', 'fa-cloud');
                // Proactive check for subscription if enabled
                initPushNotifications(state.myPeerId, updateLocationStatus);
            } else {
                updateLocationStatus('Usando solo modo P2P directo', 'fa-shield-halved');
            }
        });
    }

    // --- Ping (Notification) Event ---
    if (elements.agendaContainer) {
        console.log('[UI] Attaching Ping listener to agenda-container');
        elements.agendaContainer.addEventListener('click', async (e) => {
            const btn = e.target.closest('.send-ping');
            if (btn) {
                const id = btn.dataset.id;
                console.log('[UI] Ping button clicked for:', id);
                const alias = getAliasForPeer(id);
                updateLocationStatus(`Enviando Ping a ${alias || id}...`, 'fa-spinner fa-spin');
                const ok = await sendPushPing(id, state.myIdentity.alias || 'Un Pingo', alias || 'Pingo');
                if (ok) {
                    updateLocationStatus('Ping enviado ✅', 'fa-check-circle');
                } else {
                    updateLocationStatus('Fallo al enviar Ping ❌', 'fa-triangle-exclamation');
                }
            }
        });
    }

    if (elements.unloadWorkingCopyBtn) {
        elements.unloadWorkingCopyBtn.addEventListener('click', unloadWorkingCopy);
    }

    if (elements.editWorkingCopyBtn) {
        elements.editWorkingCopyBtn.addEventListener('click', async () => {
            if (!state.workingFile || !state.workingFile.id) return;
            
            try {
                updateLocationStatus('Leyendo archivo...', 'fa-spinner fa-spin');
                const content = await readRawFile(state.workingFile.id);
                if (content !== null) {
                    if (elements.textEditorContainer) elements.textEditorContainer.style.display = 'flex';
                    if (elements.textEditorTextarea) elements.textEditorTextarea.value = content;
                    if (elements.editorTitle) elements.editorTitle.innerText = `Editando: ${state.workingFile.name}`;
                    updateLocationStatus('Editor abierto.', 'fa-edit');
                }
            } catch (err) {
                alert(`Error al abrir editor: ${err.message}`);
            }
        });
    }

    if (elements.closeEditorBtn) {
        elements.closeEditorBtn.addEventListener('click', () => {
            if (elements.textEditorContainer) elements.textEditorContainer.style.display = 'none';
        });
    }

    if (elements.saveEditorBtn) {
        elements.saveEditorBtn.addEventListener('click', async () => {
            if (!state.workingFile || !state.workingFile.id) return;
            const newContent = elements.textEditorTextarea.value;
            
            try {
                updateLocationStatus('Guardando en Git...', 'fa-spinner fa-spin');
                const sha = await commitLinkFile(state.workingFile.id, newContent);
                if (sha) {
                    updateLocationStatus('Cambios guardados en Git ✅', 'fa-check-circle');
                    if (elements.textEditorContainer) elements.textEditorContainer.style.display = 'none';
                    // Refresh route list to reflect changes
                    state.routes = await loadRoutesFromGit();
                    renderRoutes();
                }
            } catch (err) {
                alert(`Error al guardar: ${err.message}`);
                updateLocationStatus('Error al guardar ❌', 'fa-times');
            }
        });
    }
}

export function updateDisconnectButton() {
    if (elements.stopSharingBtn) {
        elements.stopSharingBtn.style.display = 'flex';
    }
}

export function setupVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
        state.isAppInBackground = document.visibilityState === 'hidden';
        console.log(`Visibility changed: isAppInBackground = ${state.isAppInBackground}`);

        if (!state.isAppInBackground && state.isPrimaryTab) {
            // BACK TO FOREGROUND
            console.log('[Visibility] App restored to foreground. Verifying connections...');
            
            // 1. Ensure PeerJS signaling is alive
            ensureSignalingConnection();

            // 2. Refresh Peer data channels
            setTimeout(() => {
                restoreActiveConnections();
            }, 1000);

            // 3. Immediate location blast
            const now = Date.now();
            if (state.myCoords.lat !== 0 || state.myCoords.lng !== 0) {
                console.log('[Visibility] Sending foreground heartbeat location...');
                broadcastLocation(state.myCoords.lat, state.myCoords.lng);
                state.lastBroadcastTime = now;
            }
        }
    });
}

export function updateMultiTabStatus() {
    if (elements.multiTabWarning) {
        elements.multiTabWarning.style.display = state.isPrimaryTab ? 'none' : 'block';
    }
    if (elements.statusIndicator) {
        if (!state.isPrimaryTab) {
            elements.statusIndicator.classList.add('passive');
        } else {
            elements.statusIndicator.classList.remove('passive');
        }
    }
}

export function togglePersistenceMode() {
    state.persistenceMode = elements.persistenceToggle.checked;
    localStorage.setItem('pingo_persistence', state.persistenceMode);
    
    if (state.persistenceMode) {
        startPersistenceAudio();
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            window.Capacitor.Plugins.PingoNative.startService();
        }
        updateLocationStatus('Modo Persistente activado 🔋', 'fa-battery-full');
    } else {
        stopPersistenceAudio();
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            window.Capacitor.Plugins.PingoNative.stopService();
        }
        updateLocationStatus('Modo Persistente desactivado', 'fa-battery-half');
    }
}

function startPersistenceAudio() {
    if (state.audioElement) return;
    
    // Create a tiny silent audio loop to keep the process alive in background
    // (Common PWA persistence hack)
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFWm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAB';
    audio.loop = true;
    audio.volume = 0.01; // Silent but not zero to avoid some browser blocks
    
    state.audioElement = audio;
    audio.play().catch(err => {
        console.warn('[Persistence] Auto-play blocked. Need user interaction.', err);
    });
}

function stopPersistenceAudio() {
    if (state.audioElement) {
        state.audioElement.pause();
        state.audioElement = null;
    }
}

export function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        if (elements.installBtn) elements.installBtn.style.display = 'flex';
    });

    if (elements.installBtn) {
        elements.installBtn.addEventListener('click', async () => {
            if (state.deferredPrompt) {
                state.deferredPrompt.prompt();
                const { outcome } = await state.deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    elements.installBtn.style.display = 'none';
                }
                state.deferredPrompt = null;
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        if (elements.installBtn) elements.installBtn.style.display = 'none';
        state.deferredPrompt = null;
    });
}

export async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            state.wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

export function forceAppReset() {
    updateLocationStatus('Limpiando caché y reiniciando...', 'fa-sync fa-spin');
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
            }
            window.location.href = window.location.origin + window.location.pathname + '?clear=' + Date.now();
        });
    } else {
        window.location.reload(true);
    }
}

export function injectStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .my-location-marker .pulse {
            width: 15px;
            height: 15px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
        .my-location-marker .pulse::after {
            content: "";
            width: 15px;
            height: 15px;
            background: #3b82f6;
            border-radius: 50%;
            position: absolute;
            animation: pulse_anim 2s infinite;
            z-index: -1;
        }
        @keyframes pulse_anim {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(3); opacity: 0; }
        }
        .other-location-marker {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .other-location-marker .marker-pin {
            width: 20px;
            height: 20px;
            background: #ec4899;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            margin-bottom: 2px;
        }
        .other-location-marker .label {
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
        }
        body {
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
        }
    `;
    document.head.appendChild(style);
}
/**
 * Extract and render user guide from README.md
 */
export function initAppGuide() {
    const container = document.getElementById('guide-accordion');
    if (!container) return;

    try {
        const regex = /<!-- pingo-user-guide-start -->([\s\S]*?)<!-- pingo-user-guide-end -->/;
        const match = README.match(regex);
        
        if (!match || !match[1]) {
            console.warn('[UI] Guide tags not found in README');
            container.innerHTML = '<p class="small-hint">Guía no disponible temporalmente.</p>';
            return;
        }

        const content = match[1].trim();
        // Split by H2 headers (##)
        // We use a regex lookahead to keep the '## ' sequence or similar if needed, 
        // but simple split works if we skip the first empty element.
        const sections = content.split(/^##\s+/m).filter(s => s.trim() !== '');
        
        container.innerHTML = '';

        sections.forEach(section => {
            const lines = section.split('\n');
            const titleWithIcon = lines[0].trim();
            const body = lines.slice(1).join('\n').trim();

            const details = document.createElement('details');
            details.className = 'guide-item';
            
            // Reconstruct summary with chevron
            details.innerHTML = `
                <summary class="guide-header">
                    ${titleWithIcon}
                    <i class="fas fa-chevron-down chevron"></i>
                </summary>
                <div class="guide-content">
                    ${marked.parse(body)}
                </div>
            `;
            
            container.appendChild(details);
        });

    } catch (err) {
        console.error('[UI] Error loading guide:', err);
        container.innerHTML = '<p class="small-hint">Error al cargar la documentación.</p>';
    }
}

/**
 * Custom confirm modal replacement for window.confirm()
 * @param {string} title 
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
export function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        if (!elements.confirmModal) {
            console.error('[UI] Confirm modal elements not found');
            resolve(confirm(message)); // Fallback if UI not ready
            return;
        }

        elements.confirmModalTitle.innerText = title;
        elements.confirmModalMessage.innerText = message;
        elements.confirmModal.style.display = 'flex';

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            elements.confirmModalOk.removeEventListener('click', handleOk);
            elements.confirmModalCancel.removeEventListener('click', handleCancel);
            elements.confirmModal.style.display = 'none';
        };

        elements.confirmModalOk.addEventListener('click', handleOk);
        elements.confirmModalCancel.addEventListener('click', handleCancel);
    });
}

/**
 * Setup Semantic / Vector Search listeners
 */
export function setupVectorListeners() {
    if (elements.indexVectorsBtn) {
        elements.indexVectorsBtn.addEventListener('click', async () => {
            const btn = elements.indexVectorsBtn;
            const progress = elements.vectorIndexProgress;
            const bar = elements.vectorIndexBar;
            const status = elements.vectorIndexStatus;

            btn.disabled = true;
            progress.style.display = 'block';
            bar.style.width = '0%';
            status.innerText = 'Cargando motor de IA...';

            try {
                // Función para leer archivos del Git
                const readFile = async (id) => await readRawFile(id);
                
                await vectorManager.indexGitFiles(state.routes, readFile);
                
                status.innerText = '¡Indexación semántica completa!';
                setTimeout(() => {
                    progress.style.display = 'none';
                    btn.disabled = false;
                }, 3000);
            } catch (err) {
                console.error('[VectorUI] Index error:', err);
                status.innerText = 'Error: ' + err.message;
                btn.disabled = false;
            }
        });
    }

    if (elements.semanticSearchInput) {
        elements.semanticSearchInput.addEventListener('input', async (e) => {
            const query = e.target.value.trim();
            if (query.length < 3) {
                renderRoutes(); // Restore full list if query is short
                return;
            }

            // Auto-switch to cartography mode to see results
            if (state.uiMode !== 'cartography') {
                setUIMode('cartography');
            }

            try {
                const vector = await vectorManager.getEmbedding(query);
                const matches = await vectorManager.findSimilar(vector, 10);
                
                // Filtrar por un umbral mínimo de similitud (ej: 0.2) para evitar ruido
                const relevantMatches = matches.filter(m => m.similarity > 0.2);
                
                // Render results with similarity scores
                renderSemanticResults(relevantMatches);
            } catch (err) {
                console.error('[VectorUI] Search error:', err);
            }
        });
    }

    // Listen for worker progress (model download)
    window.addEventListener('vector-progress', (e) => {
        const { status, progress, file } = e.detail;
        if (status === 'progress' && elements.vectorIndexStatus) {
            elements.vectorIndexStatus.innerText = `Descargando: ${Math.round(progress)}% (${file})`;
            if (elements.vectorIndexBar) elements.vectorIndexBar.style.width = `${progress}%`;
        }
    });

    // Listen for indexing updates
    window.addEventListener('vector-index-update', (e) => {
        const { current, total, last } = e.detail;
        if (elements.vectorIndexStatus) {
            elements.vectorIndexStatus.innerText = `Indexando: ${current}/${total} - ${last}`;
            if (elements.vectorIndexBar) elements.vectorIndexBar.style.width = `${(current/total) * 100}%`;
        }
        });

    // Initialize Sidebar state based on width
    if (window.innerWidth < 1000) {
        elements.mainPanel.classList.add('collapsed');
        elements.panelToggle.classList.remove('active');
    } else {
        elements.mainPanel.classList.remove('collapsed');
        elements.panelToggle.classList.add('active');
    }

    // Connection Stats Modal
    if (elements.connStatsClose) {
        elements.connStatsClose.addEventListener('click', () => {
            elements.connStatsModal.style.display = 'none';
        });
    }
}

function renderSemanticResults(matches) {
    if (!elements.routesContainer) return;
    elements.routesContainer.innerHTML = '';

    if (matches.length === 0) {
        elements.routesContainer.innerHTML = '<p class="small-hint" style="text-align: center; padding: 20px;">No hay coincidencias semánticas.</p>';
        return;
    }

    // Re-use logic from renderRoutes but add similarity badge
    matches.forEach(match => {
        const originalItem = state.routes.find(r => r.id === match.id);
        if (!originalItem) return;

        const score = Math.round(match.similarity * 100);
        const card = document.createElement('div');
        card.className = 'contact-card route-card';
        card.style.borderLeft = `4px solid hsl(${score}, 70%, 50%)`; 
        
        card.innerHTML = `
            <div class="contact-info">
                <span class="contact-name">${originalItem.name}</span>
                <div class="route-meta">
                    <span class="badge" style="background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">Semántica: ${score}%</span>
                </div>
            </div>
            <div class="contact-actions">
                <button class="btn btn-primary btn-sm view-route" data-id="${originalItem.id}">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        `;
        
        card.querySelector('.view-route').addEventListener('click', () => {
             loadItemToWorkingCopy(originalItem.id);
        });

        elements.routesContainer.appendChild(card);
    });
}

/**
 * Shows connection details and visualization
 * @param {string} peerId 
 */
export async function showConnectionStats(peerId) {
    if (!elements.connStatsModal) return;

    const alias = getAliasForPeer(peerId) || peerId;
    if (elements.connStatsTitle) elements.connStatsTitle.innerText = `Conexión: ${alias}`;
    if (elements.connStatsViz) elements.connStatsViz.innerHTML = '<p style="text-align:center; width: 100%;">Analizando conexión...</p>';
    if (elements.connStatsDetails) elements.connStatsDetails.innerHTML = '';
    elements.connStatsModal.style.display = 'flex';

    const stats = await getConnectionStats(peerId);
    
    if (!stats) {
        if (elements.connStatsViz) {
            elements.connStatsViz.innerHTML = `
                <div style="text-align:center; width: 100%; color: #ef4444;">
                    <i class="fas fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No se pudieron obtener estadísticas de la conexión.</p>
                    <p class="small-hint">Asegúrate de que el Pingo esté conectado.</p>
                </div>
            `;
        }
        return;
    }

    // Determine icons based on type
    let netIcon = 'fa-globe';
    let typeLabel = 'Relé (TURN)';
    let typeColor = '#ef4444'; // Red

    if (stats.type === 'host') {
        netIcon = 'fa-house-signal';
        typeLabel = 'Directa (LAN)';
        typeColor = '#22c55e'; // Green
    } else if (stats.type === 'srflx') {
        netIcon = 'fa-cloud';
        typeLabel = 'Internet (STUN)';
        typeColor = '#3b82f6'; // Blue
    }

    // Render Visualization
    if (elements.connStatsViz) {
        elements.connStatsViz.innerHTML = `
            <div class="conn-node">
                <i class="fas fa-mobile-screen"></i>
                <span>Tú</span>
            </div>
            <div class="conn-path" style="--primary: ${typeColor}">
                <span class="conn-type-badge" style="background: ${typeColor}">${typeLabel}</span>
            </div>
            <div class="conn-node remote">
                <i class="fas fa-location-dot" style="color: ${getPeerColor(peerId)}"></i>
                <span>${alias}</span>
            </div>
        `;
    }

    // Render Details
    const rtt = stats.currentRoundTripTime ? `${Math.round(stats.currentRoundTripTime * 1000)}ms` : 'n/a';
    const sent = (stats.bytesSent / 1024).toFixed(1) + ' KB';
    const received = (stats.bytesReceived / 1024).toFixed(1) + ' KB';
    
    if (elements.connStatsDetails) {
        elements.connStatsDetails.innerHTML = `
            <p><span>Tipo de candidato:</span> <strong>${stats.type}</strong></p>
            <p><span>Protocolo:</span> <strong>${stats.protocol.toUpperCase()}</strong></p>
            <p><span>Latencia (RTT):</span> <strong>${rtt}</strong></p>
            <p><span>Datos enviados:</span> <strong>${sent}</strong></p>
            <p><span>Datos recibidos:</span> <strong>${received}</strong></p>
            <p style="font-size: 0.7rem; opacity: 0.5; margin-top: 10px;">IP Local: ${stats.localAddress}</p>
            <p style="font-size: 0.7rem; opacity: 0.5;">IP Remota: ${stats.remoteAddress}</p>
        `;
    }
}

/**
 * Shows signaling server connection details
 */
export function showSignalingStats() {
    if (!elements.connStatsModal) return;

    elements.connStatsTitle.innerText = 'Servidor de Señalización';
    elements.connStatsViz.innerHTML = '';
    elements.connStatsDetails.innerHTML = '';
    elements.connStatsModal.style.display = 'flex';

    const isOnline = state.peer && !state.peer.disconnected && !state.peer.destroyed;
    const isPassive = !state.isPrimaryTab;
    
    let statusLabel = 'Desconectado';
    let statusColor = '#ef4444'; // Red
    let statusIcon = 'fa-circle-xmark';

    if (isOnline) {
        if (isPassive) {
            statusLabel = 'Pasivo (Multitarea)';
            statusColor = '#f59e0b'; // Amber
            statusIcon = 'fa-eye';
        } else {
            statusLabel = 'En línea';
            statusColor = '#22c55e'; // Green
            statusIcon = 'fa-circle-check';
        }
    }

    // Render Visualization
    if (elements.connStatsViz) {
        elements.connStatsViz.innerHTML = `
            <div class="conn-node">
                <i class="fas fa-mobile-screen"></i>
                <span>Este Dispositivo</span>
            </div>
            <div class="conn-path" style="--primary: ${statusColor}">
                <span class="conn-type-badge" style="background: ${statusColor}">${statusLabel}</span>
            </div>
            <div class="conn-node remote">
                <i class="fas fa-server" style="color: ${statusColor}"></i>
                <span>Signaling Server</span>
            </div>
        `;
    }

    // Render Details
    if (elements.connStatsDetails) {
        const peerId = state.myPeerId || 'n/a';
        const server = state.peer?._options?.host || 'peerjs-server.accreativos.com';
        const port = state.peer?._options?.port || 443;
        const secure = state.peer?._options?.secure ? 'Sí' : 'No';
        
        elements.connStatsDetails.innerHTML = `
            <p><span>Estado Global:</span> <strong>${statusLabel}</strong></p>
            <p><span>Tu ID:</span> <strong>${peerId}</strong></p>
            <p><span>Rol de Pestaña:</span> <strong>${state.isPrimaryTab ? 'Principal' : 'Pasiva'}</strong></p>
            <p><span>Servidor:</span> <strong>${server}</strong></p>
            <p><span>Puerto:</span> <strong>${port}</strong></p>
            <p><span>Cifrado (SSL):</span> <strong>${secure}</strong></p>
            <p style="font-size: 0.7rem; opacity: 0.5; margin-top: 10px; line-height: 1.2;">
                ${state.isPrimaryTab 
                    ? 'Esta pestaña tiene el control del GPS y las conexiones P2P activas.' 
                    : 'Hay otra pestaña abierta con Pingo. Esta pestaña está en modo lectura para evitar duplicar el tráfico.'}
            </p>
        `;
    }
}
