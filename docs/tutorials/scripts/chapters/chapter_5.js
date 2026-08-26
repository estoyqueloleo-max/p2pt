/**
 * Capítulo 5: Servidor Autónomo Doméstico y Alpine Appliance
 */

export const chapter5 = {
    id: 'chapter_5',
    title: 'Servidor Autónomo Doméstico y Alpine Appliance',
    outputFilename: 'pingo_ep05_appliance_servidor.mp4',
    tourButton: '#start-tour-servers-btn',
    workspace: 'location',
    steps: [
        {
            stepIndex: 1,
            target: '#nav-location-btn',
            voiceover: 'En este capítulo final aprenderemos a desplegar nuestro propio nodo independiente de Pingo para tener soberanía total sobre nuestras comunicaciones.',
            durationMs: 7000
        },
        {
            stepIndex: 2,
            target: '#settings-modal-btn',
            voiceover: 'El servidor de Pingo se distribuye como un único binario en Go con asistente interactivo por consola y panel de control web en el puerto nueve mil.',
            durationMs: 7000
        },
        {
            stepIndex: 3,
            target: '#custom-servers-config-btn',
            voiceover: 'Incorpora auto-apertura de puertos por UPnP en tu router y sincronización automática de subdominios gratuitos con DuckDNS.',
            durationMs: 7000
        },
        {
            stepIndex: 4,
            target: '#qr-code-scanner-btn',
            voiceover: 'Para una experiencia plug and play de bajo coste, puedes grabar nuestra imagen inmutable de Alpine Linux en una Raspberry Pi Zero de diez dólares.',
            durationMs: 8000
        },
        {
            stepIndex: 5,
            target: '#import-server-json-btn',
            voiceover: 'Configura la red simplemente soltando un archivo wifi punto texto en la tarjeta SD. Al encender la placa, el appliance arranca en memoria en pocos segundos.',
            durationMs: 8000
        },
        {
            stepIndex: 6,
            target: '#test-server-conn-btn',
            voiceover: 'Escanea el código QR desde la App Pingo y disfruta de tu propia infraestructura descentralizada de geolocalización y mensajería.',
            durationMs: 7000
        },
        {
            stepIndex: 7,
            target: '#save-server-settings-btn',
            voiceover: 'Gracias por acompañarnos en esta masterclass de Pingo. Te invitamos a explorar el código y construir tu propia red privada.',
            durationMs: 7000
        },
        {
            stepIndex: 8,
            target: '#close-settings-btn',
            voiceover: 'Pingo: geolocalización en tiempo real, mapas colaborativos y comunicación privada sin intermediarios.',
            durationMs: 6000
        }
    ]
};
