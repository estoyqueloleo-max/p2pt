import { VERSION } from './js/constants.js';

const PUSH_CONFIG = {
    VAPID_PUBLIC_KEY: 'BLOuOmoSzI1ANUpUiTEVkEnBYfszZDPVgfiCgViC1EsMc3FULxsIaM3z4yFb74qthwL0b3LJt0YWySoJTSIe7Os',
    PUSH_API_ENDPOINT: 'https://backend.estoyqueloleo.workers.dev/push/subscribe',
    PUSH_SEND_ENDPOINT: 'https://backend.estoyqueloleo.workers.dev/push/send'
};

/**
 * Helper: Convert Base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
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
function arrayBufferToBase64Url(buffer) {
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
 * Initialize Push Notifications
 * @param {string} myPeerId - The ID of the current user
 * @param {function} onStatusChange - Callback for UI updates
 */
export async function initPushNotifications(myPeerId, onStatusChange = console.log) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        onStatusChange('Notificaciones no soportadas', 'fa-circle-exclamation');
        return;
    }

    try {
        console.log('[Push] Esperando a que el Service Worker esté ready...');
        const registration = await navigator.serviceWorker.ready;
        console.log('[Push] Service Worker ready:', registration);

        // Wait for it to be active (with a 5s timeout safety)
        if (!registration.active || !navigator.serviceWorker.controller) {
            console.log('[Push] SW no activo o sin controlador, esperando...');
            onStatusChange('Activando...', 'fa-spinner fa-spin');
            await new Promise((resolve) => {
                let timeout = setTimeout(() => {
                    console.warn('[Push] SW controller check timed out.');
                    clearInterval(interval);
                    resolve();
                }, 5000);

                const interval = setInterval(() => {
                    if (navigator.serviceWorker.controller) {
                        console.log('[Push] SW controlador detectado!');
                        clearInterval(interval);
                        clearTimeout(timeout);
                        resolve();
                    }
                }, 200);
            });
        }

        console.log('[Push] Comprobando suscripción existente...');
        onStatusChange('Obteniendo suscripción...', 'fa-spinner fa-spin');
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            console.log('[Push] No hay suscripción, solicitando nueva con llave pública:', PUSH_CONFIG.VAPID_PUBLIC_KEY);
            onStatusChange('Solicitando permiso...', 'fa-bell');
            const options = {
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.VAPID_PUBLIC_KEY)
            };
            subscription = await registration.pushManager.subscribe(options);
            console.log('[Push] Suscripción creada con éxito:', subscription);
            onStatusChange('Suscripción Creada', 'fa-check');
        } else {
            console.log('[Push] Suscripción existente encontrada:', subscription);
        }

        await subscribeToPushBackend(myPeerId, subscription, onStatusChange);
    } catch (err) {
        console.error('[Push] Error crítico en initPushNotifications:', err);
        onStatusChange(`Error: ${err.message}`, 'fa-triangle-exclamation');
    }
}

/**
 * Send Subscription to Backend
 */
async function subscribeToPushBackend(myPeerId, subscription, onStatusChange) {
    if (!myPeerId) {
        onStatusChange('Peer ID requerido para suscribirse', 'fa-fingerprint');
        return;
    }

    const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(subscription.getKey('auth'));

    const { state } = await import('./js/state.js');

    const payload = {
        userPublicKey: myPeerId,
        salt: state.myIdentity.salt, // Necessary for TURN authentication
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: { p256dh, auth }
    };

    try {
        const response = await fetch(PUSH_CONFIG.PUSH_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            onStatusChange('Notificaciones Activadas ✅', 'fa-bell');
        } else {
            onStatusChange(`Error Backend: ${response.status}`, 'fa-circle-exclamation');
        }
    } catch (err) {
        onStatusChange('Error de conexión con el backend', 'fa-circle-exclamation');
    }
}

/**
 * Send a Push Notification (Ping) to another peer
 */
export async function sendPushPing(targetId, myAlias = 'Alguien', targetAlias = 'amigo') {
    const { state } = await import('./js/state.js');
    const title = '¡Pingo! 🔔';
    const body = `Hola ${targetAlias}, soy ${myAlias}. ¿Hablamos por el chat?`;

    // El receptor debe conectar con el emisor (state.myPeerId)
    const url = `${window.location.origin}${window.location.pathname}?pingo=${state.myPeerId}&chat=1`;

    try {
        const { generateAuthToken } = await import('./js/utils.js');
        const token = await generateAuthToken(state.myIdentity.salt);

        console.log(`[Push] Enviando aviso a ${targetId} (${targetAlias})`);
        const response = await fetch(`${PUSH_CONFIG.PUSH_SEND_ENDPOINT}/${targetId}?from=${state.myPeerId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-P2PT-Auth': token
            },
            body: JSON.stringify({ title, body, url })
        });
        return response.ok;
    } catch (err) {
        console.error('Send Push Error:', err);
        return false;
    }
}
