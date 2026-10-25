# 📌 Próximos Pasos (Prioridad Alta)
- [ ] **Trazabilidad y Resiliencia de Conexión con el Appliance (Cliente y Servidor)**:
  - *Problema*: La conexión arranca bien con el appliance pero se degrada o pierde silenciosamente al rato (inactividad, Doze mode en móviles, expiración de credenciales TURN o corte de sockets).
  - *En el Cliente (Web/PWA)*:
    - Ring-buffer en memoria de telemetría (últimos 100 eventos): registrar estados de PeerJS (`open`, `disconnected`, `close`, `error`) y de WebRTC (`iceConnectionStateChange`, `connectionStateChange`).
    - Ping/Pong a nivel de aplicación cada 30s sobre el WebSocket de señalización para detectar desconexión antes de que el SO congele el socket; disparar `peer.reconnect()` si no hay respuesta en 10s.
    - Panel/modal de diagnóstico en la UI ("Ver log de conexión") con opción de "Copiar informe" para soporte.
  - *En el Servidor (Appliance)*:
    - Structured logging en `p2pt-server` con Client-ID, timestamps y códigos de cierre WebSocket (`1000 normal`, `1006 abnormal/timeout`).
    - Auditoría de CoTURN / TURN logs: vigilar si las sesiones de relé expiran por falta de peticiones `Refresh` periódicas de WebRTC (por defecto 10 min).
- [ ] **Diagnóstico del Test de Conexión en Móviles (SSL / Red)**:
  - *Problema*: En algunos móviles el test de conectividad (`testServerConnectivityUI`) falla o entra en timeout aunque el certificado sea público y emitido por Let's Encrypt.
  - *Causas a validar y resolver*:
    1. **Cadena SSL Incompleta (Fullchain vs Cert)**: Servir `fullchain.pem` en Apache/Reverse Proxy del appliance en lugar de solo `cert.pem`. Los navegadores de escritorio descargan la intermedia (AIA fetching) o la tienen en caché, pero Safari iOS y Android WebView rechazan la conexión inmediatamente si falta la CA intermedia.
    2. **NAT Loopback / Hairpinning**: Si el móvil está en la misma red Wi-Fi (`192.168.1.x`) e intenta acceder a `salon.appliances.klitosan.com` (IP pública `79.112.20.12`), muchos routers descartan el tráfico saliente-entrante en el mismo puerto WAN. Probar en 4G/5G vs Wi-Fi o implementar fallback automático a IP LAN cuando se detecte estar en la misma subred.
    3. **CORS en el endpoint HTTP**: Asegurar que las peticiones `fetch()` a `candidateEndpoints` respondan con cabeceras `Access-Control-Allow-Origin: *`.
    4. **Puerto explícito en SNI**: En `${proto}://${host}:${port}`, evitar adjuntar `:443` en HTTPS para evitar problemas de SNI en webviews móviles antiguos.
- [ ] **Revisar descubrimiento P2P**: Creo que el problema es que empieza a escanear urls (de servidor P2P) que no son la que le hemos dado a la configuracion ... hay que revisar la parte de "subir el hash".


- [ ] **Revisar api de maps que se usa**: Porque parece que era CartoDb por debajo y ahora pide apikey.
- [ ] **Configuración de VAPID en producción**: Mover las claves VAPID a variables de entorno en Cloudflare.
- [ ] **Gitea CORS Config**: Configurar `app.ini` en la RPi para permitir CORS.
- [ ] **Estrategia de fondo híbrida**: Cola de sincronización (IndexedDB + Background Sync) para no perder puntos GPS offline.
- [ ] **Temas del Mapa**: Selector modo Claro/Oscuro.
- [ ] **Investigación CGNAT**: Estudiar comportamiento de operadores 5G e IPv6.

# 🧠 Funcionalidades Core (Git, P2P, Búsqueda, Identidad)
- [ ] **Identidades**: Revisar si puede haber colisión con los números (IDs) generados.
- [ ] **Entropía, Unicidad y Modelo Criptográfico de Identidad (ECDSA P-256)**:
  - *Problema*: La clave criptográfica actual se deriva determinísticamente de `deriveKeyPairFromPhrase(phrase, salt)`. Si dos usuarios usan la misma frase y salt, sus claves privadas y públicas son idénticas y tienen la misma identidad ECDSA.
  - *Opciones de solución*:
    1. **Salt de dispositivo único (Híbrido)**: Generar un `device_salt` criptográfico aleatorio único (16 bytes hex) por dispositivo persistido en IndexedDB. La derivación usa `phrase + salt + device_salt`. Dos personas con la misma clave nunca colisionan. La migración de móvil requiere backup o código QR de emparejamiento.
    2. **Generación aleatoria pura + Passphrase para cifrado de Vault (Modelo Signal/WhatsApp)**: El par de claves ECDSA se genera 100% aleatorio (`crypto.subtle.generateKey`), y la frase secreta sólo actúa como clave de descifrado del almacén/backup.
    3. **Mnemonics con alta entropía (BIP-39)**: Migrar a frases semilla estándar de 12 o 24 palabras aleatorias (128-256 bits de entropía real) donde estadísticamente la probabilidad de colisión es cero.
- [ ] **Vinculación / Auto-Login Mastodon en Pingo**: Consumir datos federados del appliance (`serverConfig.mastodon`) para autenticar al usuario vía OAuth transparente sin formularios externos.
- [ ] **Evolucionar el webview**: Navegar por páginas, "guardarlas" y firmarlas en un commit.
- [ ] **Opción de conectar fuera de PeerJS**: Explorar conexión directa o a través de otra red PeerJS.
- [ ] **Geovallas Avanzadas**: Dibujo de zonas a mano alzada y catálogo de geocercas guardadas.

# 🎨 UI & UX
- [ ] **Traducción**: Traducir al inglés.
- [ ] **Skin de colores**: Opción para cambiar el esquema de colores general.
- [ ] **Colores en el chat**: Mejorar colores (botón descargar primero opción avanzado).
- [ ] **Modo Senior**: Interfaz adaptada para personas mayores e investigación de integración con sistemas de cámaras.

# 📱 PWA, Android & Integraciones Nativas
- [ ] **Instant app de Android**: O botón directo de PlayStore.
- [ ] **Cliente nativo de git**: Desde la app nativa montar cliente para poder hacer push al gitea privado sin usar la web (si aplica tras isomorphic-git).
- [ ] **Emparejamiento por QR**: Generar un QR para vinculación rápida de contactos.
- [ ] **TWA (Trusted Web Activity)**: Empaquetar en APK para auto-arranque y persistencia.
- [ ] **Manual de optimización de batería**: Documentación para Android.
- [ ] **Alertas de Batería**: Enviar el nivel de batería restante junto con la ubicación.

# 🌐 Infraestructura P2P Avanzada & Appliance de Red
- [ ] **Gestión de la actualización de IPs de DuckDNS**: Automatizar y robustecer la detección y refresco dinámico de IPs (IPv4 pública y IPv6 global `AAAA`), control de cambios de red/IP, reintentos con backoff y sincronización con el relé TURN / señalización.
- [ ] **Túnel Inverso Ligero para Señalización + SSL**: Integrar cliente de túnel saliente (Cloudflare Tunnel / BoringProxy) en `p2pt-server` para resolver CGNAT y certificados HTTPS/WSS sin abrir puertos (ver detalle en [P2P.md Sección 12](file:///home/jose/workspace/pingo/P2P.md#12-análisis-de-escenarios-críticos-cgnat-estricto-tráfico-de-medios-y-próximos-pasos-de-red)).
- [ ] **Soporte Nativo IPv6 y DuckDNS (AAAA)**: Registrar IPv6 global de la RPi Zero y añadir validación de reglas de firewall *pinhole* en el dashboard.
- [ ] **Clasificación RFC de Tipo de NAT en Go**: Implementar escáner en `p2pt-server` para detectar si la conexión es *Symmetric NAT* (bloqueo P2P) o *Full/Restricted Cone*.
- [ ] **Estrategia Híbrida de Relé TURN**: P2P directo por STUN por defecto + red de relé TURN de respaldo para el ~15% de casos 5G/CGNAT simétrico.

# ☁️ Copia de Seguridad & Cloud
- [ ] **Exportación KML/GPX**: Convertir rutas de Git a formatos estándar.
- [ ] **Sincronización con Google Drive**: Backup automático en la carpeta `appDataFolder` de Drive usando OAuth2/GIS.

# 📦 Gestión de Caché & Resiliencia Offline
- [ ] **Estrategias Workbox**: Stale-While-Revalidate para carga instantánea con actualización en segundo plano.
- [ ] **Panel de administración de caché**: Ver tamaño de datos guardados y botón para "Vaciar solo activos" sin perder la agenda.
- [ ] **Estrategia Network-First**: Para el `index.html` y asegurar siempre la última versión si hay red.
- [ ] **Background Sync API**: Re-intentar envíos de ubicación o mensajes fallidos al recuperar red.

# 🧩 Extras / Plugins
- [ ] **Sistema de Plugins**: Para hacer un "tron" con las rutas, cambiar la visualización y la comunicación.

# 🏷️ Balizas BLE & Redes de Rastreo (AirTags / Find My)
- [ ] **Servicio Gateway BLE en Raspberry Pi**: Escáner local con Bluetooth LE nativo para detectar balizas de proximidad (llegada/salida del hogar).
- [ ] **Conector Apple Find My (OpenHaystack / FindMy.py)**: Polling de reportes cifrados, desencriptado local con clave privada y commit automático en Git.
- [ ] **Soporte de Balizas Baratas (nRF52 / ESP32)**: Documentar firmware y emparejamiento de Pingo Tags mediante QR.

# 💼 Nuevas Líneas de Negocio & Verticales (ver business_plan.md)
- [ ] **Módulo Peritaje Inmutable (LegalTech)**: Generación de informe PDF/GPX firmado con hash Git para aseguradoras y lindes rústicas.
- [ ] **Modo Convoy / Off-Grid**: Perfil de red para conectar vehículos en expedición a la RPi con streaming de audio P2P (intercom).
- [ ] **Modo Smart Agro**: Soporte de collares de bajo coste y geovallas de pastoreo con nodos solares.
- [ ] **Módulo Content Pipeline**: Script para empaquetar el generador de vídeos (Playwright + Kokoro + FFmpeg) como herramienta CLI reutilizable.
