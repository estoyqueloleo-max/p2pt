/**
 * Pingo - Geolocation Management
 */

import { state, elements } from './state.js';
import { 
    REFRESH_RATE_FG, REFRESH_RATE_BG, BURST_DURATION, 
    STATIONARY_THRESHOLD, MAX_STATIONARY_TIME 
} from './constants.js';
import { calculateDistance } from './utils.js';
import { updateMyMarker } from './map-manager.js';

window.addEventListener('p2pt:manual-location', (e) => {
    const { lat, lng } = e.detail;
    state.myCoords = { lat, lng, accuracy: 10 }; // Manual is assumed accurate enough
    
    // Broadcast immediately
    const now = Date.now();
    const dist = state.lastBroadcastCoords.lat !== 0 ? 
        calculateDistance(lat, lng, state.lastBroadcastCoords.lat, state.lastBroadcastCoords.lng) : 100;

    // Use a custom event or direct call to main.js's broadcast logic if possible
    // For now, we manually trigger the update if onLocationUpdate is available
    // (We'll re-bind this in initGeolocation)
});

export function initGeolocation(onLocationUpdate, onLocationError) {
    if (!navigator.geolocation) {
        if (onLocationError) onLocationError('Geolocalización no soportada');
        return;
    }

    // 1. Try to get a cached position immediately for a faster cold start
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            if (state.myCoords.lat === 0) {
                console.log(`[Geo] Cached position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Acc: ${accuracy.toFixed(1)}m)`);
                state.myCoords = { lat: latitude, lng: longitude, accuracy: accuracy };
                updateMyMarker(latitude, longitude);
                
                // If we already have connections, send this cached location immediately
                if (onLocationUpdate) {
                    onLocationUpdate(latitude, longitude, 0);
                    state.lastBroadcastTime = Date.now();
                    state.lastBroadcastCoords = { lat: latitude, lng: longitude };
                }
            }
        },
        (err) => console.log('[Geo] No cached position available:', err.message),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
    );

    let watchId = null;
    let locationUpdateFn = onLocationUpdate;

    // Register manual update logic with the current callback
    const manualHandler = (e) => {
        const { lat, lng } = e.detail;
        if (locationUpdateFn) locationUpdateFn(lat, lng, 100);
    };
    window.addEventListener('p2pt:manual-location', manualHandler);

    let lastUpdateTimestamp = Date.now();

    const startWatching = (highAccuracy = true) => {
        const geoOptions = {
            enableHighAccuracy: highAccuracy,
            timeout: 20000, // Increased timeout to avoid frequent flakes
            maximumAge: highAccuracy ? 0 : 60000
        };

        if (watchId) navigator.geolocation.clearWatch(watchId);

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                lastUpdateTimestamp = Date.now();
                
                const posKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
                if (state.lastGeoPos !== posKey) {
                    console.log(`[Geo] Update: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Acc: ${accuracy.toFixed(1)}m, High: ${highAccuracy})`);
                    state.lastGeoPos = posKey;
                }
                
                state.myCoords = { lat: latitude, lng: longitude, accuracy: accuracy };
                updateMyMarker(latitude, longitude);

                // Hide manual button if we get a real fix
                if (elements.manualLocationBtn) elements.manualLocationBtn.style.display = 'none';

                const now = Date.now();

                // Only process updates in primary tab
                if (!state.isPrimaryTab) return;

                let rate = state.isAppInBackground ? REFRESH_RATE_BG : REFRESH_RATE_FG;

                if (now - state.appStartTime < BURST_DURATION) {
                    rate = REFRESH_RATE_FG;
                }

                const timeSinceLast = now - state.lastBroadcastTime;
                if (timeSinceLast >= rate) {
                    const dist = calculateDistance(latitude, longitude, state.lastBroadcastCoords.lat, state.lastBroadcastCoords.lng);
                    
                    if (dist > STATIONARY_THRESHOLD || state.lastBroadcastCoords.lat === 0 || timeSinceLast > MAX_STATIONARY_TIME) {
                        if (locationUpdateFn) locationUpdateFn(latitude, longitude, dist);
                        state.lastBroadcastTime = now;
                        state.lastBroadcastCoords = { lat: latitude, lng: longitude };
                    }
                }
            },
            (error) => {
                const now = Date.now();
                const errorKey = `geo-${error.code}-${error.message}`;
                
                if (state.lastGeoError !== errorKey || (now - state.lastGeoErrorTime > 30000)) {
                    console.warn(`[Geo] ${highAccuracy ? 'High' : 'Low'} Accuracy Error:`, error.message || 'Error de red/sensores');
                    state.lastGeoError = errorKey;
                    state.lastGeoErrorTime = now;
                }
                
                // Show manual button on ANY error to help user
                if (elements.manualLocationBtn) elements.manualLocationBtn.style.display = 'inline-block';

                // Fallback on ANY High Accuracy error for maximum resilience
                if (highAccuracy) {
                    console.log('[Geo] Switching to Low Accuracy fallback...');
                    startWatching(false);
                } else if (onLocationError) {
                    onLocationError(error);
                }
            },
            geoOptions
        );
    };

    // Watchdog: If no updates for 2 minutes and in foreground, restart
    setInterval(() => {
        if (!state.isAppInBackground && (Date.now() - lastUpdateTimestamp > 120000)) {
            console.warn('[Geo] Watchdog: No updates for 2 mins. Restarting...');
            startWatching(true);
        }
    }, 60000);

    // Foreground recovery
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('[Geo] Foreground detected. Requesting immediate fix...');
            // One-shot fix but also restart watch to ensure high accuracy
            if (!state.isPrimaryTab) return;
            
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    updateMyMarker(latitude, longitude);
                    if (locationUpdateFn) locationUpdateFn(latitude, longitude, 0);
                },
                null,
                { enableHighAccuracy: true, timeout: 10000 }
            );
            startWatching(true);
        }
    });

    startWatching(true);
}
