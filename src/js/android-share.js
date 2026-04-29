/**
 * Pingo - Android Share Intent Handler
 */

import { handlePeerData } from './peer-manager.js';
import { updateLocationStatus } from './utils.js';

export function setupAndroidShareListener() {
    console.log('[AndroidShare] Initializing listener...');
    
    // 1. Listen for real-time events (app is already open)
    window.addEventListener('pingoAndroidShare', (event) => {
        processShare(event.detail.text);
    });

    // 2. Check for pending shares (app was cold-started)
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        window.Capacitor.Plugins.PingoNative.getPendingShare().then(result => {
            if (result && result.text) {
                console.log('[AndroidShare] Found pending share:', result.text);
                processShare(result.text);
            }
        });
    }
}

function processShare(text) {
    if (!text) return;

    console.log('[AndroidShare] Processing shared content:', text);

    // Treat it as a synthetic P2P chat message from "Android Share"
    handlePeerData('Android', {
        type: 'chat',
        text: text,
        msgId: `share-${Date.now()}`
    });

    // Auto-open chat to show the received content
    import('./ui-manager.js').then(ui => {
        ui.openChatFor('Android');
    });

    updateLocationStatus('Contenido compartido recibido', 'fa-share-nodes');
}
