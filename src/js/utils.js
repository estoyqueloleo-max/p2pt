/**
 * P2PT - Utility Functions
 */

import { state, elements } from './state.js';

export function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === 0 || lat2 === 0) return 9999;
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
}

export async function derivePeerId(phrase, salt) {
    if (!phrase) return null;
    try {
        const encoder = new TextEncoder();
        const phraseBuf = encoder.encode(phrase);
        const saltBuf = encoder.encode(salt || 'pingo-default-salt');

        const baseKey = await window.crypto.subtle.importKey(
            'raw', phraseBuf, { name: 'PBKDF2' }, false, ['deriveBits']
        );

        const bits = await window.crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
            baseKey, 32
        );

        const view = new DataView(bits);
        const num = view.getUint32(0) % 100000000;
        return num.toString().padStart(8, '0');
    } catch (err) {
        console.error('Crypto error:', err);
        return null;
    }
}

export async function generateAuthToken(salt, myIdentitySalt) {
    const s = salt !== undefined ? salt : myIdentitySalt;
    if (!s) return 'public';
    try {
        const encoder = new TextEncoder();
        const date = new Date();
        const timeKey = date.getUTCFullYear() + '-' + date.getUTCMonth() + '-' + date.getUTCDate() + '-' + date.getUTCHours();
        const message = encoder.encode(s + timeKey);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', message);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
        return 'error';
    }
}
export function getPeerColor(peerId) {
    if (peerId === 'me') return '#6366f1'; // Indigo-500
    
    // Simple hash to HSL
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const h = Math.abs(hash % 360);
    // Prefer vibrant colors: Saturation 70-90%, Lightness 50-65%
    return `hsl(${h}, 80%, 60%)`;
}

export function updateLocationStatus(text, iconClass) {
    if (elements.locationStatus) {
        elements.locationStatus.innerHTML = `<i class="fas ${iconClass}"></i> ${text}`;
    }
}
