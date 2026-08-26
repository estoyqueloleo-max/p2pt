/**
 * Capítulo 2: Mapa en Tiempo Real, Geovallas y Persistencia
 */

export const chapter2 = {
    id: 'chapter_2',
    title: 'Mapa en Tiempo Real, Geovallas y Persistencia',
    outputFilename: 'pingo_ep02_mapa_geovallas.mp4',
    tourButton: '#start-tour-geofence-btn',
    workspace: 'location',
    steps: [
        {
            stepIndex: 1,
            target: '#nav-location-btn',
            voiceover: 'En este segundo capítulo exploraremos el mapa interactivo de Pingo. En pantalla vemos nuestro marcador azul en tiempo real con precisión GPS adaptativa.',
            durationMs: 7000
        },
        {
            stepIndex: 2,
            target: '#geofence-toggle-container',
            voiceover: 'Una de las funciones clave para la seguridad familiar y deportiva es la Geovalla o Zona Segura. Al activarla, podemos definir un perímetro de protección.',
            durationMs: 7000
        },
        {
            stepIndex: 3,
            target: '#geofence-radius-slider',
            voiceover: 'Ajusta el radio del perímetro desde cincuenta hasta mil metros con el control deslizante según tus necesidades de supervisión.',
            durationMs: 6000
        },
        {
            stepIndex: 4,
            target: '#center-geofence-btn',
            voiceover: 'Puedes centrar el círculo de seguridad sobre tu propia ubicación o sobre la de cualquiera de tus contactos conectados.',
            durationMs: 6000
        },
        {
            stepIndex: 5,
            target: '#persistent-mode-container',
            voiceover: 'Para evitar que el sistema operativo suspenda la geolocalización al apagar la pantalla, activa el Modo Persistente con bloqueo de suspensión de pantalla.',
            durationMs: 7000
        },
        {
            stepIndex: 6,
            target: '#cloud-services-container',
            voiceover: 'En redes móviles con cortafuegos o CGNAT estricto, activa Servicios en la Nube para habilitar el relé intermedio TURN y las notificaciones push instantáneas.',
            durationMs: 8000
        }
    ]
};
