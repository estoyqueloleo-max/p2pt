# 📡 Configuración de Coturn (Relé TURN)

Este directorio contiene la configuración necesaria para desplegar un servidor TURN propio usando Docker.

## 🚀 Inicio Rápido
1. Asegúrate de tener Docker instalado.
2. Ejecuta:
   ```bash
   docker-compose up -d
   ```

## ⚙️ Configuración Importante
- **`coturn.conf`**: Contiene la configuración de puertos y el `static-auth-secret`.
- **Seguridad**: El secreto definido aquí DEBE ser el mismo que el configurado en el Cloudflare Worker (`TURN_STATIC_AUTH_SECRET`) para que la generación de credenciales funcione.

Para más detalles sobre el despliegue completo, consulta el [README del backend](../backend/README.md).

## 🏠 Servidor Ejecutable Autónomo en Go (Sin Docker)
Si prefieres un único archivo ejecutable que incluya tanto el servidor TURN/STUN como la señalización PeerJS (sin necesidad de Docker ni dependencias externas), consulta el directorio [`../server/`](../server/README.md).

## 🏠 Alternativas de Autoalojamiento Doméstico
Para ver todas las opciones de despliegue en hogares para usuarios no técnicos (Binario Go con Pion TURN, Cloudflare Tunnels, CasaOS, Raspberry Pi), consulta la [Guía de Comunicación P2P (Sección 9)](../P2P.md#9-autoalojamiento-doméstico-opciones-para-servidores-peerjs-y-turn-en-casa).
