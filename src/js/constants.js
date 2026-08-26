/**
 * Pingo - Constants & Configuration
 */

export const VERSION = 79;

const isLocalHost = import.meta.env.VITE_PEER_HOST === 'localhost' || import.meta.env.VITE_PEER_HOST === '127.0.0.1';

export const DEFAULT_STUN_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.services.mozilla.com" },
    { urls: "stun:stun.voipstunt.com" },
    { urls: "stun:stun.xten.com" },
    { urls: "stun:stun.sipgate.net:10000" },
    { urls: "stun:stun.ideasip.com" },
    { urls: "stun:stun.schlund.de" }
];

export const DEFAULT_SERVER_CONFIG = {
    signaling: {
        host: import.meta.env.VITE_PEER_HOST || 'peerjs-server.accreativos.com',
        port: import.meta.env.VITE_PEER_PORT ? parseInt(import.meta.env.VITE_PEER_PORT, 10) : 443,
        path: import.meta.env.VITE_PEER_PATH || '/',
        secure: import.meta.env.VITE_PEER_SECURE !== undefined ? import.meta.env.VITE_PEER_SECURE === 'true' : true,
        key: 'peerjs'
    },
    turn: {
        urls: [], // Custom TURN URLs if specified manually, e.g. ["turn:192.168.1.50:3478?transport=udp"]
        username: '',
        credential: ''
    },
    cloud: {
        enabled: import.meta.env.VITE_CLOUD_ENABLED === 'true',
        apiEndpoint: import.meta.env.VITE_CLOUD_API_ENDPOINT || 'https://pingo-cloud.accreativos.com',
        turnCredentialsPath: import.meta.env.VITE_CLOUD_TURN_PATH || '/turn-credentials'
    }
};

export function getServerConfig() {
    try {
        const stored = localStorage.getItem('pingo_server_config');
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                signaling: { ...DEFAULT_SERVER_CONFIG.signaling, ...(parsed.signaling || {}) },
                turn: { ...DEFAULT_SERVER_CONFIG.turn, ...(parsed.turn || {}) },
                cloud: { ...DEFAULT_SERVER_CONFIG.cloud, ...(parsed.cloud || {}) }
            };
        }
    } catch (e) {
        console.warn('[Config] Error reading pingo_server_config from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SERVER_CONFIG));
}

export function saveServerConfig(config) {
    try {
        localStorage.setItem('pingo_server_config', JSON.stringify(config));
        return true;
    } catch (e) {
        console.error('[Config] Error saving pingo_server_config:', e);
        return false;
    }
}

export function resetServerConfig() {
    try {
        localStorage.removeItem('pingo_server_config');
        return true;
    } catch (e) {
        console.error('[Config] Error resetting pingo_server_config:', e);
        return false;
    }
}

export function getActivePeerConfig() {
    const config = getServerConfig();
    const isLocal = config.signaling.host === 'localhost' || config.signaling.host === '127.0.0.1';

    const iceServers = isLocal ? [] : [...DEFAULT_STUN_SERVERS];

    // Add manual TURN server if configured
    if (config.turn && config.turn.urls && config.turn.urls.length > 0) {
        const turnEntry = { urls: config.turn.urls };
        if (config.turn.username) turnEntry.username = config.turn.username;
        if (config.turn.credential) turnEntry.credential = config.turn.credential;
        iceServers.push(turnEntry);
    }

    return {
        host: config.signaling.host,
        port: config.signaling.port,
        path: config.signaling.path,
        secure: config.signaling.secure,
        key: config.signaling.key || 'peerjs',
        config: {
            iceServers: iceServers
        }
    };
}

export const PEER_CONFIG = getActivePeerConfig();

export const CLOUD_CONFIG = {
    get enabled() { return getServerConfig().cloud.enabled; },
    get apiEndpoint() { return getServerConfig().cloud.apiEndpoint; },
    get turnCredentialsPath() { return getServerConfig().cloud.turnCredentialsPath; }
};

// --- Refresh Rates & Trails ---
export const REFRESH_RATE_FG = 5000;   // 5s (foreground)
export const REFRESH_RATE_BG = 60000;  // 1min (background)
export const BURST_DURATION = 300000; // 5min initial burst
export const STATIONARY_THRESHOLD = 5; // meters
export const MAX_STATIONARY_TIME = 600000; // 10min forced update even if stationary

export const TRAIL_MAX_POINTS = 25;
export const TRAIL_MIN_OPACITY = 0.2;
