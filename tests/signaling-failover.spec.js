import { test, expect } from '@playwright/test';

test.describe('Signaling Server Resilient Auto-Failover', () => {
  test('Debe conmutar automáticamente al siguiente servidor de señalización de respaldo cuando el primario falla por red', async ({ page }) => {
    // Escuchar mensajes de consola del navegador para verificar el comportamiento de failover
    const failoverLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      failoverLogs.push(text);
    });

    // Configuramos un servidor de señalización primario deliberadamente inalcanzable (puerto cerrado)
    // y servidores fallback válidos definidos en la lista
    await page.addInitScript(() => {
      localStorage.setItem('pingo_passphrase', 'failover-test-seed');
      localStorage.setItem('pingo_salt', 'pingo-salt');
      localStorage.setItem('pingo_alias', 'Tester');
      localStorage.setItem('pingo_server_config', JSON.stringify({
        signaling: {
          host: '127.0.0.1',
          port: 59999, // Puerto inalcanzable para inducir error de red inmediato
          path: '/',
          secure: false,
          key: 'peerjs'
        },
        fallbacks: [
          { host: '127.0.0.1', port: 59999, path: '/', secure: false },
          { host: 'appliances.klitosan.com', port: 443, path: '/', secure: true },
          { host: 'peerjs-server.accreativos.com', port: 443, path: '/', secure: true }
        ],
        turn: { urls: [], username: '', credential: '' }
      }));
    });

    await page.goto('/');

    // Comprobar que la UI refleja la conmutación a un servidor resiliente sin romper la aplicación
    const statusText = page.locator('#location-status');
    await expect(statusText).toBeVisible({ timeout: 10000 });

    // Esperar a que el failover se dispare y actualice el estado a servidor resiliente
    await expect(async () => {
      const text = await statusText.innerText();
      expect(text).toContain('Conmutando a servidor resiliente');
    }).toPass({ timeout: 15000 });

    // Verificar que los logs registraron la conmutación al siguiente servidor
    const detectedFailover = failoverLogs.some(log => log.includes('[Failover]'));
    expect(detectedFailover).toBe(true);
  });
});
