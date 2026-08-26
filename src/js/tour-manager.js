/**
 * Tour Manager - Interactive Guided Demos for Pingo
 * Lightweight, vanilla JavaScript onboarding & feature tour engine.
 */

import { setWorkspace } from './ui-manager.js';

let currentTour = null;
let currentStepIndex = 0;
let overlayEl = null;
let popoverEl = null;
let spotlightEl = null;

/**
 * Predefined Tours for All Use Cases
 */
export const TOURS = {
    identity: {
        id: 'identity',
        title: 'Creación de Identidad y Agenda',
        steps: [
            {
                target: '#nav-network-btn',
                title: '1. Pestaña Red e Identidad',
                content: 'Aquí gestionas tu identidad privada, tu agenda de contactos ("Mis Pingos") y tus copias de seguridad.',
                workspace: 'network',
                position: 'bottom'
            },
            {
                target: '#toggle-identity-btn',
                title: '2. Despliega tu Identidad',
                content: 'Pulsa este botón para configurar o modificar tus credenciales criptográficas.',
                workspace: 'network',
                position: 'bottom',
                beforeStep: () => {
                    const form = document.getElementById('identity-form');
                    if (form && form.style.display === 'none') form.style.display = 'block';
                }
            },
            {
                target: '#identity-alias',
                title: '3. Tu Alias o Nombre',
                content: 'Es el nombre público con el que te verán tus amigos cuando les envíes un aviso (Push) o chatees con ellos.',
                workspace: 'network',
                position: 'bottom',
                simulateInput: 'Viajero_Pingo'
            },
            {
                target: '#identity-phrase',
                title: '4. Frase Secreta y Sal',
                content: '<strong>Cero contraseñas en servidores:</strong> Tu ID se calcula matemáticamente de esta frase. Si cambias de móvil, introduce la misma frase y sal para recuperar tu ID.',
                workspace: 'network',
                position: 'bottom',
                simulateInput: 'mi-frase-secreta-2026'
            },
            {
                target: '#save-identity-btn',
                title: '5. Fijar Identidad',
                content: 'Al pulsar "Fijar Identidad", Pingo derivará tu ID criptográfico de 8 caracteres determinista.',
                workspace: 'network',
                position: 'top'
            },
            {
                target: '#my-peer-id',
                title: '6. Tu ID de Conexión',
                content: 'Este es tu código personal de conexión. Puedes copiarlo o usar el botón <strong>"Compartir mi ubicación"</strong> para invitar a tus contactos.',
                workspace: 'network',
                position: 'bottom'
            },
            {
                target: '#add-contact-btn',
                title: '7. Agenda de Contactos (Mis Pingos)',
                content: 'Añade a tus amigos y familiares usando su frase secreta o directamente su ID manual de conexión.',
                workspace: 'network',
                position: 'top',
                beforeStep: () => {
                    const form = document.getElementById('add-contact-form');
                    if (form && form.style.display === 'none') form.style.display = 'block';
                }
            },
            {
                target: '#export-backup-btn',
                title: '8. Copias de Seguridad',
                content: 'Exporta tu agenda y ajustes en un archivo JSON cifrado o impórtalo en otro dispositivo para restaurar tus contactos al instante.',
                workspace: 'network',
                position: 'top'
            }
        ]
    },

    routes: {
        id: 'routes',
        title: 'Workspace Cartográfico, Grabación y Git Local',
        steps: [
            {
                target: '#nav-workspace-btn',
                title: '1. Pestaña Workspace & Git',
                content: 'Tu centro de operaciones offline para grabar rutas, redactar notas geolocalizadas y gestionar tu repositorio Git.',
                workspace: 'workspace',
                position: 'bottom'
            },
            {
                target: '#start-recording-btn',
                title: '2. Iniciar Grabación de Rutas (REC)',
                content: 'Pulsa aquí para registrar tracks GPS durante tus actividades de senderismo, ciclismo o viajes.',
                workspace: 'workspace',
                position: 'bottom'
            },
            {
                target: '#create-note-btn',
                title: '3. Notas y Puntos de Interés (POIs)',
                content: 'Crea fichas de texto, bitácoras o reseñas de campo vinculadas directamente a tu repositorio de versiones.',
                workspace: 'workspace',
                position: 'bottom'
            },
            {
                target: '#git-remote-config',
                title: '4. Sincronización Remota Git',
                content: 'Conecta tu Pingo a un servidor privado propio (Gitea o GitHub) para subir (Push) o descargar (Pull) tus rutas.',
                workspace: 'workspace',
                position: 'top'
            },
            {
                target: '#view-gitgraph-btn',
                title: '5. Visualizador de Git Graph',
                content: 'Inspecciona visualmente el árbol de commits, bifurcaciones (forks) y ramas de toda tu colección cartográfica.',
                workspace: 'workspace',
                position: 'bottom'
            },
            {
                target: '#routes-container',
                title: '6. Catálogo de Rutas Guardadas',
                content: 'Aquí verás todas tus rutas guardadas en Git. Pulsa en cualquiera para cargarla en tu Copia de Trabajo (*Working Copy*) y proyectarla en el mapa.',
                workspace: 'workspace',
                position: 'top'
            }
        ]
    },

    geofence: {
        id: 'geofence',
        title: 'Mapa, Geovalla y Modo Persistente',
        steps: [
            {
                target: '#nav-location-btn',
                title: '1. Pestaña Mapa & Localización',
                content: 'Visualiza el mapa en tiempo real con tu posición GPS, tus contactos conectados y tu histórico de movimiento.',
                workspace: 'location',
                position: 'bottom',
                beforeStep: () => {
                    const p = document.getElementById('location-controls-panel');
                    if (p) p.classList.remove('collapsed');
                }
            },
            {
                target: '#toggle-location-controls-btn',
                title: '2. Panel Flotante de Controles',
                content: 'Este panel flotante concentra todos los ajustes del mapa, geovallas y red. Puedes pulsarlo para desplegarlo o minimizarlo según necesites.',
                workspace: 'location',
                position: 'bottom',
                beforeStep: () => {
                    const p = document.getElementById('location-controls-panel');
                    if (p) p.classList.remove('collapsed');
                }
            },
            {
                target: '#geofence-toggle',
                title: '3. Activar Geovalla (Zona Segura)',
                content: 'Establece un perímetro de seguridad. Si tu contacto sale del círculo, tu móvil emitirá alertas sonoras y visuales inmediatas.',
                workspace: 'location',
                position: 'bottom',
                beforeStep: () => {
                    const p = document.getElementById('location-controls-panel');
                    if (p) p.classList.remove('collapsed');
                }
            },
            {
                target: '#geofence-radius',
                title: '4. Radio de la Zona Segura',
                content: 'Ajusta el radio de protección desde 50 metros (una vivienda o colegio) hasta 1.000 metros (un barrio o parque).',
                workspace: 'location',
                position: 'top'
            },
            {
                target: '#set-geofence-center',
                title: '5. Centrar Geovalla',
                content: 'Fija el centro de la zona segura exactamente en tu posición actual o en la de la persona supervisada.',
                workspace: 'location',
                position: 'top'
            },
            {
                target: '#persistence-toggle',
                title: '6. Modo Persistente (Segundo Plano)',
                content: 'Solicita bloqueo de suspensión (*Wake Lock*) para que el sistema operativo no congele el chip GPS ni la conexión al apagar la pantalla.',
                workspace: 'location',
                position: 'top'
            }
        ]
    },

    servers: {
        id: 'servers',
        title: 'Servidores TURN, DuckDNS & UPnP',
        steps: [
            {
                target: '#nav-location-btn',
                title: '1. Pestaña Ajustes & Red',
                content: 'Aquí puedes supervisar tu conexión, activar servicios de relé y gestionar la infraestructura descentralizada de Pingo.',
                workspace: 'location',
                position: 'bottom'
            },
            {
                target: '#cloud-services-toggle',
                title: '2. Relé TURN y Servicios Cloud',
                content: 'Activa esta opción para superar cortafuegos simétricos y redes móviles 4G/5G mediante un servidor relé.',
                workspace: 'location',
                position: 'top',
                beforeStep: () => {
                    const p = document.getElementById('location-controls-panel');
                    if (p) p.classList.remove('collapsed');
                }
            },
            {
                target: '#open-server-config-btn',
                title: '3. Panel de Servidores Personalizados',
                content: 'Pulsa aquí para configurar tus propios servidores de señalización PeerJS y relés TURN (ej. con el ejecutable en Go de Pingo).',
                workspace: 'location',
                position: 'top',
                beforeStep: () => {
                    const p = document.getElementById('location-controls-panel');
                    if (p) p.classList.remove('collapsed');
                }
            },
            {
                target: '#server-signaling-host',
                title: '4. Señalización PeerJS & DuckDNS',
                content: 'Introduce la IP o el subdominio gratuito de <strong>DuckDNS</strong> (ej. <code>mi-nodo.duckdns.org</code>) donde corre tu servidor.',
                workspace: 'location',
                position: 'bottom',
                beforeStep: () => {
                    const modal = document.getElementById('server-config-modal');
                    if (modal) modal.style.display = 'flex';
                }
            },
            {
                target: '#server-turn-urls',
                title: '5. Relé TURN/STUN & UPnP',
                content: 'Dirección del relé TURN (ej. <code>turn:mi-nodo.duckdns.org:3478?transport=udp</code>). Con <strong>UPnP</strong>, el router abre el puerto 3478 automáticamente.',
                workspace: 'location',
                position: 'bottom',
                beforeStep: () => {
                    const modal = document.getElementById('server-config-modal');
                    if (modal) modal.style.display = 'flex';
                }
            },
            {
                target: '#server-config-import-btn',
                title: '6. Auto-Vinculación por QR / JSON',
                content: '<strong>¡Sin escribir a mano!</strong> Escanea el código QR generado por el ejecutable de Pingo o pega el bloque JSON para autoconfigurar todo en 1 segundo.',
                workspace: 'location',
                position: 'top',
                beforeStep: () => {
                    const modal = document.getElementById('server-config-modal');
                    if (modal) modal.style.display = 'flex';
                }
            },
            {
                target: '#server-config-test',
                title: '7. Probar Conectividad',
                content: 'Comprueba en tiempo real si tu servidor PeerJS y relé TURN están activos y alcanzables antes de guardar los cambios.',
                workspace: 'location',
                position: 'top',
                beforeStep: () => {
                    const modal = document.getElementById('server-config-modal');
                    if (modal) modal.style.display = 'flex';
                }
            },
            {
                target: '#server-config-save',
                title: '8. Guardar y Reconectar',
                content: 'Aplica la configuración inmediatamente y reconecta el cliente P2P a tus servidores propios sin recargar la app.',
                workspace: 'location',
                position: 'top',
                beforeStep: () => {
                    const modal = document.getElementById('server-config-modal');
                    if (modal) modal.style.display = 'flex';
                }
            }
        ]
    },

    comm_search: {
        id: 'comm_search',
        title: 'Comunicación Mesh, Streaming y Búsqueda IA',
        steps: [
            {
                target: '#nav-comm-btn',
                title: '1. Pestaña Comunicación',
                content: 'Canal de chat privado en malla, streaming multimedia y motor de búsqueda distribuido impulsado por IA.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#chat-panel',
                title: '2. Chat P2P y Retransmisión Mesh',
                content: 'Conversaciones privadas cifradas punto a punto. Si hay varios contactos conectados, los mensajes se retransmiten automáticamente entre todos.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#share-camera-btn',
                title: '3. Streaming de Cámara y Pantalla',
                content: 'Emite vídeo en directo desde tu cámara o comparte tu escritorio con todo el grupo sin pasar por servidores de vídeo.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#semantic-search-input',
                title: '4. Búsqueda Híbrida Distribuida',
                content: 'Busca rutas y notas en tu dispositivo o en los dispositivos públicos de tus contactos conectados.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#search-type-semantic',
                title: '5. Búsqueda Semántica con IA Local',
                content: 'Busca por significado conceptual ("sendero con río", "muestra de agua") usando embeddings ejecutados 100% en tu propio procesador.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#index-vectors-btn',
                title: '6. Indexación Vectorial On-Device',
                content: 'Genera los vectores matemáticos de tus textos en segundo plano dentro de un Web Worker aislado con WebAssembly.',
                workspace: 'comm',
                position: 'bottom'
            },
            {
                target: '#allow-semantic-search-toggle',
                title: '7. Privacidad Granular de Búsqueda',
                content: 'Tú decides si tus contactos pueden realizar consultas semánticas o exactas sobre tus contenidos públicos compartidos.',
                workspace: 'comm',
                position: 'top'
            }
        ]
    }
};

/**
 * Initialize Tour DOM elements if not present
 */
let activeTargetEl = null;
let activeTargetClickHandler = null;

/**
 * Initialize Tour DOM elements if not present
 */
function initTourDOM() {
    if (document.getElementById('pingo-tour-container')) return;

    const container = document.createElement('div');
    container.id = 'pingo-tour-container';
    container.className = 'tour-container';
    container.innerHTML = `
        <div class="tour-backdrop" id="tour-backdrop"></div>
        <div class="tour-spotlight" id="tour-spotlight"></div>
        <div class="tour-popover" id="tour-popover" role="dialog" aria-modal="true">
            <div class="tour-header">
                <span class="tour-step-badge" id="tour-step-badge">Paso 1 de 6</span>
                <button class="tour-close-btn" id="tour-close-btn" title="Cerrar Demo"><i class="fas fa-times"></i></button>
            </div>
            <h4 class="tour-title" id="tour-title">Título del Paso</h4>
            <div class="tour-body" id="tour-body">Contenido de la explicación...</div>
            <div class="tour-progress-bar">
                <div class="tour-progress-fill" id="tour-progress-fill"></div>
            </div>
            <div class="tour-footer">
                <button class="tour-btn tour-btn-outline" id="tour-prev-btn"><i class="fas fa-chevron-left"></i> Atrás</button>
                <div class="tour-footer-actions">
                    <button class="tour-btn tour-btn-ghost" id="tour-skip-btn">Saltar</button>
                    <button class="tour-btn tour-btn-primary" id="tour-next-btn">Siguiente <i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(container);

    overlayEl = document.getElementById('tour-backdrop');
    spotlightEl = document.getElementById('tour-spotlight');
    popoverEl = document.getElementById('tour-popover');

    document.getElementById('tour-close-btn').addEventListener('click', endTour);
    document.getElementById('tour-skip-btn').addEventListener('click', endTour);
    document.getElementById('tour-prev-btn').addEventListener('click', prevStep);
    document.getElementById('tour-next-btn').addEventListener('click', nextStep);

    // Clicking directly on the highlighted spotlight area advances to next step
    spotlightEl.addEventListener('click', (e) => {
        e.stopPropagation();
        nextStep();
    });

    // Keyboard navigation (Escape to close, Arrows to navigate)
    window.addEventListener('keydown', (e) => {
        if (!currentTour) return;
        if (e.key === 'Escape') endTour();
        if (e.key === 'ArrowRight') nextStep();
        if (e.key === 'ArrowLeft') prevStep();
    });

    window.addEventListener('resize', () => {
        if (currentTour) renderCurrentStep();
    });
}

/**
 * Start a guided tour
 * @param {string|Object} tourOrKey 
 */
export function startTour(tourOrKey) {
    const tour = typeof tourOrKey === 'string' ? TOURS[tourOrKey] : tourOrKey;
    if (!tour || !tour.steps || tour.steps.length === 0) {
        console.warn('[Tour] Invalid tour configuration:', tourOrKey);
        return;
    }

    initTourDOM();
    currentTour = tour;
    currentStepIndex = 0;

    const container = document.getElementById('pingo-tour-container');
    if (container) {
        container.style.display = 'block';
        requestAnimationFrame(() => container.classList.add('tour-active'));
    }

    renderCurrentStep();
}

/**
 * Clean up active highlighted element state
 */
function cleanupActiveTarget() {
    if (activeTargetEl) {
        activeTargetEl.classList.remove('tour-highlighted-target');
        if (activeTargetClickHandler) {
            activeTargetEl.removeEventListener('click', activeTargetClickHandler);
            activeTargetClickHandler = null;
        }
        activeTargetEl = null;
    }
}

/**
 * Render the current step
 */
function renderCurrentStep() {
    if (!currentTour) return;

    cleanupActiveTarget();

    const step = currentTour.steps[currentStepIndex];
    if (!step) return;

    // Switch workspace if needed
    if (step.workspace) {
        setWorkspace(step.workspace);
    }

    // Run hook if present
    if (typeof step.beforeStep === 'function') {
        try {
            step.beforeStep();
        } catch (err) {
            console.error('[Tour] Error in beforeStep hook:', err);
        }
    }

    // Delay slightly to allow transitions/rendering
    setTimeout(() => {
        const targetEl = document.querySelector(step.target);
        if (!targetEl) {
            console.warn(`[Tour] Target element not found: ${step.target}`);
            return;
        }

        activeTargetEl = targetEl;
        activeTargetEl.classList.add('tour-highlighted-target');

        // Clicking on the highlighted element advances to the next step naturally
        activeTargetClickHandler = () => {
            setTimeout(() => nextStep(), 200);
        };
        activeTargetEl.addEventListener('click', activeTargetClickHandler, { once: true });

        // Scroll element into view instantly so bounding rect is accurate
        targetEl.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

        // Update Spotlight Box
        updateSpotlight(targetEl);

        // Update Popover Content
        const totalSteps = currentTour.steps.length;
        document.getElementById('tour-step-badge').innerText = `Paso ${currentStepIndex + 1} de ${totalSteps}`;
        document.getElementById('tour-title').innerText = step.title;
        document.getElementById('tour-body').innerHTML = step.content;

        // Progress bar
        const progressPercent = ((currentStepIndex + 1) / totalSteps) * 100;
        document.getElementById('tour-progress-fill').style.width = `${progressPercent}%`;

        // Buttons
        const prevBtn = document.getElementById('tour-prev-btn');
        const nextBtn = document.getElementById('tour-next-btn');

        prevBtn.style.visibility = currentStepIndex > 0 ? 'visible' : 'hidden';
        if (currentStepIndex === totalSteps - 1) {
            nextBtn.innerHTML = '¡Entendido! <i class="fas fa-check"></i>';
        } else {
            nextBtn.innerHTML = 'Siguiente <i class="fas fa-chevron-right"></i>';
        }

        // Position popover
        positionPopover(targetEl, step.position || 'bottom');

        // Optional input simulation placeholder hint
        if (step.simulateInput && targetEl.tagName === 'INPUT') {
            simulateTyping(targetEl, step.simulateInput);
        }
    }, 100);
}

/**
 * Position spotlight precisely over target element
 */
function updateSpotlight(targetEl) {
    if (!spotlightEl) return;
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;

    spotlightEl.style.top = `${rect.top - padding}px`;
    spotlightEl.style.left = `${rect.left - padding}px`;
    spotlightEl.style.width = `${rect.width + padding * 2}px`;
    spotlightEl.style.height = `${rect.height + padding * 2}px`;
}

/**
 * Position popover card relative to target
 */
function positionPopover(targetEl, preferredPos) {
    if (!popoverEl) return;

    const rect = targetEl.getBoundingClientRect();
    const popoverRect = popoverEl.getBoundingClientRect();
    const popoverHeight = popoverRect.height || 200;
    const popoverWidth = popoverRect.width || 340;
    const margin = 14;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    // Horizontal
    if (windowWidth < 480) {
        left = 16;
        popoverEl.style.width = `${windowWidth - 32}px`;
    } else {
        left = rect.left + rect.width / 2 - popoverWidth / 2;
        left = Math.max(16, Math.min(left, windowWidth - popoverWidth - 16));
        popoverEl.style.width = '340px';
    }

    // Vertical
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (preferredPos === 'top' || (spaceBelow < popoverHeight + margin && spaceAbove > popoverHeight + margin)) {
        top = rect.top - popoverHeight - margin;
    } else {
        top = rect.bottom + margin;
    }

    // Clamp inside viewport
    top = Math.max(16, Math.min(top, windowHeight - popoverHeight - 16));

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
}

/**
 * Simulate gentle typing effect in an input without overwriting real saved values permanently
 */
function simulateTyping(inputEl, text) {
    if (inputEl.value && inputEl.value.trim() !== '') return;
    inputEl.setAttribute('placeholder', text);
}

/**
 * Next step
 */
export function nextStep() {
    if (!currentTour) return;
    if (currentStepIndex < currentTour.steps.length - 1) {
        currentStepIndex++;
        renderCurrentStep();
    } else {
        endTour();
    }
}

/**
 * Previous step
 */
export function prevStep() {
    if (!currentTour) return;
    if (currentStepIndex > 0) {
        currentStepIndex--;
        renderCurrentStep();
    }
}

/**
 * End/Close Tour
 */
export function endTour() {
    cleanupActiveTarget();
    const container = document.getElementById('pingo-tour-container');
    if (container) {
        container.classList.remove('tour-active');
        setTimeout(() => {
            container.style.display = 'none';
        }, 200);
    }
    currentTour = null;
    currentStepIndex = 0;
}
