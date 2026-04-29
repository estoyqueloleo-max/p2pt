# 🐧 Pingo - Real-time P2P Location

> [!TIP]
> Si vas a sincronizar tus rutas con un servidor privado, consulta esta guía sobre [Gitea y CORS](https://people.iola.dk/arj/2020/04/28/gitea-and-cors/) para configurar el acceso desde la App.

Pingo es una herramienta de geolocalización en tiempo real diseñada para ser **privada, ligera y persistente**.

<!-- pingo-user-guide-start -->
## 🚀 Cómo configurar tu Pingo

Para empezar a usar Pingo de forma segura, sigue estos pasos:

1.  **Establece tu Identidad**:
    - Abre el panel de **Configuración** (icono de engranaje ⚙️).
    - En el apartado **MI IDENTIDAD**, introduce tu **Alias/Nombre**, una **Frase Secreta** y una **Sal**.
    - Pulsa **Fijar Identidad**. Esto generará un ID único de 8 dígitos. Tu **Alias** es el nombre que verán los demás cuando les envíes un aviso (Push) o chatees con ellos. Si pierdes el móvil, puedes recuperar el mismo ID usando la misma frase y sal en otro dispositivo.

2.  **Añade a tus "Pingos" (Contactos)**:
    - Para ver a otra persona, necesitas añadirla a tu **Agenda**.
    - Pídeles su **Frase Secreta** y **Sal** (o que te pasen su link de invitación).
    - **Novedad**: También puedes añadirlos usando su **ID de conexión (manual)** si no usan frases secretas.
    - ¡Listo! Ahora aparecerán en tu lista.

3.  **Servicios en la Nube (Opcional)**:
    - Si tienes problemas de conexión (especialmente en 4G/5G), activa **Servicios en la Nube** en Ajustes.
    - Esto habilita el **Relé TURN** (servidor intermedio) y las **Notificaciones Push** para cuando la App está cerrada.

## 📡 Conexión y Cobertura (P2P)

Pingo usa tecnología P2P directa para conectar dispositivos. El éxito de la conexión depende de tu red:

| Escenario | Éxito P2P | Nota |
| :--- | :--- | :--- |
| **WiFi a WiFi** | **~99%** | Ideal para casa/oficina. |
| **WiFi a 4G/5G** | **~70%** | Depende del operador móvil. |
| **5G a 5G** | **~30%** | Requiere activar "Servicios Nube" (TURN). |

### Comportamiento por Operador (España)
| Operador | Calidad P2P | Solución si falla |
| :--- | :--- | :--- |
| **Movistar / O2** | Excelente | No requiere ajustes extra. |
| **Vodafone** | Excelente | Funciona directo casi siempre. |
| **Orange / Jazztel** | Buena | Generalmente estable. |
| **Digi / Yoigo** | Limitada | **Activa Servicios en la Nube (TURN)**. |

---

## 📱 Uso Diario

- **Conexión Local**: Pulsa el icono de la flecha (🚀) en un contacto para intentar conectar con él. Si ambos estáis con la App abierta, os veréis en el mapa.
- **Grupos y Chats**: Al conectar con varios contactos, se forma un "enjambre" P2P. Los mensajes de chat se retransmiten automáticamente entre todos los conectados (relay), permitiendo chats grupales privados y fluidos.
- **Geovalla**: Puedes activar una zona segura para un contacto. Tu móvil te avisará si esa persona se sale del radio que hayas configurado. Las geovallas son privadas: tu móvil vigila al otro sin guardar datos en servidores.
- **Pingo Routes (Modo Cartografía)**: Graba tus rutas y trayectos en tiempo real. Pingo utiliza un repositorio Git local (en tu navegador) para guardar el historial con total trazabilidad e inmutabilidad. Puedes compartir estas rutas con otros Pingos de forma directa (P2P) y ellos podrán importarlas a su propia colección.

## ✨ Preguntas Frecuentes

- **¿Por qué mi ID es siempre el mismo?**: Pingo usa criptografía avanzada (PBKDF2) para generar tu identidad a partir de tu Frase Secreta. Esto permite que recuperes tu ID y tus contactos incluso si cambias de móvil, simplemente usando la misma frase.
- **¿Qué es el círculo transparente en el mapa?**: Indica la **Precisión GPS**. Cuanto más pequeño sea el círculo, más exacta es la ubicación de tu contacto. Si el círculo es grande, es posible que la persona esté dentro de un edificio o con mala cobertura satelital.
- **¿Por qué desaparece el rastro (trail)?**: Para que la App vuele, los rastros tienen un límite de 500 puntos. Solo verás la estela completa de tus contactos mientras ellos estén grabando una ruta (REC).
<!-- pingo-user-guide-end -->

## 🛠️ Detalles Técnicos

- **P2P Directo**: Comunicación cifrada y directa vía WebRTC.
- **Relé TURN (Opcional)**: Supera firewalls restrictivos y redes móviles mediante un servidor de relé propio.
- **Cero Servidores Centrales**: Tus coordenadas no se guardan en la nube (el backend solo gestiona credenciales y el relé nunca descifra el contenido).
- **Notificaciones Push (Modo Híbrido)**: Pingo utiliza el estándar Web Push para despertar dispositivos. Cuando envías un "Ping", el servidor en la nube busca la suscripción del receptor y le envía un aviso instantáneo que funciona incluso con la App cerrada.
- **Deep Linking Inteligente**: Las notificaciones incluyen un enlace dinámico que, al ser pulsado, abre la App, establece la conexión P2P automáticamente y despliega el panel de chat para una respuesta inmediata.
- **Smart Geolocation**: Sistema de doble vía con inicio rápido (caché) y fallback automático a baja precisión en interiores.
- **Versión Sincronizada**: El script `./v.sh` garantiza que todos los módulos y el Service Worker estén siempre actualizados y libres de caché.
- **Trazabilidad Git**: Gestión de historial de rutas mediante `isomorphic-git` sin servidores.
- **Git Proxy (Relé)**: El backend permite sincronizar tu repositorio local con remotos externos (como GitHub) de forma segura.

## 📱 Versión Nativa (Android/iOS) con Capacitor

Pingo puede ejecutarse como una App nativa real para aprovechar funciones avanzadas como la interceptación de contenido externo.

### 🎥 Captura de YouTube a Git
La versión nativa incluye un botón de **YouTube** que permite:
1. Abrir la versión móvil de YouTube en un navegador interno controlado.
2. Interceptar cada clic que hagas en un enlace de vídeo (`/watch?v=...`).
3. Generar automáticamente un archivo `.txt` con los detalles del vídeo y realizar un **Git Commit** instantáneo en tu repositorio local de rutas para guardarlo en tu historial.

### 🛠️ Cómo compilar la App Nativa
Si estás en un entorno de desarrollo con Android Studio instalado:

1.  **Genera el build web**:
    ```bash
    npm run build
    ```
2.  **Sincroniza con Capacitor**:
    ```bash
    npx cap sync android
    ```
3.  **Abre en Android Studio**:
    ```bash
    npx cap open android
    ```
    *Desde Android Studio, pulsa "Run" para instalarla en tu dispositivo físico o emulador.*


## 🛠️ Tecnologías

- **Arquitectura**: Modular ES6 (directorio `js/`).
- **Mapas**: Leaflet.js (CartoDB Dark).
- **Conectividad**: PeerJS (P2P / WebRTC).
- **PWA**: Instalable en Android/iOS como una App nativa.
- **Seguridad**: Web Crypto API (SHA-256 / PBKDF2) para identidades privadas.
- **Versionado**: isomorphic-git + lightning-fs para persistencia robusta de rutas.

---
*Desarrollado con ❤️ para ser la forma más sencilla y privada de cuidar de los tuyos.*
# p2pt
