# 📡 Coturn Configuration (TURN Relay)

This directory contains the configuration necessary to deploy your own TURN server using Docker.

## 🚀 Quick Start
1. Ensure you have Docker installed.
2. Run:
   ```bash
   docker-compose up -d
   ```

## ⚙️ Important Configuration
- **`coturn.conf`**: Contains the port configuration and the `static-auth-secret`.
- **Security**: The secret defined here MUST be the same as the one configured in the Cloudflare Worker (`TURN_STATIC_AUTH_SECRET`) for credential generation to work.

For more details on full deployment, see the [backend README](../backend/README.md).
