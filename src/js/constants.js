/**
 * P2PT - Constants & Configuration
 */

export const VERSION = 77;

export const PEER_CONFIG = {
    host: 'peerjs-13sv.onrender.com',
    port: 443,
    path: '/myapp',
    secure: true,
    proxied: true,
    config: {
        iceServers: [
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
        ]
    }
};

export const CLOUD_CONFIG = {
    enabled: false, // Default: Off
    apiEndpoint: 'https://backend.estoyqueloleo.workers.dev',
    turnCredentialsPath: '/turn-credentials'
};

// --- Refresh Rates & Trails ---
export const REFRESH_RATE_FG = 5000;   // 5s (foreground)
export const REFRESH_RATE_BG = 60000;  // 1min (background)
export const BURST_DURATION = 300000; // 5min initial burst
export const STATIONARY_THRESHOLD = 5; // meters
export const MAX_STATIONARY_TIME = 600000; // 10min forced update even if stationary

export const TRAIL_MAX_POINTS = 25;
export const TRAIL_MIN_OPACITY = 0.2;
