/**
 * Pingo - P2P Sync & Cloud Proxy Manager
 */

import { state, elements } from './state.js';
import { updateLocationStatus } from './utils.js';
import { commitRoute } from './git-manager.js';
import { registerDataHandler } from './peer-manager.js';

export const VERSION = 70;

// Register incoming route share handler
registerDataHandler('route-share', handleIncomingRoute);

/**
 * Share a route with a specific peer over P2P
 * @param {string} routeId 
 * @param {string} targetPeerId 
 */
export async function shareRouteP2P(routeId, targetPeerId) {
    const route = state.routes.find(r => r.id === routeId);
    console.log('[Sync] shareRouteP2P found route:', route);
    if (!route) {
        console.warn('[Sync] shareRouteP2P: Route not found in state.routes', routeId);
        return;
    }

    const conn = state.connections[targetPeerId];
    if (!conn || !conn.open) {
        updateLocationStatus('El pingo no está conectado', 'fa-triangle-exclamation');
        return;
    }

    updateLocationStatus(`Compartiendo ruta "${route.name}"...`, 'fa-spinner fa-spin');

    // We send the route data + a special flag for Git import
    console.log('[Sync] shareRouteP2P: Sending data to', targetPeerId);
    conn.send({
        type: 'route-share',
        routeData: route,
        sharedBy: state.myPeerId,
        timestamp: Date.now()
    });

    updateLocationStatus('Ruta enviada ✅', 'fa-check-circle');
}

/**
 * Handle incoming route share
 * @param {object} data 
 */
export async function handleIncomingRoute(peerId, data) {
    console.log('[Sync] handleIncomingRoute received:', peerId, data);
    const { routeData, sharedBy } = data;
    
    const { getAliasForPeer } = await import('./identity-manager.js');
    const { showConfirmModal } = await import('./ui-manager.js');
    const senderAlias = getAliasForPeer(sharedBy) || sharedBy;

    const confirmImport = await showConfirmModal('Ruta Recibida', `Ping@ ${senderAlias} quiere compartir una ruta contigo: "${routeData.name}". ¿Aceptar e importar a tu colección?`);
    console.log('[Sync] confirmImport result:', confirmImport);
    
    if (confirmImport) {
        try {
            updateLocationStatus('Importando ruta...', 'fa-spinner fa-spin');
            
            // "Fork" logic: We save it as our own but keep the creator info
            const newRouteData = {
                ...routeData,
                forkedFrom: sharedBy,
                importedAt: Date.now()
            };
            
            // Commit the received route to local Git
            await commitRoute(newRouteData.id, newRouteData, `Imported from ${senderAlias} (${sharedBy})`);
            
            // Update local state so it appears in the list without full reload
            if (!state.routes.find(r => r.id === newRouteData.id)) {
                state.routes.push(newRouteData);
            }
            
            updateLocationStatus('Ruta importada con éxito ✅', 'fa-check-circle');
            
            // If we are in cartography mode, refresh list
            console.log('[Sync] Refreshing routes UI (proactive)...');
            try {
                const ui = await import('./ui-manager.js');
                if (ui && typeof ui.renderRoutes === 'function') {
                    ui.renderRoutes();
                }
            } catch (uiErr) {
                console.error('[Sync] Error refreshing UI:', uiErr);
            }
        } catch (err) {
            console.error('[Sync] Import error:', err);
            updateLocationStatus('Error al importar ruta', 'fa-times-circle');
        }
    } else {
        console.log('[Sync] User cancelled import');
    }
}

/**
 * Helper to get the Proxy URL for a target
 */
/**
 * Helper to get the Proxy URL for a target.
 * Bypasses proxy for local/private IPs (over VPN or local LAN).
 */
export function getGitProxyUrl(targetUrl) {
    // Detect local/private IPs and localhost
    const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(targetUrl);
    
    if (isLocal) {
        console.log(`[Sync] Local/VPN target detected, bypassing Git Proxy: ${targetUrl}`);
        return targetUrl;
    }

    const cloudConfig = JSON.parse(localStorage.getItem('pingo_cloud_config') || '{}');
    const endpoint = cloudConfig.apiEndpoint || 'https://pingo-cloud.accreativos.com';
    
    // Remote original protocol
    const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
    return `${endpoint}/git-proxy/${cleanUrl}`;
}
