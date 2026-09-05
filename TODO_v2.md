Listed directory server
Viewed duckdns.go:1-100
Viewed tls_helper.go:1-100
Searched for "Listen"
Viewed main.go:935-960
Viewed duckdns.go:80-130
Viewed swarm.go:1-70

Con la decisión que has tomado acabas de desbloquear la mejor arquitectura posible: **al asumir que la Raspberry Pi Zero con la fibra de Digi absorbe el tráfico cuando sea necesario, logramos que los usuarios finales tengan Cero Configuración y 100% de éxito en las llamadas (P2P cuando se pueda, y relé TURN en tu casa cuando el 5G falle)**.

Teniendo el router **ZTE H3600P V9.0** y la fibra de **Digi con IPv6**, esto es exactamente lo que nos queda por hacer, dividido en **3 frentes claros**:

---

### Frente 1: En tu Router ZTE H3600P (Solo se hace una vez)

El ZTE H3600P de Digi es un router Wi-Fi 6 muy capaz. En IPv6 no hay que hacer "Port Forwarding" (no hay NAT), pero su cortafuegos bloquea por defecto las conexiones que vienen desde Internet.

1. **Confirmar IPv6 activa:**
   * Entra a `http://192.168.1.1` (usuario/clave en la pegatina del router).
   * En el menú superior: **Internet** ➔ **Estado / WAN**.
   * Comprueba que en la conexión de fibra aparece una dirección IPv6 (prefijo `2a0c:5a80:...`). En Digi viene activada de serie.
2. **Abrir el Firewall IPv6 hacia la Raspberry Pi Zero (IPv6 Pinholing):**
   * Ve a **Seguridad (Security)** ➔ **Filtro IPv6 (IPv6 Filter)** o **Cortafuegos**.
   * Crea una regla de paso (*Permitir entrante / Inbound*) hacia la dirección IPv6 de tu Raspberry Pi Zero:
     * **Puerto TCP 9000**: Señalización PeerJS, WebSockets y Panel Web.
     * **Puerto UDP 3478**: STUN y Relé Pion TURN para el vídeo.
3. *(Opcional en IPv4)*: En **Red Local** ➔ **UPnP**, asegúrate de que esté en **ON** (por si algún cliente en IPv4 local intenta mapeos).

---

### Frente 2: En el Servidor Go (`p2pt-server` en la RPi Zero)

Actualmente, revisando el código del servidor, hay **3 ajustes clave** que debemos aplicar en el código para que aproveche la IPv6 y resuelva el error de SSL de la captura:

1. **Habilitar Dual-Stack (IPv4 + IPv6 simultáneo) en los sockets Go:**
   * En `server/main.go`, el servidor actualmente escucha en `0.0.0.0:9000` y `net.ListenPacket("udp4", ...)`.
   * **Cambio:** Pasarlo a `:9000` y `"udp"`, permitiendo que el binario atienda peticiones entrantes tanto por IPv4 como por IPv6 nativa global.
2. **Actualizar el sincronizador de DuckDNS (`server/duckdns.go`):**
   * DuckDNS soporta IPv6 a través del parámetro `&ipv6=...`.
   * **Cambio:** Hacer que el gestor detecte automáticamente la IP global `2a0c:...` de la Raspberry Pi y la envíe a DuckDNS. Así DuckDNS publicará el registro DNS **`AAAA`**, permitiendo que los móviles en 5G conecten en línea recta por IPv6.
3. **Solucionar el Certificado SSL / HTTPS para los móviles:**
   * El error rojo de tu captura (`Verifica certificados SSL`) ocurre porque la app de Pingo en el móvil corre sobre HTTPS y exige que el servidor de señalización (`pingo-casa.duckdns.org:9000`) tenga un certificado SSL de confianza (los certificados autofirmados son bloqueados por los navegadores móviles).
   * **Opciones a elegir para el appliance:**
     * **Opción A (Let's Encrypt automático para DuckDNS):** Generar un certificado oficial gratuito con Let's Encrypt (usando el token de DuckDNS mediante el reto DNS-01). Es 100% oficial y no da advertencias.
     * **Opción B (Cloudflare Tunnel integrado):** Un micro-túnel saliente sólo para el puerto 9000 (señalización), que da HTTPS gratis de forma transparente sin tocar puertos, dejando el UDP 3478 directo por IPv6 para el vídeo.

---

### Frente 3: En los Clientes Pingo y el Enjambre DHT

Una vez configurado lo anterior, la experiencia para cualquier amigo o usuario final es la siguiente:

1. **Cero configuración en el cliente:**
   * Al escanear el QR o sumarse al *Topic* del enjambre DHT, el cliente recibe automáticamente la URL de señalización y las credenciales del relé TURN de tu Raspberry Pi Zero.
2. **Conexión inteligente en llamadas:**
   * **Caso 1 (Wi-Fi a Wi-Fi o NAT dócil):** WebRTC usará STUN para conectar **P2P directo** entre los móviles. Tu Raspberry Pi no gasta ancho de banda de vídeo.
   * **Caso 2 (5G a 5G o CGNAT estricto):** Cuando el P2P directo falla, WebRTC conmuta instantáneamente al **relé TURN de tu Raspberry Pi Zero**. La llamada se establece en menos de 1 segundo a través de tu fibra de Digi.

---

### 🚀 Siguiente paso inmediato

¿Quieres que modifiquemos el código de `server/main.go` y `server/duckdns.go` para:
1. Activar la escucha dual-stack IPv4/IPv6 en los puertos 9000 y 3478.
2. Añadir el soporte para actualizar registros IPv6 (`AAAA`) en DuckDNS?