# Estado del Arte: Vídeo P2P y Alternativas a WebRTC (2026)

Tras hacer un barrido por el estado actual de las tecnologías de streaming de vídeo en tiempo real en 2026, la conclusión principal es que **WebRTC sigue siendo el rey absoluto para el P2P puro (1 a 1)**. Sin embargo, para escalar a más usuarios, la industria ha abandonado casi por completo el P2P en malla en favor de nuevas arquitecturas.

Aquí tienes un resumen de las opciones y tendencias actuales:

## 1. El Estándar: WebRTC (y por qué sigue dominando)
Para videollamadas 1-a-1 donde la latencia es crítica (sub-500ms) y buscas no depender de servidores centrales, **WebRTC es irreemplazable**.
* **Ventajas:** Viene integrado en todos los navegadores, encriptación end-to-end obligatoria (DTLS/SRTP) y excelente cancelación de eco.
* **Problema histórico:** Escala fatal en grupo. Si tienes 5 personas en una videollamada P2P en malla, cada teléfono tiene que codificar y subir su vídeo 4 veces por separado, destrozando la batería y el ancho de banda.

## 2. La Arquitectura Moderna: SFU (Selective Forwarding Unit)
Para solucionar el problema de escalar, el 99% de las aplicaciones comerciales (Google Meet, Discord, Zoom web) **no usan P2P real para el vídeo de grupo**. Usan la arquitectura SFU:
* **Cómo funciona:** Tú envías tu vídeo a un servidor SFU central *una sola vez*. El servidor no recodifica nada (para no consumir mucha CPU, como te explicaba en el mensaje anterior), sino que se encarga exclusivamente de **enrutar** esos mismos paquetes a los demás participantes.
* **Opciones Open Source populares:**
  * **LiveKit:** (Escrito en Go) Es actualmente el estándar de facto en código abierto. Muy moderno y con SDKs para todo.
  * **Mediasoup:** (C++ / Node.js) Extremadamente eficiente y de bajo nivel.
  * **Pion:** (Go) La librería más usada para construir cosas a medida (de hecho, LiveKit usa Pion por debajo).

## 3. La "Nueva Era": WebTransport + WebCodecs
Si tuvieras que construir el próximo YouTube en directo interactivo hoy, no usarías WebRTC. La tendencia más vanguardista es separar los componentes:
* **WebCodecs:** Permite al navegador codificar y decodificar fotogramas de vídeo puros con JavaScript/WASM usando la aceleración por hardware de la tarjeta gráfica.
* **WebTransport:** Un protocolo de red moderno basado en HTTP/3 y QUIC, diseñado para reemplazar a los WebSockets. Permite enviar datos en tiempo real de forma más eficiente y fiable que el viejo SCTP de WebRTC.
* **Uso:** Construyes tu propia tubería: sacas los fotogramas de la cámara, los codificas con WebCodecs y los envías a un servidor mediante WebTransport. *Ojo, esto es cliente-servidor, no permite P2P directo entre navegadores como WebRTC.*

## 4. Media over QUIC (MoQ)
Es un nuevo estándar emergente para la retransmisión masiva (broadcast). Trata de mezclar lo mejor de ambos mundos: la baja latencia de WebRTC y la escalabilidad masiva (millones de espectadores) de Twitch/YouTube (que usan HLS/DASH tradicionales con 3-5 segundos de retardo).

---

> [!TIP]
> ### Conclusión para Pingo
> Para tu caso de uso en Pingo, donde buscas una topología lo más descentralizada posible y conexiones rápidas:
> - **Para chats 1-a-1:** Sigue usando **PeerJS / WebRTC**. Es la mejor opción disponible.
> - **Para grupos o puentes (relays):** La arquitectura P2P no da más de sí por los límites físicos de los teléfonos. Si en el futuro quieres soportar videollamadas grupales fluidas o quieres resolver el problema del 5G definitivamente, el siguiente salto arquitectónico sería desplegar tu propio **servidor SFU** (ej. LiveKit) en la nube en lugar de apoyarte únicamente en un servidor TURN.
