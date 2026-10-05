# 🛡️ Anti-Censura y Topología de Red: ECH y Señalización

Este documento detalla estrategias para hacer que Pingo sea resistente a la censura y bloqueos de red (mediante tecnologías como ECH), así como evoluciones en la topología de la red para permitir mayor flexibilidad y escalabilidad (cambio de servidores y nodos relay).

## 1. Protección contra Censura: Implementación de ECH (Encrypted Client Hello) - [COMPLETADO ✅]

El protocolo **ECH** cifra completamente el saludo inicial de una conexión segura (el "Client Hello"). En el contexto de Pingo, dado que el tráfico P2P ya va cifrado de extremo a extremo, ECH es vital para proteger los puntos centralizados o de inicio que son susceptibles a bloqueos por SNI (Server Name Indication).

### Puntos Críticos protegidos con ECH y Cloud Hub DDNS:
*   **Servidor de Señalización:** Desplegado con soporte DuckDNS multitenant en Cloudflare Worker (`/api/v1/ddns/register` y `/api/v1/ddns/heartbeat`), gestionando subdominios en `appliances.klitosan.com` protegidos por el proxy de Cloudflare con ECH y DoH activo.
*   **Distribución de la PWA (Frontend):** Distribuido tras Cloudflare Pages / Edge con terminación TLS y ECH habilitado.
*   **Servidores TURN / Appliance:** Registrados mediante DDNS sin coste de cuota API (verificación `CF-Connecting-IP` vs KV) y túneles protegidos.

## 2. Flexibilidad de Red: Selección Manual y Conmutación Automática (Failover) - [COMPLETADO ✅]

Capa de resiliencia ante censura y caídas de servidores de señalización implementada y testeada con E2E:
*   **Interfaz y Configuración de Red:** Soporte para sobreescritura manual de servidor de señalización vía `pingo_server_config` en LocalStorage y parámetros URL (`?server=...`).
*   **Fallback Automático (Failover Resiliente):** Implementada lista de servidores de respaldo (`FALLBACK_SIGNALING_SERVERS` con `peerjs-server.accreativos.com`, `appliances.klitosan.com`, etc.). Si se detecta `network`, `server-error`, `socket-error` o desconexión en el host activo, Pingo conmuta automáticamente al siguiente servidor de señalización sin degradar la aplicación.
*   **Test E2E de Conmutación:** Validado en `tests/signaling-failover.spec.js`.

## 3. Escalabilidad Híbrida: Opción de "Nodo Relay" o "Nodo Central"

Aunque Pingo tiene una filosofía P2P (mesh), conectar "miles" de usuarios directamente entre sí agota los recursos de los dispositivos finales. Para redes muy grandes, el P2P puro se vuelve ineficiente.

### Propuesta de Arquitectura Relay:
*   **Modo "Súper Nodo":** Permitir que instancias específicas de Pingo (por ejemplo, ejecutadas en servidores dedicados o conexiones con mucho ancho de banda) puedan ser configuradas como **Nodos Relay**.
*   **Topología Estrella/Mesh Híbrida:** En lugar de que todos los usuarios se conecten a todos (Mesh), los usuarios normales pueden conectarse a uno de estos Nodos Relay. El Relay se encarga de retransmitir el video, mensajes y los datos de Git al resto de los miles de espectadores/participantes, reduciendo la carga de CPU y red en los dispositivos móviles.
*   **Casos de uso:** Transmisiones de video (broadcasting) a gran escala, directorios de búsqueda de repositorios masivos, o mantener historiales de Git siempre disponibles (como un peer "Always On").
