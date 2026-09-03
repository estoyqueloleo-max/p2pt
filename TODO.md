# 📌 Próximos Pasos (Prioridad Alta)
- [ ] **Revisar api de maps que se usa**: Porque parece que era CartoDb por debajo y ahora pide apikey.
- [ ] **Configuración de VAPID en producción**: Mover las claves VAPID a variables de entorno en Cloudflare.
- [ ] **Gitea CORS Config**: Configurar `app.ini` en la RPi para permitir CORS.
- [ ] **Estrategia de fondo híbrida**: Cola de sincronización (IndexedDB + Background Sync) para no perder puntos GPS offline.
- [ ] **Temas del Mapa**: Selector modo Claro/Oscuro.
- [ ] **Investigación CGNAT**: Estudiar comportamiento de operadores 5G e IPv6.

# 🧠 Funcionalidades Core (Git, P2P, Búsqueda, Identidad)
- [ ] **Identidades**: Revisar si puede haber colisión con los números (IDs) generados.
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
