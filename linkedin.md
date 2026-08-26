¿Privacidad o Conectividad? Por qué decidí crear mi propia App de localización P2P 🐧🛰️

A veces, la necesidad personal es el mejor motor para la innovación. Mi hija pequeña aún no tiene WhatsApp, pero como padre, quería una forma segura y privada de saber que está bien cuando sale.

Así nació P2PT, una aplicación de geolocalización en tiempo real que prioriza la privacidad absoluta: tus datos nunca tocan un servidor central.

Lo que empezó como una herramienta para gestionar geocercas (avisos si sale de una zona segura), terminó siendo el campo de pruebas perfecto para combinar un stack tecnológico que tenía muchas ganas de ver funcionando en conjunto.

Para acelerar el desarrollo, he contado con un aliado increíble: Antigravity, el IDE agentico de Google. Me ha permitido iterar a una velocidad absurda, orquestando tecnologías que normalmente llevan días configurar:

🚀 El "Cocktail" Tecnológico de P2PT:

👉 P2P Puro & WebRTC: Conexión directa entre dispositivos vía PeerJS. Sin intermediarios que vean tu ubicación.

👉 Git en el Navegador: Uso de isomorphic-git y LightningFS para gestionar el historial de rutas como si fuera un repositorio de código, ¡pero todo dentro del navegador!

👉 Arquitectura Serverless: Un backend ligero en Cloudflare Workers para gestionar la señalización y los secretos.

👉 Web Push & Deep Linking: Notificaciones que "despiertan" la App incluso si está cerrada.

👉 Identidad Criptográfica: No hay registro con email ni contraseñas en un servidor. La App usa PBKDF2 para derivar tu identidad única a partir de una frase secreta y un "salt" que solo tú conoces.

👉 IA Local: He integrado capacidades de búsqueda semántica directamente sobre el historial de rutas y notas. Es fascinante cómo puedes buscar por "conceptos" o "intenciones" en lugar de palabras clave, ¡y todo sin que los datos salgan de tu dispositivo!

Creo que el uso de Git como motor de persistencia y compartición de datos abre puertas muy interesantes para la Web Descentralizada. Y esto es solo el principio.

Si te pica la curiosidad técnica o quieres ver cómo funciona una PWA con esteroides, te invito a echarle un ojo aquí: 🔗 Live App: https://estoyqueloleo-max.github.io/p2pt/

#WebRTC #P2P #DecentralizedWeb #CloudflareWorkers #AI #TransformersJS #Antigravity #GoogleAI #PrivacyByDesign #OpenSource