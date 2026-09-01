#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧹 Limpiando ejecuciones previas de Docker..."
docker compose -f docker-compose.turn-test.yml down -v --remove-orphans 2>/dev/null || true

echo "🔨 Construyendo imágenes para redes aisladas..."
docker compose -f docker-compose.turn-test.yml build

echo "🚀 Levantando entorno con subredes aisladas (net_a: 172.31.1.0/24 y net_b: 172.31.2.0/24)..."
docker compose -f docker-compose.turn-test.yml up --abort-on-container-exit --exit-code-from sender

echo "🧹 Limpieza final..."
docker compose -f docker-compose.turn-test.yml down -v
echo "🎉 PRUEBA 4 COMPLETADA CON ÉXITO: Tráfico transmitido y recibido entre redes aisladas vía TURN relay!"
