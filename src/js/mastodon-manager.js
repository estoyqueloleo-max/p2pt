/**
 * Pingo - Mastodon & Fediverse Integration Manager
 * Handles ActivityPub sharing, route publishing and Web PWA client launching
 */

import { updateLocationStatus } from './utils.js';

const STORAGE_KEY = 'pingo_mastodon_config';

/**
 * Get current Mastodon configuration
 */
export function getMastodonConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (saved.instanceUrl) return saved;

        // Try to infer from appliance server config if present
        const srvConfig = JSON.parse(localStorage.getItem('pingo_server_config') || '{}');
        if (srvConfig.mastodon && srvConfig.mastodon.url) {
            return {
                instanceUrl: srvConfig.mastodon.url,
                token: saved.token || ''
            };
        }
        if (srvConfig.signaling && srvConfig.signaling.host && srvConfig.signaling.host !== 'localhost' && srvConfig.signaling.host !== 'peerjs-13sv.onrender.com') {
            const proto = srvConfig.signaling.secure ? 'https' : 'http';
            return {
                instanceUrl: `${proto}://${srvConfig.signaling.host}`,
                token: saved.token || ''
            };
        }

        // Default to current host
        return {
            instanceUrl: window.location.origin,
            token: saved.token || ''
        };
    } catch {
        return { instanceUrl: window.location.origin, token: '' };
    }
}

/**
 * Save Mastodon configuration
 */
export function saveMastodonConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.warn('[Mastodon] Failed to save config to localStorage:', e);
    }
}

/**
 * Open Mastodon PWA Client (Phanpy / Elk) connected to the instance
 * If connected to a Pingo appliance with GoToSocial, leverages /fediverse/sso for zero-click login
 * @param {string} [instanceUrl] Optional target instance
 */
export function openMastodonPWA(instanceUrl) {
    const config = getMastodonConfig();
    const rawTarget = instanceUrl || config.instanceUrl || window.location.origin;
    const cleanHost = rawTarget.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

    // Check if we have an active peer ID for zero-click SSO
    const srvConfig = JSON.parse(localStorage.getItem('pingo_server_config') || '{}');
    const myPeerId = srvConfig.peerId || localStorage.getItem('pingo_peer_id') || '';

    if (myPeerId && (rawTarget.includes('appliances.klitosan.com') || rawTarget.includes(window.location.host))) {
        // Direct zero-click SSO through appliance
        const ssoUrl = `${rawTarget.replace(/\/+$/, '')}/fediverse/sso?peerId=${encodeURIComponent(myPeerId)}`;
        window.open(ssoUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    // Standard fallback: Phanpy client connected to host
    const pwaUrl = `https://phanpy.social/#${cleanHost}`;
    window.open(pwaUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Format route metadata into a federated toot/status
 * @param {object} route Route object from state.routes
 */
export function formatRouteToot(route) {
    const name = route.name || 'Ruta sin nombre';
    const pts = route.stats?.points || (route.points ? route.points.length : 0);
    const date = route.timestamp ? new Date(route.timestamp).toLocaleDateString() : new Date().toLocaleDateString();
    const appUrl = window.location.origin;

    return `🌲 ¡Nueva ruta grabada con Pingo! 🚴‍♂️\n\n📍 "${name}"\n📊 Puntos GPS: ${pts}\n📅 Fecha: ${date}\n\nExplora el track o sincroniza en P2P:\n${appUrl}\n\n#pingo #senderismo #outdoor #gpx #tracks #fediverse #activitypub`;
}

/**
 * Publish status directly via Mastodon Client REST API (POST /api/v1/statuses)
 * @param {object} params
 * @param {string} params.instanceUrl
 * @param {string} params.token
 * @param {string} params.statusText
 * @param {string} [params.visibility] 'public', 'unlisted', 'private'
 */
export async function publishToot({ instanceUrl, token, statusText, visibility = 'public' }) {
    if (!instanceUrl) throw new Error('Se requiere la URL de la instancia de Mastodon');
    if (!token) throw new Error('Se requiere un Access Token con permisos "write:statuses"');
    if (!statusText || !statusText.trim()) throw new Error('El mensaje no puede estar vacío');

    const cleanBase = instanceUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBase}/api/v1/statuses`;

    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token.trim()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            status: statusText.trim(),
            visibility: visibility
        })
    });

    if (!resp.ok) {
        let errMsg = `Error HTTP ${resp.status}`;
        try {
            const errJson = await resp.json();
            if (errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
    }

    const data = await resp.json();
    return data;
}

/**
 * Open Web intent composer in instance or PWA
 */
export function openWebComposer(instanceUrl, statusText) {
    const cleanBase = (instanceUrl || getMastodonConfig().instanceUrl || window.location.origin).replace(/\/+$/, '');
    const cleanHost = cleanBase.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

    // Prefer Phanpy web composer or instance /share intent
    const encoded = encodeURIComponent(statusText);
    const intentUrl = `${cleanBase}/share?text=${encoded}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Open the Mastodon route sharing modal
 * @param {object} route
 */
export function openRouteMastodonShareModal(route) {
    const modal = document.getElementById('mastodon-share-modal');
    const textEl = document.getElementById('mastodon-toot-text');
    const instanceEl = document.getElementById('mastodon-instance-url');
    const tokenEl = document.getElementById('mastodon-access-token');

    if (!modal || !textEl) {
        console.warn('[Mastodon] Modal elements not found in DOM');
        return;
    }

    const config = getMastodonConfig();
    const formatted = formatRouteToot(route);

    textEl.value = formatted;
    if (instanceEl) instanceEl.value = config.instanceUrl || window.location.origin;
    if (tokenEl) tokenEl.value = config.token || '';

    const credsBox = document.getElementById('mastodon-creds-box');
    const emailEl = document.getElementById('mastodon-cred-email');
    const passEl = document.getElementById('mastodon-cred-pass');
    if (credsBox && emailEl && passEl) {
        if (config.email && config.initialPassword) {
            emailEl.textContent = config.email;
            passEl.textContent = config.initialPassword;
            credsBox.style.display = 'block';
        } else {
            credsBox.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
}
