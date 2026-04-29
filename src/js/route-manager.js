/**
 * P2PT - Route & Journal Management
 */

import { state, elements } from './state.js';
import { initGitRepo, commitRoute, readRouteFile } from './git-manager.js';
import { updateLocationStatus } from './utils.js';

let recordingInterval = null;
let recordingStartTime = 0;

/**
 * Initialize Route system
 */
export async function initRouteManager() {
    await initGitRepo();
    await loadLocalRoutes();
}

/**
 * Load all route files from the Git repo into state
 */
async function loadLocalRoutes() {
    // In a real Git repo, we'd list files in the directory.
    // For now, we'll use a index file or just localStorage to track IDs.
    const savedIds = JSON.parse(localStorage.getItem('p2pt_route_ids') || '[]');
    state.routes = [];
    
    for (const id of savedIds) {
        const data = await readRouteFile(id);
        if (data) state.routes.push(data);
    }
    console.log(`[Route] Loaded ${state.routes.length} routes.`);
}

/**
 * Start recording a new route
 */
export function startRecording() {
    if (state.isRecording) return;
    
    state.isRecording = true;
    state.recordingPoints = [];
    recordingStartTime = Date.now();
    
    // Add current location as first point if valid
    if (state.myCoords.lat !== 0) {
        addRecordingPoint(state.myCoords.lat, state.myCoords.lng);
    }

    if (elements.recordingHud) elements.recordingHud.style.display = 'flex';
    updateRecordingStats();
    
    console.log('[Route] Recording started.');
    updateLocationStatus('Grabando ruta...', 'fa-circle-dot');
}

/**
 * Stop recording and show save dialog
 */
export function stopRecording() {
    if (!state.isRecording) return;
    
    state.isRecording = false;
    
    if (state.recordingPoints.length < 1) {
        updateLocationStatus('Inicia el GPS o usa modo manual', 'fa-triangle-exclamation');
        if (elements.recordingHud) elements.recordingHud.style.display = 'none';
        return;
    }

    if (elements.saveRouteForm) {
        elements.saveRouteForm.style.display = 'block';
        if (elements.routeNameInput) {
            const dateStr = new Date().toLocaleString();
            elements.routeNameInput.value = `Ruta ${dateStr}`;
            elements.routeNameInput.focus();
        }
    }
    
    console.log('[Route] Recording stopped. Points:', state.recordingPoints.length);
}

/**
 * Finalize saving the route to Git
 */
export async function saveRoute(name) {
    if (state.recordingPoints.length < 1) {
        updateLocationStatus('No hay puntos que guardar', 'fa-triangle-exclamation');
        return false;
    }

    const isEditing = state.workingFile && state.workingFile.id && state.workingFile.type === 'route';
    const routeId = isEditing ? state.workingFile.id : `route-${Date.now()}`;
    
    // If editing, we might want to get the existing item to preserve some metadata
    const existingRoute = isEditing ? state.routes.find(r => r.id === routeId) : null;

    const routeData = {
        id: routeId,
        name: name || (existingRoute ? existingRoute.name : 'Ruta sin nombre'),
        creator: existingRoute ? existingRoute.creator : (state.myPeerId || 'anonymous'),
        points: state.recordingPoints,
        timestamp: Date.now(),
        version: existingRoute ? (existingRoute.version || 1) + 1 : 1,
        stats: {
            points: state.recordingPoints.length,
            duration: Date.now() - recordingStartTime
        }
    };

    try {
        console.log(`[Route] Saving route ${routeId}...`);
        updateLocationStatus('Guardando en Git...', 'fa-spinner fa-spin');
        
        // Ensure repo is ready (double check)
        await initGitRepo();

        // Save to Git
        await commitRoute(routeId, routeData, `Initial record: ${routeData.name}`);
        
        // Update index if it's a new route
        const savedIds = JSON.parse(localStorage.getItem('p2pt_route_ids') || '[]');
        if (!savedIds.includes(routeId)) {
            savedIds.push(routeId);
            localStorage.setItem('p2pt_route_ids', JSON.stringify(savedIds));
        }
        
        // Update state
        const idx = state.routes.findIndex(r => r.id === routeId);
        if (idx !== -1) {
            state.routes[idx] = routeData;
        } else {
            state.routes.push(routeData);
        }
        
        state.recordingPoints = [];
        
        console.log('[Route] Save successful.');
        updateLocationStatus('Ruta guardada en Git ✅', 'fa-check-circle');
        return true;
    } catch (err) {
        console.error('[Route] Save error:', err);
        updateLocationStatus('Error al guardar en Git', 'fa-times-circle');
        return false;
    }
}

/**
 * Handle new location updates during recording
 */
export function addRecordingPoint(lat, lng) {
    if (!state.isRecording) return;
    
    const lastPoint = state.recordingPoints[state.recordingPoints.length - 1];
    if (lastPoint && lastPoint.lat === lat && lastPoint.lng === lng) return;
    
    state.recordingPoints.push({ lat, lng, t: Date.now() });
    updateRecordingStats();
}

function updateRecordingStats() {
    if (elements.recordingPointsCount) {
        elements.recordingPointsCount.innerText = state.recordingPoints.length;
    }
    if (elements.recordingTimer) {
        const elapsed = Date.now() - recordingStartTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        elements.recordingTimer.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
