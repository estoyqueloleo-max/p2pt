#!/bin/bash

# Pingo Local HTTPS Server Script
# Generates a self-signed certificate and runs http-server with SSL

CERT_FILE="cert.pem"
KEY_FILE="key.pem"

if [ "$1" == "--reset" ] || [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "🔐 Generating fresh self-signed certificate..."
    rm -f "$CERT_FILE" "$KEY_FILE"
    openssl req -newkey rsa:2048 -new -nodes -x509 -days 365 \
        -keyout "$KEY_FILE" -out "$CERT_FILE" \
        -subj "/C=ES/ST=Pingo/L=Dev/O=Pingo/CN=localhost"
    chmod 600 "$KEY_FILE"
fi

echo "🚀 Starting HTTPS server on port 8443..."
echo "------------------------------------------"
echo "🌐 URL: https://localhost:8443"
echo "🌐 IP:  https://$(hostname -I | awk '{print $1}'):8443"
echo "------------------------------------------"
echo "⚠️  NOTA: El navegador mostrará un aviso de seguridad."
echo "   Debes pulsar 'Avanzado' y 'Continuar/Acceder' (Proceed)."
echo "   En Chrome/Edge: chrome://flags/#allow-insecure-localhost (muy recomendado)"
echo "------------------------------------------"

if [ ! -d "dist" ]; then
    echo "⚠️  Error: El directorio 'dist' no existe."
    echo "   Por favor, ejecuta 'npm run build' primero."
    exit 1
fi

npm run build

# -S: SSL, -C: Cert, -K: Key, -p: Port, -c-1: No cache, --cors: Enable CORS
npx -y http-server dist -S --cert "$CERT_FILE" --key "$KEY_FILE" -p 8443 -c-1 --cors
