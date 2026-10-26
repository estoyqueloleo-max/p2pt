import { VERSION, CLOUD_CONFIG, getServerConfig, saveServerConfig } from './js/constants.js';

export const PUSH_CONFIG = {
    get BASE_ENDPOINT() {
        return (CLOUD_CONFIG.apiEndpoint || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CLOUD_API_ENDPOINT) || '').replace(/\/+$/, '');
    },
    get VAPID_PUBLIC_KEY() {
        return CLOUD_CONFIG.vapidPublicKey || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY) || '';
    },
    get PUSH_API_ENDPOINT() {
        const base = this.BASE_ENDPOINT || 'https://pingo.appliances.klitosan.com';
        return `${base}/push/subscribe`;
    },
    get PUSH_SEND_ENDPOINT() {
        const base = this.BASE_ENDPOINT || 'https://pingo.appliances.klitosan.com';
        return `${base}/push/send`;
    }
};

const DEFAULT_FALLBACK_VAPID_KEY = 'BEJ45uzzL_hw2MpJaxTw8Jwk-hbqJE3D5GI7TWMBaYOLkKoVsJQJGVZrpDOASMBpsCpF3bFI2LFZaZecqAWfAKk';

/**
 * Helper: Convert Base64 URL to Uint8Array
 */
export function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

/**
 * Helper: Convert ArrayBuffer to Base64 URL
 */
export function arrayBufferToBase64Url(buffer) {
    if (!buffer) return "";
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Fetch dynamic VAPID public key from backend if not already stored
 */
export async function getOrFetchVAPIDPublicKey() {
    let key = PUSH_CONFIG.VAPID_PUBLIC_KEY;
    if (key) return key;

    const base = PUSH_CONFIG.BASE_ENDPOINT;
    if (base) {
        try {
            const resp = await fetch(`${base}/push/vapid-public-key`);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.vapidPublicKey) {
                    key = data.vapidPublicKey;
                    const cfg = getServerConfig();
                    cfg.cloud = cfg.cloud || {};
                    cfg.cloud.vapidPublicKey = key;
                    saveServerConfig(cfg);
                    console.log('[Push] Clave VAPID pública obtenida dinámicamente del backend:', key.slice(0, 12) + '...');
                    return key;
                }
            }
        } catch (e) {
            console.warn('[Push] No se pudo obtener la clave VAPID desde el endpoint:', e.message);
        }
    }

    return DEFAULT_FALLBACK_VAPID_KEY;
}

/**
 * Initialize Push Notifications
 * @param {string} myPeerId - The ID of the current user
 * @param {function} onStatusChange - Callback for UI updates
 */
export async function initPushNotifications(myPeerId, onStatusChange = console.log) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        onStatusChange('Notificaciones no soportadas', 'fa-circle-exclamation');
        return null;
    }

    try {
        console.log('[Push] Esperando a que el Service Worker esté ready...');
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] Service Worker ready:', registration);

        const vapidKey = await getOrFetchVAPIDPublicKey();
        console.log('[Push] Clave VAPID activa:', vapidKey.slice(0, 12) + '...');

        // Validar permisos de notificación en el navegador
        if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'default') {
                console.log('[Push] Solicitando permiso de notificaciones...');
                onStatusChange('Solicitando permiso...', 'fa-bell');
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') {
                    onStatusChange('Permiso no concedido', 'fa-bell-slash');
                    return null;
                }
            } else if (Notification.permission === 'denied') {
                onStatusChange('Notificaciones bloqueadas', 'fa-bell-slash');
                return null;
            }
        }

        onStatusChange('Obteniendo suscripción...', 'fa-spinner fa-spin');
        let subscription = await registration.pushManager.getSubscription();

        // Validar si la suscripción existente concuerda con la clave VAPID del appliance
        if (subscription) {
            const rawKey = subscription.options && subscription.options.applicationServerKey;
            if (rawKey) {
                const currentKeyBase64 = arrayBufferToBase64Url(rawKey);
                if (currentKeyBase64 !== vapidKey) {
                    console.log('[Push] Clave VAPID desactualizada en suscripción existente, renovando...');
                    try {
                        await subscription.unsubscribe();
                        subscription = null;
                    } catch (e) {
                        console.warn('[Push] Error al desuscribir suscripción obsoleta:', e);
                    }
                }
            }
        }

        if (!subscription) {
            console.log('[Push] Creando nueva suscripción con clave VAPID...');
            onStatusChange('Creando suscripción...', 'fa-spinner fa-spin');
            const options = {
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            };
            subscription = await registration.pushManager.subscribe(options);
            console.log('[Push] Suscripción creada con éxito:', subscription.endpoint);
        } else {
            console.log('[Push] Suscripción existente reutilizada:', subscription.endpoint);
        }

        await subscribeToPushBackend(myPeerId, subscription, onStatusChange);
        return subscription;
    } catch (err) {
        console.error('[Push] Error en initPushNotifications:', err);
        onStatusChange(`Error Push: ${err.message}`, 'fa-triangle-exclamation');
        return null;
    }
}

/**
 * Send Subscription to Backend
 */
export async function subscribeToPushBackend(myPeerId, subscription, onStatusChange = console.log) {
    if (!myPeerId) {
        onStatusChange('Peer ID requerido para suscribirse', 'fa-fingerprint');
        return false;
    }

    const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(subscription.getKey('auth'));

    const { state } = await import('./js/state.js');
    
    const payload = {
        userPublicKey: myPeerId,
        salt: state.myIdentity ? state.myIdentity.salt : '',
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime || null,
        keys: { p256dh, auth }
    };

    try {
        const response = await fetch(PUSH_CONFIG.PUSH_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            onStatusChange('Notificaciones Push Activadas ✅', 'fa-bell');
            return true;
        } else {
            onStatusChange(`Error Backend: ${response.status}`, 'fa-circle-exclamation');
            return false;
        }
    } catch (err) {
        console.warn('[Push] Error de conexión con backend:', err.message);
        onStatusChange('Error conectando con Gateway Push', 'fa-circle-exclamation');
        return false;
    }
}

/**
 * Send a Push Notification (Ping) to another peer
 */
export async function sendPushPing(targetId, myAlias = 'Un Pingo', targetAlias = 'amigo') {
    if (!targetId) return false;
    const { state } = await import('./js/state.js');
    const title = '¡Pingo! 🔔';
    const body = `Hola ${targetAlias}, soy ${myAlias}. ¿Hablamos por el chat?`;
    
    // El receptor debe conectar con el emisor (state.myPeerId)
    const url = `${window.location.origin}${window.location.pathname}?pingo=${state.myPeerId}&chat=1`;

    try {
        const { generateAuthToken } = await import('./js/utils.js');
        const token = state.myIdentity ? await generateAuthToken(state.myIdentity.salt) : 'public';

        console.log(`[Push] Enviando aviso push a ${targetId} (${targetAlias})`);
        const response = await fetch(`${PUSH_CONFIG.PUSH_SEND_ENDPOINT}/${targetId}?from=${state.myPeerId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Pingo-Auth': token
            },
            body: JSON.stringify({ title, body, url })
        });
        return response.ok;
    } catch (err) {
        console.error('[Push] Send Push Error:', err);
        return false;
    }
}
