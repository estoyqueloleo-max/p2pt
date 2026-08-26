# 🐧 Pingo - Real-time P2P Location & Distributed Workspace

> [!TIP]
> Si vas a sincronizar tus rutas y notas con un servidor privado propio, consulta esta guía sobre [Gitea y CORS](https://people.iola.dk/arj/2020/04/28/gitea-and-cors/) para configurar el acceso seguro desde la App.

Pingo es una plataforma de **geolocalización en tiempo real, comunicación en malla (mesh) y repositorio cartográfico distribuido**, diseñada bajo la filosofía *local-first*: **100% privada, ligera, resiliente y sin intermediarios**.

---

## 🎬 Masterclass y Serie de Videotutoriales

Dispones de una suite completa de **videotutoriales paso a paso generados de forma 100% automatizada** (locución con **Kokoro TTS** + grabación Full HD con **Playwright** + montaje **FFmpeg**). Consulta la [Guía Maestra de Videotutoriales](docs/VIDEOTUTORIALES_Y_MASTERCLASS.md) para acceder a los guiones técnicos detallados:

| Episodio | Título y Temática | Duración | Formato | Guión Técnico |
| :--- | :--- | :---: | :---: | :--- |
| **01** | **Identidad Criptográfica y Agenda Privada**<br>*Derivación determinista de IDs (PBKDF2), cero servidores y copias de seguridad JSON.* | 04:30 min | 🟢 1080p | [Ver Guión 01](docs/tutorials/01_identidad_y_agenda.md) |
| **02** | **Mapa en Tiempo Real, Geovallas y Persistencia**<br>*Precisión GPS adaptativa, zonas seguras con alertas sonoras y Screen Wake Lock.* | 05:00 min | 🟢 1080p | [Ver Guión 02](docs/tutorials/02_mapa_geovallas_persistencia.md) |
| **03** | **Workspace Cartográfico y Git en el Navegador**<br>*Grabación de tracks (REC), notas georreferenciadas y base de datos isomorphic-git.* | 06:30 min | 🟡 1080p | [Ver Guión 03](docs/tutorials/03_workspace_rutas_git.md) |
| **04** | **Comunicación Mesh, Streaming P2P e IA Local**<br>*Chat cifrado en malla, transferencia de rutas, streaming de vídeo y búsqueda vectorial ONNX.* | 06:00 min | 🟡 1080p | [Ver Guión 04](docs/tutorials/04_mesh_chat_streaming_ia.md) |
| **05** | **Servidor Doméstico Autónomo y Alpine Appliance**<br>*Nodo en Go con DuckDNS, auto-UPnP y flasheo de imagen SD inmutable para Raspberry Pi Zero.* | 07:00 min | 🔴 1080p | [Ver Guión 05](docs/tutorials/05_appliance_servidor_propio.md) |
| 🌟 | **Masterclass Completa (Todos los episodios unidos)** | **~29 min** | 🏆 **Full HD** | [Orquestador](docs/tutorials/scripts/orchestrator.js) |

> [!TIP]
> **¿Cómo generar o regenerar los vídeos?**
> ```bash
> cd /home/jose/workspace/pingo
> node docs/tutorials/scripts/orchestrator.js --all
> ```
> Los archivos `.mp4` finales se generan en `docs/tutorials/final/`.

---

<!-- pingo-user-guide-start -->
## 🚀 Primeros Pasos y Gestión de Identidad

Para comenzar a utilizar Pingo de forma segura y privada en cualquier dispositivo (móvil o escritorio):

1. **Establece tu Identidad Privada**:
   - En la pestaña **Red e Identidad** (icono <i class="fas fa-network-wired"></i>), pulsa en **Gestionar mi Identidad**.
   - Introduce tu **Alias** (el nombre con el que te verán tus contactos en el chat y notificaciones).
   - Introduce una **Frase Secreta** personal y una **Sal de Seguridad** (opcional pero recomendada).
   - Pulsa **Fijar Identidad**: Pingo generará de forma determinista un **ID único de 8 caracteres** mediante algoritmos criptográficos (`PBKDF2`).
   > [!NOTE]
   > Tu identidad no se guarda en ningún servidor central. Si cambias de teléfono o borras el navegador, basta con volver a escribir tu misma Frase y Sal para recuperar exactamente tu mismo ID y tus contactos.

2. **Añade a tus Contactos ("Mis Pingos")**:
   - Pulsa **Añadir a la Agenda**.
   - **Opción A (Recomendada)**: Introduce el Alias de tu contacto, su Frase Secreta y su Sal (si la conoces de mutuo acuerdo). El ID se derivará automáticamente.
   - **Opción B (Directa)**: Introduce su Alias y pega directamente su **ID de conexión de 8 dígitos** en el campo manual.
   - Pulsa **Guardar**.

3. **Compartir e Invitar Fácilmente**:
   - Usa el botón **Compartir mi ubicación** para enviar un enlace directo por WhatsApp, Telegram, correo o copiarlo al portapapeles.
   - Quien reciba el enlace podrá abrir Pingo y conectar contigo con un solo toque.

4. **Copias de Seguridad (Backup)**:
   - **Exportar**: Descarga un archivo `.json` cifrado localmente con tu agenda y configuración.
   - **Importar**: Restaura toda tu agenda y preferencias en un nuevo dispositivo al instante.

---

## 📡 Conectividad P2P, Cobertura y Servicios Nube

Pingo prioriza la conexión directa entre dispositivos (P2P vía WebRTC) para que tus coordenadas y mensajes viajen directamente entre vosotros sin pasar por servidores.

### ¿Cómo funciona la conexión?
- **Punto Verde en el Header**: Indica que tu dispositivo está conectado a la centralita de señalización y listo para recibir llamadas.
- **Punto Verde en el Contacto**: Conexión P2P directa establecida con éxito.
- **Punto Amarillo**: Negociando túnel WebRTC o en espera de respuesta.
- **Punto Rojo / Desconectado**: Contacto no disponible o bloqueado por firewall de red móvil.

### Éxito de conexión según el tipo de red (NAT Traversal)
| Escenario | Éxito P2P Directo | Comportamiento |
| :--- | :---: | :--- |
| **WiFi a WiFi** | **~99%** | Conexión directa inmediata (ideal para casa/oficina). |
| **WiFi a 4G/5G** | **~70%** | Conexión directa según el operador del móvil. |
| **5G a 5G / CGNAT estricto** | **~30%** | Requiere activar **Servicios en la Nube (TURN)**. |

### Servicios en la Nube (Relé TURN y Notificaciones Push)
En la pestaña **Localización** (icono <i class="fas fa-map-marked-alt"></i>), puedes activar el interruptor **Servicios en la Nube (Relay/Push)**:
- **Relé TURN**: Si dos móviles no pueden conectar de forma directa por restricciones de sus operadores (ej. Digi, Yoigo o redes corporativas), el tráfico viaja cifrado a través de un servidor relé intermedio. El relé **nunca** descifra tu ubicación ni tus mensajes.
- **Notificaciones Push**: Envía un aviso instantáneo al móvil de tu contacto para "despertar" su Pingo incluso con la pantalla apagada o la App cerrada.
- **Deep Linking**: Al tocar la notificación push recibida, el teléfono abre Pingo, conecta el túnel P2P de inmediato y despliega el chat.

---

## 🗺️ Mapa, Geolocalización en Vivo y Geovallas

Accede a la pestaña **Localización** (icono <i class="fas fa-map-marked-alt"></i>) para monitorizar el mapa interactivo:

1. **Ubicación en Tiempo Real**:
   - Tu marcador azul muestra tu posición satelital actual.
   - Los marcadores de tus contactos conectados muestran su ubicación en vivo junto a su Alias.
   - El **círculo semitransparente** representa la **Precisión GPS**: cuanto más pequeño, mayor es la precisión.
   - La **estela de rastro (trail)** dibuja el recorrido reciente para ver la dirección del movimiento.

2. **Geovalla (Zona Segura Local y Remota)**:
   - **Activar Geovalla**: Pulsa el interruptor *Zona segura activa*.
   - **Radio configurable**: Ajusta el control deslizante de 50 metros a 1000 metros.
   - **Centrar**: Pulsa *Centrar en mi posición* para fijar el perímetro de seguridad en tu ubicación o la de tu contacto.
   - **Alertas automáticas**: Si el contacto sale del círculo definido, tu dispositivo emitirá alertas sonoras y visuales automáticas.
   - **Geovalla Remota**: Sincroniza la zona de seguridad entre ambos teléfonos para supervisión mutua.

3. **Modo Persistente (Segundo Plano)**:
   - Activa el interruptor **Modo Persistente** para solicitar bloqueo de suspensión (*Screen Wake Lock*) y mantener el seguimiento activo sin que el sistema operativo corte la geolocalización.

4. **Fijación Manual de Ubicación**:
   - Si estás en interiores o en un entorno de pruebas sin cobertura GPS, puedes activar la fijación manual de coordenadas desde el pie de página.

---

## 📓 Workspace Cartográfico, Notas y Git Local

Pingo incluye un espacio de trabajo cartográfico offline completo en la pestaña **Workspace & Git** (icono <i class="fas fa-laptop-code"></i>):

1. **Grabación de Rutas en Vivo (`REC`)**:
   - Pulsa **Iniciar Grabación** para registrar tu trayecto (senderismo, ciclismo, viajes).
   - El HUD superior muestra el cronómetro en directo, distancia recorrida y número de puntos GPS capturados.
   - Al pulsar **Detener y Guardar**, podrás asignarle un nombre y elegir si la ruta es **Pública (Indexable)** o **Privada**.
   - La ruta se guarda instantáneamente como un **Commit en tu Repositorio Git local** (`isomorphic-git` en el navegador).

2. **Creación y Edición de Notas / POIs (Puntos de Interés)**:
   - Pulsa **Nueva Nota** para redactar textos, bitácoras o notas de campo georreferenciadas.
   - El editor integrado permite modificar contenido, ajustar visibilidad y confirmar los cambios en Git.

3. **Copia de Trabajo (*Working Copy*)**:
   - Al seleccionar una ruta o nota de tu lista, se carga en el visor superior (*Working Copy*).
   - Puedes proyectarla en el mapa, reanudar su edición, o enviarla por el chat.

4. **Grafo Visual de Commits (`Git Graph`)**:
   - Pulsa **Ver Grafo de Commits** para inspeccionar la genealogía visual de todas tus rutas, ramas, fechas y mensajes de guardado.

5. **Sincronización con Repositorios Remotos (Gitea / GitHub)**:
   - Configura la URL de tu repositorio remoto, tu usuario y tu Token personal.
   - Pulsa **Subir ⬆️ (Push)** para respaldar todas tus rutas en tu nube privada.
   - Pulsa **Bajar ⬇️ (Pull)** para sincronizar rutas desde otros dispositivos.

---

## 💬 Comunicación Mesh, Streaming y Búsqueda IA

En la pestaña **Comunicación** (icono <i class="fas fa-comments"></i>) dispones de herramientas de colaboración descentralizada:

1. **Chat P2P y Retransmisión en Malla (Mesh Relay)**:
   - Conversación en tiempo real cifrada extremo a extremo.
   - Si conectas con varios contactos simultáneamente, se forma una red de malla donde los mensajes se retransmiten de nodo a nodo sin servidor central.
   - **Compartir Rutas al Vuelo**: Pulsa el icono de carpeta en el chat para enviar tu última ruta grabada directamente al contacto activo.

2. **Streaming de Vídeo en Directo y Pantalla Compartida**:
   - Pulsa el icono de **Cámara** (<i class="fas fa-video"></i>) para emitir tu señal de vídeo en vivo.
   - Pulsa el icono de **Pantalla** (<i class="fas fa-desktop"></i>) para compartir tu escritorio o aplicaciones.
   - La emisión se propaga por la red de malla (relay), permitiendo que otros miembros conectados vean el directo sin sobrecargar un servidor.

3. **Búsqueda Híbrida Distribuida**:
   - **Búsqueda Exacta**: Indexación instantánea de textos completos (vía `MiniSearch`) en tus notas y rutas.
   - **Búsqueda Semántica con IA Local**: Busca por conceptos y significado ("ruta con río", "inspección de tubería") utilizando modelos de embeddings ejecutados 100% en local en un Web Worker.
   - **Búsquedas en la Red P2P**: Al buscar, puedes consultar de forma distribuida el material público compartido por tus contactos conectados.
   - **Controles de Privacidad**: Elige con interruptores independientes si deseas responder a búsquedas exactas o semánticas de otros peers.

---

## 📱 PWA, App Nativa y Capturador de YouTube

Pingo se adapta a cualquier plataforma:

1. **Instalación como PWA (Web App Progresiva)**:
   - En Chrome, Edge o Safari, pulsa el botón **Instalar** en la barra superior o "Añadir a pantalla de inicio".
   - Funciona sin conexión, con arranque instantáneo y experiencia a pantalla completa.

2. **App Nativa Android (Capacitor)**:
   - Mejor integración con los servicios de localización del sistema operativo y recepción de Push en segundo plano.

3. **Captura Automática de YouTube a Git**:
   - En la barra superior, pulsa el botón con el icono de **YouTube**.
   - Navega por YouTube dentro de la App: cada vez que pulses en un vídeo, Pingo interceptará los metadatos y creará automáticamente una ficha de texto con un **Commit Git** en tu historial cartográfico. Ideal para guardar reviews de lugares o guías de viaje vinculadas a tus rutas.

---

## 📤 Compartir Ficheros y Contenidos desde Otras Apps a tu Red

Pingo permite actuar como un puente de compartición descentralizado (*Share Target*) para enviar textos, enlaces, coordenadas o rutas directamente desde cualquier otra aplicación de tu móvil o navegador hacia tus contactos conectados:

### 1. ¿Cómo enviar contenido desde otra aplicación?
1. En cualquier aplicación (Google Maps, Chrome, visor de archivos, WhatsApp, apps de senderismo, etc.), pulsa la opción nativa **Compartir** del sistema.
2. Selecciona **Pingo** en la lista de aplicaciones disponibles.
3. Pingo se abrirá (o pasará al primer plano) e interceptará automáticamente el contenido compartido a través del manejador nativo (*Android Share Target*).

### 2. ¿Cómo viaja la información a tus contactos?
- El contenido recibido se inyecta de forma transparente en el **Chat P2P**.
- Desde allí, se transmite de forma cifrada punto a punto (WebRTC) a todos los *Pingos* conectados en tu red de malla (o a un contacto específico).
- **Cero intermediarios**: El contenido viaja directamente de dispositivo a dispositivo sin subirse a la nube ni a servidores de mensajería comercial.

### 3. ¿Cómo lo reciben y descargan los destinatarios?
- **Mensajes y Enlaces**: Aparecen al instante en el flujo de conversación de tus contactos conectados con un aviso sonoro/visual.
- **Rutas Cartográficas y Ficheros Git**:
  1. Al recibir una ruta, el destinatario verá una ventana modal interactiva:  
     *«Ping@ [Tu Alias] quiere compartir una ruta contigo: "[Nombre de la ruta]". ¿Aceptar e importar a tu colección?»*.
  2. Si pulsa **Aceptar**, Pingo descarga la ruta por el canal de datos P2P, genera un **Commit Git local** en el almacenamiento de su navegador (`lightning-fs`) y la añade a su catálogo de rutas.
  3. A partir de ese momento, la ruta queda **disponible 100% offline** en el dispositivo del receptor para visualizarla en el mapa o proyectarla en cualquier momento.

---

## 🔬 Funcionalidades Avanzadas de Arquitectura, Diagnóstico y Privacidad

Para usuarios avanzados, auditores de seguridad o entornos técnicos exigentes, Pingo incorpora mecanismos de bajo nivel diseñados para garantizar la máxima resiliencia, rendimiento de batería y soberanía de datos:

### 1. 🛡️ Control Inteligente Multi-pestaña (*Web Locks & Modo Pasivo*)
- **El problema en navegadores web**: Si abres una aplicación de geolocalización en múltiples pestañas o ventanas, cada una intentará abrir un túnel WebRTC independiente y solicitar lecturas continuas al chip GPS, lo que multiplica el consumo de batería y genera colisiones de conexión.
- **La solución de Pingo**: Mediante el estándar **Web Locks API**, Pingo negocia automáticamente un candado atómico (`primary-tab-lock`).
  - **Pestaña Activa**: Mantiene la conexión de señalización exclusiva, el polling GPS y la difusión de coordenadas.
  - **Pestañas Secundarias (*Modo Pasivo*)**: Muestran un banner amarillo informativo (*«Modo Pasivo: Otra pestaña tiene el control del GPS y P2P»*) y apagan los sensores pesados en segundo plano para ahorrar recursos. Si cierras la pestaña principal, una de las secundarias toma el relevo automáticamente al instante.

### 2. 📊 Consola de Diagnóstico de Red en Tiempo Real (*Network Stats Modal*)
- **Inspección de túneles WebRTC**: Al pulsar sobre el indicador de red de cualquier contacto, Pingo despliega una consola interactiva con telemetría en vivo del canal de datos:
  - **Latencia (*RTT / Round-Trip Time*)**: Tiempo exacto en milisegundos que tarda un paquete en ir y volver entre dispositivos.
  - **Tipo de Candidato ICE**: Informa si la conexión es directa en red local (**Host**), si pasa por mapeo de puertos público (**STUN / srflx**) o si está requiriendo puente cifrado (**Relay TURN**).
  - **Métricas de Rendimiento**: Contador de paquetes enviados/recibidos, bytes transferidos, paquetes perdidos (*packet loss*) y tasa de refresco.

### 3. 🧠 Inteligencia Artificial 100% On-Device (Cero Nube, Cero Fugas)
- **Privacidad Absoluta**: A diferencia de la mayoría de aplicaciones con búsqueda semántica que envían tus textos a servidores externos (OpenAI, Google o APIs comerciales), Pingo procesa todo en tu propio procesador.
- **Tecnología**: Emplea **ONNX Runtime WebAssembly compilado con soporte SIMD multihilo** ejecutándose dentro de un **Web Worker** aislado.
- **Indexación Vectorial Local**: Cuando pulsas *Re-indexar Contenido*, el modelo genera vectores matemáticos (*embeddings*) de tus notas y rutas directamente en la memoria del navegador. Las búsquedas conceptuales (ej. buscar "cruce peligroso" y encontrar "bifurcación con tráfico") se resuelven en local en pocos milisegundos sin conexión a Internet.

### 4. 🔀 Trazabilidad, Forks y Genealogía en Git (*Git Graph*)
- **Historial Inmutable**: Cada vez que grabas un track, creas una nota o guardas un vídeo de YouTube, Pingo genera un árbol de commits criptográficos (`SHA-1`) mediante `isomorphic-git` sobre una base de datos local `IndexedDB`.
- **Forks Colaborativos**: Cuando aceptas una ruta enviada por un contacto, no se sobreescribe ni se pierde la autoría original: Pingo genera un commit de importación con trazabilidad (`Imported from [Alias] ([PeerID])`).
- **Visor GitGraph**: Al pulsar **Ver Grafo de Commits**, se dibuja un diagrama SVG interactivo que muestra las distintas ramas, fusiones, fechas y puntos de bifurcación de tu colección cartográfica.

### 5. 🏷️ Enrutamiento Mesh y Detección de Saltos en Vídeo (*Broadcast Tags*)
- **Retransmisión Multi-nodo**: En emisiones de cámara o pantalla compartida dentro de un grupo, el flujo multimedia puede viajar a través de un compañero intermedio si no hay conexión directa con el emisor.
- **Etiquetas de Topología**: El visor de vídeo identifica automáticamente el origen real del directo y el nodo que actúa como puente (ej. `Pingo: Elena (vía Lucas)`).
- **Control Táctil**: Puedes pulsar sobre cualquier transmisión de vídeo para expandirla a vista completa (*Grid focus*) o mantenerla como ventana flotante.

### 6. 🔄 Actualización Forzada y Reseteo de Caché PWA (`#force-reset-btn`)
- Para entornos con conectividad intermitente o cuando se despliega una nueva versión de la aplicación, en la pestaña de Localización dispones de un botón de **Forzar Actualización (Caché)**.
- Este mecanismo desregistra limpiamente el *Service Worker*, renueva las cachés de *Workbox* y recarga los módulos ES6 más recientes sin requerir borrar manualmente los datos del navegador del usuario.

### 7. 🌐 Servidores Propios, Relé TURN, DuckDNS y UPnP
- **¿Por qué un servidor propio?**: Te permite tener soberanía total de tus comunicaciones y garantizar que siempre puedas conectar con tus contactos, incluso en redes móviles 5G/4G o tras cortafuegos simétricos.
- **DuckDNS Dinámico**: Con un subdominio gratuito (`mi-nodo.duckdns.org`), no tienes que preocuparte si tu proveedor de internet cambia tu IP pública periódicamente.
- **UPnP Automático**: Si ejecutas el binario independiente de Pingo en tu casa, el protocolo UPnP abre automáticamente los puertos necesarios (`3478 UDP` y `9000 TCP`) en tu router.
- **Emparejamiento en 1 Segundo**: Desde la app Pingo, pulsa en *Ajustes &rarr; Servidores Personalizados* e importa el código QR o el JSON generado por tu nodo doméstico.

---

## 💡 Casos de Uso Prácticos y Escenarios Reales

### 👨‍👩‍👧 Caso 1: Protección Familiar y Cuidado Preventivo
- **Objetivo**: Supervisar la vuelta del colegio de los hijos o los paseos de personas mayores con total privacidad.
- **Paso a paso**:
  1. Configura la misma identidad o añade el contacto en ambos teléfonos.
  2. Activa **Servicios en la Nube (Push)** en el teléfono a supervisar para garantizar avisos con pantalla bloqueada.
  3. En tu teléfono, activa una **Geovalla** de 150m centrada en el colegio o el hogar.
  4. Si la persona sale del perímetro, recibirás un aviso sonoro al instante sin que ninguna empresa comercial rastree sus pasos.

### 🚴 Caso 2: Senderismo, Ciclismo y Deporte de Montaña
- **Objetivo**: Registrar tracks de excursiones, compartirlos entre compañeros y mantener la seguridad en zonas remotas.
- **Paso a paso**:
  1. Antes de iniciar la marcha, entra en **Workspace & Git** y pulsa **Iniciar Grabación**.
  2. Activa el **Modo Persistente** en la pestaña de Localización para evitar que el móvil apague el GPS.
  3. Durante la ruta, añade **Nuevas Notas** con fuentes de agua, cruces o puntos de descanso (POIs).
  4. Al finalizar la ruta, guárdala en Git. Conéctate por P2P con tus compañeros y envíales el track completo mediante el botón de compartir ruta en el Chat.

### 👥 Caso 3: Coordinación de Grupos en Eventos y Operativos
- **Objetivo**: Mantener a un grupo conectado en festivales, ferias, manifestaciones o equipos de búsqueda.
- **Paso a paso**:
  1. Todos los miembros agregan los IDs del resto en su Agenda.
  2. La app crea automáticamente un **enjambre Mesh**: los mensajes de chat se retransmiten entre todos los terminales.
  3. Si un miembro necesita asistencia o mostrar una situación, pulsa el botón de **Compartir Cámara** para emitir vídeo en directo al grupo.

### 🔬 Caso 4: Cuaderno de Campo y Bitácora Distribuida de Investigación
- **Objetivo**: Equipos de geología, inspección técnica, arqueología o periodistas documentando hallazgos sobre el terreno.
- **Paso a paso**:
  1. Graba los desplazamientos y redacta notas técnicas detalladas en el editor integrado.
  2. Pulsa **Re-indexar Contenido** para procesar los embeddings de IA local.
  3. Cuando los compañeros del equipo se conecten a la red P2P, pueden usar la **Búsqueda Semántica** para localizar notas conceptuales ("muestra mineral", "grieta en estructura") compartidas por los demás.
  4. Al regresar a la base, sube todo el histórico con **Git Push** al servidor central de la organización (Gitea).

### 🗺️ Caso 5: Planificación de Viajes y Curación de Rutas Multimedia
- **Objetivo**: Diseñar una guía interactiva de viaje que combine tracks GPS, notas personales y vídeos explicativos.
- **Paso a paso**:
  1. Utiliza el navegador de **YouTube** de Pingo para explorar vídeos sobre puntos emblemáticos de tu próximo destino.
  2. Guarda automáticamente las reseñas en tu repositorio Git.
  3. Añade notas complementarias con horarios y recomendaciones.
  4. Exporta tu copia de seguridad o sincronízala por Git para tener toda la guía disponible offline durante tu viaje.

---

## ❓ Preguntas Frecuentes y Solución de Problemas (FAQ)

### ¿Por qué mi ID de conexión nunca cambia?
Pingo no genera identificadores aleatorios volátiles. Tu ID se deriva matemáticamente mediante criptografía de tu Frase Secreta y Sal. Mientras uses la misma frase, tu identidad será la misma en cualquier dispositivo.

### ¿Por qué mi contacto tiene un punto amarillo o rojo y no puedo conectar?
El 90% de los fallos de conexión en redes móviles se deben a que los operadores móviles utilizan cortafuegos (*Symmetric NAT* / CGNAT). Para solucionarlo, entra en la pestaña **Localización** y activa el interruptor **Servicios en la Nube (Relay/Push)** en ambos terminales.

### ¿Por qué el rastro o mi posición no se actualizan al bloquear la pantalla?
Muchos sistemas operativos (especialmente Android con optimización de batería agresiva y iOS) suspenden el navegador al apagar la pantalla. Para evitarlo:
1. Instala la aplicación como **PWA** o utiliza la versión nativa.
2. Activa el interruptor **Modo Persistente** en la pestaña de Localización.
3. En los ajustes de tu teléfono, desactiva la "Optimización de batería" para Pingo.

### ¿Mis rutas y coordenadas se almacenan en servidores externos?
**No.** En Pingo, tus coordenadas solo se transmiten punto a punto a los contactos con los que te hayas conectado activamente. Las rutas y notas se guardan en el almacenamiento interno de tu navegador (`IndexedDB`) bajo formato Git. Solo se sincronizarán externamente si configuras de forma voluntaria tu propio servidor Git remoto.
<!-- pingo-user-guide-end -->

---

## 🛠️ Detalles Técnicos y Arquitectura

- **P2P Directo**: Comunicación cifrada y directa vía WebRTC DataChannels y MediaStreams.
- **Relé TURN Opcional**: Supera cortafuegos y CGNAT mediante servidor relé Coturn propio con autenticación dinámica.
- **Cero Servidores Centrales**: Sin base de datos de usuarios en la nube; máxima privacidad y soberanía de datos.
- **Notificaciones Push**: Estándar Web Push con VAPID para despertar dispositivos en segundo plano.
- **Deep Linking**: Enlaces universales para apertura y establecimiento inmediato de túneles P2P.
- **Smart Geolocation**: Doble motor de geolocalización con caché rápida y fallback de precisión adaptativa.
- **Control de Versiones Git**: Motor `isomorphic-git` con sistema de ficheros virtual `lightning-fs` en navegador.
- **Búsqueda Semántica On-Device**: Procesamiento de vectores en Web Worker para privacidad absoluta sin APIs de terceros.
- **Servidor Independiente Doméstico (`server/`)**: Binario en Go con PeerJS, relé Pion TURN, auto-apertura UPnP para routers, sincronización periódica con DuckDNS y asistente interactivo CLI/Web. Más detalles en [`server/README.md`](file:///home/jose/workspace/pingo/server/README.md) y [`P2P.md`](file:///home/jose/workspace/pingo/P2P.md).

## 📱 Compilación Nativa (Android) con Capacitor

Si deseas generar el paquete APK/AAB para Android:

1. **Generar el build web optimizado**:
   ```bash
   npm run build
   ```
2. **Sincronizar assets con Capacitor**:
   ```bash
   npx cap sync android
   ```
3. **Abrir en Android Studio**:
   ```bash
   npx cap open android
   ```
   *Desde Android Studio, pulsa "Run" para instalar en tu dispositivo o emulador.*

## 🛠️ Tecnologías Principales

- **Frontend**: Vanilla ES6 Modules + CSS3 moderno (Glassmorphism, dark palette).
- **Mapas**: Leaflet.js con teselas optimizadas CartoDB Dark.
- **Conectividad P2P**: PeerJS / WebRTC.
- **Versionado Local**: isomorphic-git + lightning-fs.
- **Búsqueda**: MiniSearch (exacta) + Web Worker Vector Embeddings (semántica).
- **Entorno Nativo**: Capacitor 6.

---
*Desarrollado con ❤️ para ser la forma más sencilla, potente y privada de conectar, explorar y cuidar de los tuyos.*
