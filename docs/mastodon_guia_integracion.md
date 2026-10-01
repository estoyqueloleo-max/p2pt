# Integración Mastodon / Fediverso en Pingo

Esta guía detalla la arquitectura implementada para ofrecer tanto **clientes web PWA inmediatos (Phanpy)** como **publicación directa de rutas (Toots con metadata y GPX)** y soporte para **aplicaciones nativas del Fediverso**.

---

## 1. Tres Modos de Experiencia de Usuario

```mermaid
graph TD
    A[Usuario en Pingo] -->|Opción A: Tiene App Nativa| B(Tusky / Mona / Ivory / IceCubes)
    A -->|Opción B: Sin App instalada| C(PWA Phanpy / Elk vía Web)
    A -->|Opción C: Publicar Ruta| D[Modal Compartir en Fediverso]

    B -->|OAuth / API| GTS[GoToSocial en Appliance]
    C -->|Web / API| GTS
    D -->|POST /api/v1/statuses| GTS
    D -->|Web Intent /share?text=...| C

    GTS <-->|ActivityPub / Federation| FEDI[Red Global del Fediverso: Mastodon, Pixelfed, Lemmy]
```

### Modo A: Clientes Nativos (Móvil / Desktop)
* Apps compatibles: **Tusky** (Android), **Mona / Ivory** (iOS/macOS), **Ice Cubes** (iOS/iPadOS), **Whalebird / Elk** (Desktop).
* El usuario simplemente introduce su dominio propio: `tunodo.duckdns.org` y su usuario `@admin@tunodo.duckdns.org`.

### Modo B: Acceso Inmediato PWA (Phanpy)
* Para usuarios que no tienen ninguna app instalada en su móvil o que están en un navegador web:
* Pulsando el botón con el icono de Mastodon en la barra superior de Pingo, se abre directamente **Phanpy PWA**:
  `https://phanpy.social/#tunodo.duckdns.org`
* **Phanpy** es una PWA ultraligera, optimizada para móviles, compatible con GoToSocial y sin necesidad de instalar nada desde tiendas de aplicaciones.

### Modo C: Publicar Rutas Directamente
* En la lista de rutas (`Mis Rutas`), cada elemento dispone ahora de un botón específico con el icono de Mastodon.
* Al pulsarlo, se abre el **Modal de Compartir en Fediverso**, que genera automáticamente un toot con la ficha de la ruta:
  - Nombre del track
  - Puntos GPS y estadísticas
  - Fecha de grabación
  - Enlace directo a Pingo para visualizar o clonar en P2P
  - Hashtags federados (`#pingo #senderismo #gpx #fediverse`)
* Ofrece dos vías de envío:
  1. **Publicar directo:** Mediante el API REST de Mastodon (`POST /api/v1/statuses`) usando un token con alcance `write:statuses`.
  2. **Compositor Web / PWA:** Abre el compositor de la instancia con el texto ya pre-rellenado para editarlo o adjuntar fotos antes de enviar.

---

## 2. Diagrama de Secuencia: Publicación de Ruta

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant UI as Pingo UI (Rutas)
    participant MM as MastodonManager.js
    participant GTS as Reverse Proxy (p2pt-server :443)
    participant BE as GoToSocial Core (:8080)
    participant FEDI as Red Fediverso Externa

    U->>UI: Clic en botón Mastodon de la Ruta
    UI->>MM: formatRouteToot(route)
    MM-->>UI: Texto formateado con métricas y enlaces
    UI->>U: Muestra Modal con texto y opciones

    alt Vía API Directa (Token write:statuses)
        U->>UI: Clic en "Publicar"
        UI->>MM: publishToot({instanceUrl, token, statusText})
        MM->>GTS: POST /api/v1/statuses (Bearer token)
        GTS->>BE: Proxy HTTP a 127.0.0.1:8080
        BE->>BE: Guarda Status en SQLite local
        BE-->>GTS: 200 OK + JSON (id, url)
        GTS-->>MM: 200 OK
        par Federación ActivityPub
            BE->>FEDI: POST Inbox seguidores (ActivityPub Create Note)
        end
        MM-->>UI: Notificación de éxito con enlace al toot
    else Vía Compositor Web (Sin Token)
        U->>UI: Clic en "Compositor Web"
        UI->>MM: openWebComposer(instanceUrl, statusText)
        MM->>U: Abre https://instancia/share?text=... o Phanpy PWA
    end
```

---

## 3. Estructura de Archivos Modificados

| Componente | Archivo | Función |
| :--- | :--- | :--- |
| **Cliente JS** | [`src/js/mastodon-manager.js`](file:///home/jose/workspace/pingo/src/js/mastodon-manager.js) | Lógica de formateo de toot, API REST y lanzador de PWA. |
| **Interfaz HTML** | [`index.html`](file:///home/jose/workspace/pingo/index.html) | Botón de acceso PWA en cabecera y modal de publicación de rutas. |
| **Controlador UI** | [`src/js/ui-manager.js`](file:///home/jose/workspace/pingo/src/js/ui-manager.js) | Eventos del modal, botón en tarjetas de ruta y validaciones. |
| **Handshake P2P** | [`src/js/peer-manager.js`](file:///home/jose/workspace/pingo/src/js/peer-manager.js) | Auto-descubrimiento de la URL de Mastodon desde la config del appliance. |
| **Proxy Go** | [`server/gotosocial_proxy.go`](file:///home/jose/workspace/pingo/server/gotosocial_proxy.go) | Reverse proxy con soporte TLS, CORS y cabeceras ActivityPub. |
| **Servicio OpenRC** | [`server/services/gotosocial`](file:///home/jose/workspace/pingo/server/services/gotosocial) | Script de arranque para Alpine Linux en Raspberry Pi / x86. |

---

## 4. Ejemplo del Toot Generado

```text
🌲 ¡Nueva ruta grabada con Pingo! 🚴‍♂️

📍 "Subida al Pico del Teide"
📊 Puntos GPS: 1420
📅 Fecha: 1/10/2026

Explora el track o sincroniza en P2P:
https://miserver.duckdns.org

#pingo #senderismo #outdoor #gpx #tracks #fediverse #activitypub
```
