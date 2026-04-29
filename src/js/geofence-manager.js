/**
 * Pingo - Geofencing Logic
 */

import { state, elements } from './state.js';
import { calculateDistance, updateLocationStatus } from './utils.js';
import { updateGeofenceCircle } from './map-manager.js';

export function checkGeofence() {
    if (!state.geofenceEnabled || !state.geofenceCenter || !state.myCoords.lat) return;

    const dist = calculateDistance(
        state.myCoords.lat, state.myCoords.lng,
        state.geofenceCenter[0], state.geofenceCenter[1]
    );

    const isInside = dist <= state.geofenceRadius;
    const status = isInside ? 'inside' : 'outside';

    if (status !== state.lastGeofenceStatus) {
        const msg = isInside ? '✅ Has entrado en la zona segura' : '⚠️ ¡Has salido de la zona segura!';
        triggerLocalAlert(msg);
        state.lastGeofenceStatus = status;

        // Notify all peers about geofence breach
        Object.values(state.connections).forEach(conn => {
            if (conn.open) {
                conn.send({ type: 'alert', message: msg });
            }
        });
    }
}

export async function checkRemoteGeofence(peerId, lat, lng) {
    const contact = state.agenda.find(c => c.derivedId === peerId);
    if (!contact || !contact.geofenceEnabled || !contact.geofenceCenter) return;

    const dist = calculateDistance(lat, lng, contact.geofenceCenter[0], contact.geofenceCenter[1]);
    const isInside = dist <= (contact.geofenceRadius || state.geofenceRadius);

    if (isInside !== contact.lastInside) {
        const msg = isInside ? `✅ ${contact.alias} ha vuelto a su zona segura` : `⚠️ ¡Alerta! ${contact.alias} ha salido de su zona segura`;
        triggerLocalAlert(msg);
        contact.lastInside = isInside;
    }
}

export async function triggerLocalAlert(message) {
    updateLocationStatus(message, 'fa-bell');

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const registration = await navigator.serviceWorker.ready;
            registration.showNotification('Pingo - Alerta Familiar', {
                body: message,
                icon: 'https://cdn-icons-png.flaticon.com/512/1865/1865269.png',
                vibrate: [200, 100, 200]
            });
        } catch (e) {
            console.error('Notification error:', e);
            alert(message);
        }
    } else {
        alert(message);
    }
}

export function saveGeofenceState() {
    localStorage.setItem('pingo_geofence_enabled', state.geofenceEnabled);
    localStorage.setItem('pingo_geofence_radius', state.geofenceRadius);
    if (state.geofenceCenter) {
        localStorage.setItem('pingo_geofence_center', JSON.stringify(state.geofenceCenter));
    }
}

export function loadGeofenceState() {
    const savedEnabled = localStorage.getItem('pingo_geofence_enabled');
    const savedRadius = localStorage.getItem('pingo_geofence_radius');
    const savedCenter = localStorage.getItem('pingo_geofence_center');

    if (savedEnabled !== null) {
        state.geofenceEnabled = savedEnabled === 'true';
        if (elements.geofenceToggle) elements.geofenceToggle.checked = state.geofenceEnabled;
    }
    if (savedRadius !== null) {
        state.geofenceRadius = parseInt(savedRadius);
        if (elements.geofenceRadius) elements.geofenceRadius.value = state.geofenceRadius;
        if (elements.geofenceRadiusVal) elements.geofenceRadiusVal.innerText = state.geofenceRadius;
    }
    if (savedCenter !== null) {
        state.geofenceCenter = JSON.parse(savedCenter);
    }
    updateGeofenceCircle();
}
