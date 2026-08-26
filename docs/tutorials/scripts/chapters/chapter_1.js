/**
 * Capítulo 1: Identidad Criptográfica y Agenda Privada
 */

export const chapter1 = {
    id: 'chapter_1',
    title: 'Identidad Criptográfica y Agenda Privada',
    outputFilename: 'pingo_ep01_identidad_y_agenda.mp4',
    tourButton: '#start-tour-identity-btn',
    workspace: 'network',
    steps: [
        {
            stepIndex: 1,
            target: '#nav-network-btn',
            voiceover: 'Bienvenidos a Pingo, la plataforma de geolocalización y colaboración local-first donde tus datos nunca pasan por servidores comerciales ni bases de datos en la nube. Hoy aprenderemos a configurar nuestra identidad privada y crear nuestra agenda de contactos.',
            durationMs: 9000
        },
        {
            stepIndex: 2,
            target: '#toggle-identity-btn',
            voiceover: 'En Pingo no existen correos electrónicos ni contraseñas almacenadas en la nube. Para identificarte, solo necesitas un Alias, una Frase Secreta y una Sal de seguridad opcional.',
            durationMs: 7000
        },
        {
            stepIndex: 3,
            target: '#identity-alias',
            voiceover: 'Introduce tu Alias público. Este es el nombre visible con el que te verán tus contactos cuando les envíes una alerta o chatees con ellos.',
            durationMs: 6000
        },
        {
            stepIndex: 4,
            target: '#identity-phrase',
            voiceover: 'Tu Frase Secreta es tu llave maestra. Mediante algoritmos criptográficos, tu identidad se deriva matemáticamente sin guardarse en ningún servidor central.',
            durationMs: 7000
        },
        {
            stepIndex: 5,
            target: '#save-identity-btn',
            voiceover: 'Al pulsar Fijar Identidad, el navegador calcula tu ID único de ocho caracteres determinista. Si cambias de dispositivo, basta con volver a escribir tu misma frase para recuperar tu ID.',
            durationMs: 9000
        },
        {
            stepIndex: 6,
            target: '#agenda-section',
            voiceover: 'Añadir a un amigo a tu agenda es inmediato: ingresa su frase o pega directamente su ID de ocho cifras. La agenda se almacena de forma local y cifrada en tu navegador.',
            durationMs: 8000
        },
        {
            stepIndex: 7,
            target: '#share-location-btn',
            voiceover: 'Para invitar a alguien con un solo toque, pulsa Compartir mi ubicación. Al abrir el enlace recibido por mensajería, Pingo se conectará de inmediato punto a punto.',
            durationMs: 8000
        },
        {
            stepIndex: 8,
            target: '#export-backup-btn',
            voiceover: 'Por último, recuerda exportar periódicamente tu copia de seguridad local en formato JSON. En el próximo capítulo veremos cómo monitorizar el mapa en vivo y configurar geovallas.',
            durationMs: 8000
        }
    ]
};
