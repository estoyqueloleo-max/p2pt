/**
 * Capítulo 3: Workspace Cartográfico y Control de Versiones Git
 */

export const chapter3 = {
    id: 'chapter_3',
    title: 'Workspace Cartográfico y Control de Versiones Git',
    outputFilename: 'pingo_ep03_workspace_git.mp4',
    tourButton: '#start-tour-routes-btn',
    workspace: 'editor',
    steps: [
        {
            stepIndex: 1,
            target: '#nav-editor-btn',
            voiceover: 'Bienvenidos al Workspace Cartográfico de Pingo. Aquí dispones de un repositorio Git completo ejecutándose directamente dentro de tu navegador.',
            durationMs: 7000
        },
        {
            stepIndex: 2,
            target: '#start-rec-btn',
            voiceover: 'Pulsa Iniciar Grabación al comenzar tu excursión. El panel superior registrará tu cronómetro, distancia y puntos GPS en tiempo real.',
            durationMs: 7000
        },
        {
            stepIndex: 3,
            target: '#stop-rec-btn',
            voiceover: 'Al finalizar la ruta, pulsa Detener y Guardar. Podrás asignarle un nombre y elegir si la ruta será indexable o estrictamente privada.',
            durationMs: 7000
        },
        {
            stepIndex: 4,
            target: '#new-note-btn',
            voiceover: 'También puedes redactar notas de campo georreferenciadas con puntos de interés y bitácoras de viaje totalmente versionadas.',
            durationMs: 7000
        },
        {
            stepIndex: 5,
            target: '#git-graph-btn',
            voiceover: 'Pulsando en Ver Grafo de Commits, podrás inspeccionar la genealogía visual de todas tus rutas, ramas y cambios históricos.',
            durationMs: 7000
        },
        {
            stepIndex: 6,
            target: '#git-sync-section',
            voiceover: 'Si deseas respaldar tus rutas en tu nube privada, puedes sincronizar por Git Push o Pull contra tu propio servidor Gitea o GitHub.',
            durationMs: 8000
        }
    ]
};
