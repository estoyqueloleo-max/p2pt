/**
 * Pingo - Map Management
 */

import L from 'leaflet';
import { state } from './state.js';
import { TRAIL_MAX_POINTS, TRAIL_MIN_OPACITY } from './constants.js';
import { getPeerColor } from './utils.js';

export function initMap() {
    state.map = L.map('map', {
        zoomControl: false,
        attributionControl: false,
        maxZoom: 20
    }).setView([40.4168, -3.7038], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        maxNativeZoom: 19
    }).addTo(state.map);

    const myIcon = L.divIcon({
        className: 'my-location-marker',
        html: '<div class="pulse"></div>',
        iconSize: [20, 20]
    });

    state.myMarker = L.marker([0, 0], { icon: myIcon }).addTo(state.map);

    state.map.on('movestart', (e) => {
        if (e.hard) return;
        state.autoFollow = false;
    });

    state.map.on('click', (e) => {
        if (state.manualLocationMode) {
            const { lat, lng } = e.latlng;
            console.log(`[Map] Manual location set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            updateMyMarker(lat, lng);
            // Dispatch event for geo-manager/main to broadcast
            window.dispatchEvent(new CustomEvent('p2pt:manual-location', { detail: { lat, lng } }));
        }
    });
}

export function updateMyMarker(lat, lng) {
    const newLatLng = new L.LatLng(lat, lng);
    state.myMarker.setLatLng(newLatLng);
    updateTrail('me', lat, lng, state.isRecording);

    if (state.firstFix || (state.autoFollow && Object.keys(state.otherMarkers).length === 0)) {
        state.map.panTo(newLatLng);
        state.firstFix = false;
    }
}

export function updatePeerMarker(peerId, lat, lng, alias) {
    const labelText = alias || `Pingo ${peerId}`;

    if (!state.otherMarkers[peerId]) {
        const otherIcon = L.divIcon({
            className: 'other-location-marker',
            html: `<div class="marker-pin" style="background: ${getPeerColor(peerId)}"></div><span class="label">${labelText}</span>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42]
        });

        state.otherMarkers[peerId] = L.marker([lat, lng], { icon: otherIcon }).addTo(state.map);
        fitMapBounds();
    } else {
        state.otherMarkers[peerId].setLatLng([lat, lng]);
        const labelEl = state.otherMarkers[peerId].getElement()?.querySelector('.label');
        if (labelEl) labelEl.textContent = labelText;
    }
}

export function removePeerMarker(peerId) {
    if (state.otherMarkers[peerId]) {
        state.map.removeLayer(state.otherMarkers[peerId]);
        delete state.otherMarkers[peerId];

        if (state.trailLayers[peerId]) {
            state.map.removeLayer(state.trailLayers[peerId]);
            delete state.trailLayers[peerId];
            delete state.locationHistory[peerId];
        }

        fitMapBounds();
    }
}

export function updateTrail(peerId, lat, lng, isRecording = false) {
    if (!state.map) return;

    if (!state.locationHistory[peerId]) {
        state.locationHistory[peerId] = [];
    }

    state.locationHistory[peerId].push({ lat, lng });

    // If recording, we keep much more history to show the whole route
    const maxPoints = isRecording ? 500 : TRAIL_MAX_POINTS;

    if (state.locationHistory[peerId].length > maxPoints) {
        state.locationHistory[peerId].shift();
    }

    if (state.trailLayers[peerId]) {
        state.map.removeLayer(state.trailLayers[peerId]);
    }

    state.trailLayers[peerId] = L.layerGroup().addTo(state.map);

    const count = state.locationHistory[peerId].length;
    state.locationHistory[peerId].forEach((point, index) => {
        if (index === count - 1) return;

        const progress = (index + 1) / count;
        const radius = 2 + (progress * 4);
        const opacity = TRAIL_MIN_OPACITY + (progress * (0.4 - TRAIL_MIN_OPACITY));

        L.circleMarker([point.lat, point.lng], {
            radius: radius,
            color: 'transparent',
            fillColor: getPeerColor(peerId),
            fillOpacity: opacity * 1.5,
            className: 'trail-dot',
            interactive: false
        }).addTo(state.trailLayers[peerId]);
    });
}

export function fitMapBounds() {
    if (!state.map) return;
    const markers = [state.myMarker.getLatLng()];
    Object.values(state.otherMarkers).forEach(m => markers.push(m.getLatLng()));

    if (markers.length > 1 && state.autoFollow) {
        const bounds = L.latLngBounds(markers);
        state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
}

export function updateGeofenceCircle() {
    if (state.geofenceEnabled && state.geofenceCenter) {
        if (!state.geofenceCircle) {
            state.geofenceCircle = L.circle(state.geofenceCenter, {
                radius: state.geofenceRadius,
                color: '#6366f1',
                fillColor: '#6366f1',
                fillOpacity: 0.1,
                dashArray: '5, 10'
            }).addTo(state.map);
        } else {
            state.geofenceCircle.setLatLng(state.geofenceCenter);
            state.geofenceCircle.setRadius(state.geofenceRadius);
        }
    } else if (state.geofenceCircle) {
        state.map.removeLayer(state.geofenceCircle);
        state.geofenceCircle = null;
    }
}

/**
 * Render a saved route on the map
 * @param {object} route 
 */
export function renderRoute(route) {
    if (!state.map || !route || !route.points) return;

    if (state.routeLayers[route.id]) {
        state.map.removeLayer(state.routeLayers[route.id]);
    }

    const latlngs = route.points.map(p => [p.lat, p.lng]);
    const polyline = L.polyline(latlngs, {
        color: '#10b981', // Emerald
        weight: 4,
        opacity: 0.8,
        lineJoin: 'round'
    });

    state.routeLayers[route.id] = polyline.addTo(state.map);
    
    // Zoom to route
    const bounds = polyline.getBounds();
    state.map.fitBounds(bounds, { padding: [40, 40] });
}

/**
 * Remove a route layer from map
 */
export function clearRoute(routeId) {
    if (state.routeLayers[routeId]) {
        state.map.removeLayer(state.routeLayers[routeId]);
        delete state.routeLayers[routeId];
    }
}

/**
 * Update the visual path of the currently recording session
 */
export function updateRecordingPath() {
    if (!state.map || !state.isRecording || state.recordingPoints.length < 2) {
        if (state.routeLayers['active-rec']) {
            state.map.removeLayer(state.routeLayers['active-rec']);
            delete state.routeLayers['active-rec'];
        }
        return;
    }

    const latlngs = state.recordingPoints.map(p => [p.lat, p.lng]);
    
    if (!state.routeLayers['active-rec']) {
        state.routeLayers['active-rec'] = L.polyline(latlngs, {
            color: '#f59e0b', // Amber
            weight: 5,
            dashArray: '5, 10',
            opacity: 0.7
        }).addTo(state.map);
    } else {
        state.routeLayers['active-rec'].setLatLngs(latlngs);
    }
}
