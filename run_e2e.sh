#!/bin/bash
# run_e2e.sh - Ejecutar tests de integración y P2P de Pingo

echo "🚀 Iniciando suite de pruebas Playwright P2P..."
npx playwright test "$@"
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ ¡Todas las pruebas han pasado con éxito!"
else
  echo "❌ Algunas pruebas han fallado. Código de salida: $EXIT_CODE"
fi

exit $EXIT_CODE
