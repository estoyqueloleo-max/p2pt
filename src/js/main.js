/**
 * Pingo - Main Entry Point
 */

import 'leaflet/dist/leaflet.css';
import '../style.css';
import { state, elements } from './state.js';
import { VERSION } from './constants.js';
import { initMap } from './map-manager.js';
import { initGeolocation } from './geo-manager.js';
import { initPeer, broadcastLocation, handleIncomingConnection, stopAllConnections, ensureSignalingConnection, connectToPeer } from './peer-manager.js';
import { updateLocationStatus } from './utils.js';
import { 
    renderAgenda, setupEventListeners, 
    setupPWAInstall, requestWakeLock, setupVisibilityTracking,
    injectStyles, updateDisconnectButton, syncVersions, checkDeepLink,
    updateMultiTabStatus, togglePersistenceMode
} from './ui-manager.js';
import { loadIdentity, loadAgenda } from './identity-manager.js';
import { loadGeofenceState, checkGeofence } from './geofence-manager.js';
import { initRouteManager, addRecordingPoint } from './route-manager.js';
import { updateRecordingPath } from './map-manager.js';
import { setupYouTubeBridge } from './youtube-bridge.js';
import { setupAndroidShareListener } from './android-share.js';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

function init() {
    try {
        console.log(`Initializing Pingo v${VERSION}...`);
        
        // Immediate UI setup
        syncVersions();
        injectStyles();
        
        // Initialize Core Systems
        initMap();
        
        initGeolocation(
            // On Update
            (lat, lng, dist) => {
                broadcastLocation(lat, lng);
                const acc = state.myCoords.accuracy ? ` (±${Math.round(state.myCoords.accuracy)}m)` : '';
                updateLocationStatus(`Ubicación OK${acc}`, 'fa-check');
                state.lastGeoError = null; // Clear error state on success
                checkGeofence();
                
                // Routes recording
                if (state.isRecording) {
                    addRecordingPoint(lat, lng);
                    updateRecordingPath();
                }
            },
            // On Error
            (err) => {
                const now = Date.now();
                const errorKey = `geo-${err.code}-${err.message}`;
                
                // Throttle: only show the same error once every 30 seconds
                if (state.lastGeoError === errorKey && (now - state.lastGeoErrorTime < 30000)) return;
                
                state.lastGeoError = errorKey;
                state.lastGeoErrorTime = now;

                console.error('Geo Error:', err);
                const isTimeout = (err.code === 3);
                const msg = isTimeout ? 'Buscando GPS... ¿Prueba manual?' : 'Sin GPS. Usa modo manual';
                const icon = isTimeout ? 'fa-spinner fa-spin' : 'fa-location-dot';
                updateLocationStatus(msg, icon);
            }
        );

        initPeer(
            // On Open
            (id) => {
                if (elements.myPeerId) elements.myPeerId.innerText = id;
                if (elements.statusIndicator) elements.statusIndicator.classList.add('online');
            },
            // On Connection (handled internally by initPeer -> handleIncomingConnection)
            null,
            // On Error
            (err) => {
                console.error('Peer Error:', err);
                if (elements.statusIndicator) elements.statusIndicator.classList.remove('online');
            },
            // On Disconnected
            () => {
                if (elements.statusIndicator) elements.statusIndicator.classList.remove('online');
            }
        );

        // UI & State Initialization
        setupEventListeners();
        loadIdentity();
        loadAgenda();
        renderAgenda();
        loadGeofenceState();
        setupPWAInstall();
        requestWakeLock();
        setupVisibilityTracking();
        
        // Initialize Route Manager
        initRouteManager();
        
        checkDeepLink();

        if (elements.persistenceToggle) {
            elements.persistenceToggle.addEventListener('change', togglePersistenceMode);
        }

        // YouTube InAppBrowser Integration
        setupYouTubeBridge();

        // Android Share Intent Listener
        setupAndroidShareListener();

        // Multi-tab Management
        manageTabLock();

        // Persistence Mode
        if (state.persistenceMode && elements.persistenceToggle) {
            elements.persistenceToggle.checked = true;
            togglePersistenceMode();
        }

        // Periodic Sync registration
        registerPeriodicSync();

        // Check for Web Share Target files
        checkSharedFiles();

        console.log('Pingo initialized successfully.');
    } catch (err) {
        console.error('Initialization Error:', err);
        updateLocationStatus('Error al iniciar la App', 'fa-circle-exclamation');
    }
}

async function checkSharedFiles() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') !== 'share_received') return;

    try {
        const file = await new Promise((resolve, reject) => {
            const request = indexedDB.open('pingo-share', 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('files')) { resolve(null); return; }
                const tx = db.transaction('files', 'readonly');
                const getReq = tx.objectStore('files').get('shared-file');
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => reject(getReq.error);
            };
            request.onerror = () => reject(request.error);
        });

        if (!file) {
            console.warn('[Share] No shared file found in IndexedDB.');
            return;
        }

        console.log('[Share] Found shared file:', file.name, file.size, file.type);
        updateLocationStatus(`Archivo recibido: ${file.name}`, 'fa-file-import');

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Helper: send to a peer if already open
        function sendToConnectedPeer(peerId) {
            const conn = state.connections[peerId];
            if (conn && conn.open) {
                conn.send({
                    type: 'file-transfer',
                    file: arrayBuffer,
                    fileName: file.name,
                    mimeType: file.type || 'application/json'
                });
                return true;
            }
            return false;
        }

        // Helper: connect and wait until open, then send
        async function connectAndSend(contact) {
            const conn = await connectToPeer(contact.derivedId);
            if (!conn) { 
                throw new Error(`No se pudo iniciar la conexión con ${contact.alias}`); 
            }
            if (!conn.open) {
                // wait up to 8 seconds for the connection to open
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error(`Tiempo de espera agotado. Asegúrate de que ${contact.alias} tenga Pingo abierto.`));
                    }, 8000);
                    conn.on('open', () => { clearTimeout(timeout); resolve(); });
                    conn.on('error', (err) => { 
                        clearTimeout(timeout); 
                        reject(err && err.message ? err : new Error(`Error al conectar con ${contact.alias}`)); 
                    });
                    conn.on('close', () => {
                        clearTimeout(timeout);
                        reject(new Error(`Conexión cerrada con ${contact.alias}`));
                    });
                });
            }
            // Small delay to ensure auth exchange finishes
            await new Promise(r => setTimeout(r, 400));
            conn.send({ type: 'file-transfer', file: arrayBuffer, fileName: file.name, mimeType: file.type || 'application/json' });
            return true;
        }

        // Helper: delete the stored file and clean URL
        function clearSharedFile() {
            const req = indexedDB.open('pingo-share', 1);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains('files')) {
                    db.transaction('files', 'readwrite').objectStore('files').delete('shared-file');
                }
            };
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check if there are already open connections
        const openPeerIds = Object.keys(state.connections).filter(id => state.connections[id]?.open);

        if (openPeerIds.length > 0) {
            // Already connected — just confirm and send
            const confirmSend = confirm(`Has recibido: "${file.name}".\n¿Enviar a los contactos ya conectados (${openPeerIds.length})?`);
            if (confirmSend) {
                openPeerIds.forEach(id => sendToConnectedPeer(id));
                alert('Archivo enviado correctamente.');
            }
            clearSharedFile();
            return;
        }

        // No open connections — show a contact picker
        const agenda = state.agenda || [];
        if (agenda.length === 0) {
            alert(`Has recibido "${file.name}" pero no tienes contactos en la agenda. Añade uno primero.`);
            clearSharedFile();
            return;
        }

        // Build a native <dialog> picker
        const dialog = document.createElement('dialog');
        dialog.style.cssText = `
            border: none; border-radius: 16px; padding: 0; max-width: 340px; width: 90%;
            box-shadow: 0 8px 40px rgba(0,0,0,0.35); font-family: inherit;
            background: #1e1e2e; color: #cdd6f4;
        `;
        dialog.innerHTML = `
            <div style="padding:20px 20px 8px">
                <h3 style="margin:0 0 6px; font-size:1.1rem; color:#cba6f7;">📩 Archivo recibido</h3>
                <p style="margin:0 0 14px; font-size:.85rem; opacity:.75; word-break:break-all;">${file.name}</p>
                <p style="margin:0 0 12px; font-size:.9rem;">¿A quién quieres enviárselo?</p>
                <ul id="share-contact-list" style="list-style:none;padding:0;margin:0 0 14px;max-height:240px;overflow-y:auto;">
                    ${agenda.map((c, i) => `
                        <li>
                            <button data-index="${i}" style="
                                width:100%; text-align:left; padding:10px 12px; margin-bottom:6px;
                                background:#313244; border:none; border-radius:10px; color:#cdd6f4;
                                cursor:pointer; font-size:.95rem; display:flex; align-items:center; gap:10px;
                            ">
                                <span style="width:32px;height:32px;border-radius:50%;background:#7287fd;display:inline-flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">
                                    ${(c.alias||'?')[0].toUpperCase()}
                                </span>
                                ${c.alias || c.derivedId}
                            </button>
                        </li>
                    `).join('')}
                </ul>
                <button id="share-cancel-btn" style="
                    width:100%;padding:10px;background:transparent;border:1px solid #585b70;
                    border-radius:10px;color:#a6adc8;cursor:pointer;font-size:.9rem;margin-bottom:10px;
                ">Cancelar</button>
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();

        await new Promise((resolve) => {
            dialog.querySelector('#share-cancel-btn').addEventListener('click', () => {
                dialog.close();
                resolve(null);
            });
            dialog.querySelector('#share-contact-list').addEventListener('click', async (e) => {
                const btn = e.target.closest('button[data-index]');
                if (!btn) return;
                const contact = agenda[parseInt(btn.dataset.index)];
                dialog.close();

                // Show connecting feedback
                const statusMsg = document.createElement('div');
                statusMsg.style.cssText = `
                    position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
                    background:#313244;color:#cdd6f4;padding:12px 20px;border-radius:12px;
                    font-size:.9rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);
                `;
                statusMsg.textContent = `⏳ Conectando con ${contact.alias}...`;
                document.body.appendChild(statusMsg);

                try {
                    const ok = await connectAndSend(contact);
                    statusMsg.textContent = ok ? `✅ Enviado a ${contact.alias}` : `❌ No se pudo enviar`;
                    clearSharedFile();
                } catch (err) {
                    console.error('[Share] Connect+send failed:', err);
                    statusMsg.textContent = `❌ ${err.message || 'Error al conectar'}`;
                }
                setTimeout(() => statusMsg.remove(), 4500);
                resolve(contact);
            });
        });

        dialog.remove();

    } catch (err) {
        console.error('[Share] Error checking shared files:', err);
    }
}

function manageTabLock() {
    if (!navigator.locks) {
        console.warn('Web Locks API not supported. Multi-tab conflicts may occur.');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isShareReceived = urlParams.get('action') === 'share_received';

    // Initial check (don't disconnect if this tab was opened to receive a share)
    navigator.locks.query().then(query => {
        const isTaken = query.held.some(l => l.name === 'pingo_primary_tab');
        if (isTaken && !isShareReceived) {
            state.isPrimaryTab = false;
            updateMultiTabStatus();
            stopAllConnections();
        }
    });

    // Request the lock (will wait if taken)
    navigator.locks.request('pingo_primary_tab', async (lock) => {
        console.log('[Lock] Acquired primary tab lock.');
        state.isPrimaryTab = true;
        updateMultiTabStatus();
        
        // Re-enable connections if they were stopped
        ensureSignalingConnection();
        
        // Keep the lock alive forever for this tab
        await new Promise(() => {});
    });
}

async function registerPeriodicSync() {
    if ('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const status = await navigator.permissions.query({
                name: 'periodic-background-sync',
            });
            
            if (status.state === 'granted') {
                await registration.periodicSync.register('pingo-heartbeat', {
                    minInterval: 12 * 60 * 60 * 1000, // 12 hours
                });
                console.log('[SW] Periodic Sync registered.');
            }
        } catch (err) {
            console.error('[SW] Periodic Sync registration failed:', err);
        }
    }
}

// Global scope access for debugging if needed
window.pingo = { state, elements, VERSION };

init();

// Service worker registration handled by registerSW above
