/**
 * Pingo - Main Entry Point
 */

import 'leaflet/dist/leaflet.css';
import '../style.css';
import { state, elements } from './state.js';
import { VERSION } from './constants.js';
import { initMap } from './map-manager.js';
import { initGeolocation } from './geo-manager.js';
import { initPeer, broadcastLocation, handleIncomingConnection, stopAllConnections, ensureSignalingConnection } from './peer-manager.js';
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

        console.log('Pingo initialized successfully.');
    } catch (err) {
        console.error('Initialization Error:', err);
        updateLocationStatus('Error al iniciar la App', 'fa-circle-exclamation');
    }
}

function manageTabLock() {
    if (!navigator.locks) {
        console.warn('Web Locks API not supported. Multi-tab conflicts may occur.');
        return;
    }

    // Initial check
    navigator.locks.query().then(query => {
        const isTaken = query.held.some(l => l.name === 'pingo_primary_tab');
        if (isTaken) {
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
