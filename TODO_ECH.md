# 🛡️ Anti-Censura y Topología de Red: ECH y Señalización

Este documento detalla estrategias para hacer que Pingo sea resistente a la censura y bloqueos de red (mediante tecnologías como ECH), así como evoluciones en la topología de la red para permitir mayor flexibilidad y escalabilidad (cambio de servidores y nodos relay).

## 1. Protección contra Censura: Implementación de ECH (Encrypted Client Hello)

El protocolo **ECH** cifra completamente el saludo inicial de una conexión segura (el "Client Hello"). En el contexto de Pingo, dado que el tráfico P2P ya va cifrado de extremo a extremo, ECH es vital para proteger los puntos centralizados o de inicio que son susceptibles a bloqueos por SNI (Server Name Indication).

### Puntos Críticos a proteger con ECH en Pingo:
*   **Servidor de Señalización:** Si el SNI del WebSocket (`wss://`) expone el dominio de señalización, un ISP puede bloquearlo fácilmente, impidiendo que los pares se descubran y cortando la red P2P de raíz. Usar ECH (ej. a través de Cloudflare) oculta este tráfico como si fuera una conexión a un servidor genérico.
*   **Distribución de la PWA (Frontend):** Alojando el código estático de la aplicación bajo una infraestructura con ECH activado, se evita el bloqueo durante la descarga inicial o actualización de la app.
*   **Servidores TURN:** Las conexiones TLS hacia servidores de retransmisión (TURN) también revelan el dominio si no se protegen, lo cual puede ser utilizado para bloquear el salto de cortafuegos restrictivos.

**Objetivo:** Garantizar que toda la infraestructura pública "de entrada" a Pingo esté detrás de un proxy/CDN que soporte y aplique ECH estrictamente.

## 2. Flexibilidad de Red: Selección Manual del Servidor de Señalización

Actualmente, Pingo se apoya en un servidor de señalización principal para orquestar la red. Para evitar que la caída o censura de este servidor detenga la aplicación, se debe implementar una capa de resiliencia.

### Tareas a implementar:
*   **Interfaz de Configuración de Red:** Añadir en los ajustes de Pingo la capacidad para que el usuario introduzca manualmente la URL / credenciales de un servidor de señalización alternativo.
*   **Soporte Multi-Red:** Esto permitirá a comunidades crear y mantener sus propias redes "oscuras" o privadas de Pingo. Si la red principal es bloqueada, los usuarios pueden pasarse un enlace o configuración para conectarse a través de un servidor de señalización comunitario.
*   **Fallback Automático (Opcional):** Configurar una lista de servidores de señalización de respaldo conocidos, para que la app intente reconectarse automáticamente si el principal falla.

## 3. Escalabilidad Híbrida: Opción de "Nodo Relay" o "Nodo Central"

Aunque Pingo tiene una filosofía P2P (mesh), conectar "miles" de usuarios directamente entre sí agota los recursos de los dispositivos finales. Para redes muy grandes, el P2P puro se vuelve ineficiente.

### Propuesta de Arquitectura Relay:
*   **Modo "Súper Nodo":** Permitir que instancias específicas de Pingo (por ejemplo, ejecutadas en servidores dedicados o conexiones con mucho ancho de banda) puedan ser configuradas como **Nodos Relay**.
*   **Topología Estrella/Mesh Híbrida:** En lugar de que todos los usuarios se conecten a todos (Mesh), los usuarios normales pueden conectarse a uno de estos Nodos Relay. El Relay se encarga de retransmitir el video, mensajes y los datos de Git al resto de los miles de espectadores/participantes, reduciendo la carga de CPU y red en los dispositivos móviles.
*   **Casos de uso:** Transmisiones de video (broadcasting) a gran escala, directorios de búsqueda de repositorios masivos, o mantener historiales de Git siempre disponibles (como un peer "Always On").
