# 📺 Episodio 04: Comunicación Mesh, Streaming P2P e IA Local

> **Objetivo:** Explorar el chat cifrado en malla (mesh relay), compartir rutas directamente por chat, emitir vídeo en directo (cámara/pantalla) y usar la búsqueda semántica con IA ejecutada en local.  
> **Duración estimada:** 06:00 min.

---

## 🎬 Guión Técnico de Grabación

| Tiempo | Pantalla / Acción | Locución (Voz en off) |
| :--- | :--- | :--- |
| **00:00 - 00:45** | Clic en la pestaña **Comunicación** (`#nav-comm-btn`). Se abre la interfaz de chat P2P con el contacto activo seleccionado. | *«En este cuarto capítulo entraremos en el módulo de Comunicación y Colaboración Descentralizada de Pingo. Todos los mensajes y archivos viajan cifrados punto a punto mediante canales de datos WebRTC sin pasar por ningún servidor central.»* |
| **00:45 - 01:45** | Enviar mensajes de texto en el chat. Clic en el icono de **Carpeta / Compartir Ruta**: seleccionar la ruta grabada en el capítulo anterior y enviarla. | *«Para transferir una ruta a un compañero, pulsamos el botón de compartir track en el chat. El destinatario recibe un aviso interactivo y, al pulsar 'Aceptar', la ruta se descarga directamente por P2P y se integra automáticamente en su propio repositorio Git local.»* |
| **01:45 - 03:00** | Clic en el botón de **Cámara** (`#share-camera-btn`). Se inicia la emisión de vídeo local y el contacto remoto recibe la notificación y reproduce el streaming. | *«Pingo también permite emitir vídeo en directo desde tu cámara o compartir tu pantalla. En una red de varios usuarios, el vídeo se retransmite en malla (Mesh Relay) de nodo a nodo, permitiendo que todo el grupo vea el directo sin saturar la conexión de nadie.»* |
| **03:00 - 04:30** | Desplazarse al panel de **Búsqueda**. Escribir una búsqueda exacta y luego pulsar **Búsqueda Semántica**. Escribir `"ruta con río y cascada"`. | *«Una de las características más innovadoras de Pingo es su motor de Búsqueda Híbrida. Puedes realizar búsquedas exactas instantáneas o activar la Búsqueda Semántica impulsada por Inteligencia Artificial Local.»* |
| **04:30 - 05:30** | Explicar el modelo ONNX en WebAssembly y la búsqueda distribuida en peers conectados. | *«A diferencia de otros sistemas que envían tus textos a servidores externos, Pingo ejecuta un modelo de embeddings dentro de un Web Worker en tu propio procesador. Además, puedes buscar de forma distribuida en el material que tus compañeros conectados hayan marcado como público.»* |
| **05:30 - 06:00** | Resumen y cierre de capítulo. | *«Conectividad total, vídeo en directo e inteligencia artificial sin comprometer tu privacidad. En el último capítulo veremos cómo desplegar tu propio nodo doméstico autónomo en una Raspberry Pi usando nuestro Appliance de Alpine Linux.»* |

---

## 💡 Cues y Elementos Visuales
* **Animación de topología**: Gráfico mostrando el enrutamiento Mesh de 3 nodos (Nodo A -> Nodo B -> Nodo C).
* **Callout**: Indicador de que la IA se ejecuta 100% en WebAssembly (`ONNX Runtime Web Worker`) sin conexión externa.
