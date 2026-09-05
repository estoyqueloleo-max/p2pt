import { test, expect, chromium } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

let serverProcess;
const HTTP_PORT = 9005;
const TURN_PORT = 3479;

test.beforeAll(async () => {
  console.log('[Test Setup] Spawning pingo-server in Go (with WHIP/WHEP Broadcast Relay & TURN)...');
  const serverBinary = path.resolve('server/pingo-server');

  serverProcess = spawn(serverBinary, [
    '-no-upnp',
    `-port=${HTTP_PORT}`,
    `-turn-port=${TURN_PORT}`,
    '-public-ip=127.0.0.1',
    '-user=pingo',
    '-password=pingosecret',
    '-realm=pingo'
  ], { stdio: 'inherit' });

  await new Promise((resolve) => setTimeout(resolve, 2000));
});

test.afterAll(async () => {
  if (serverProcess) {
    console.log('[Test Setup] Terminating pingo-server...');
    serverProcess.kill('SIGTERM');
  }
});

test.describe('Servidor Amigo WebRTC Broadcast Relay (WHIP/WHEP) Tests', () => {

  test('Debe emitir vídeo vía WHIP a Servidor Amigo y distribuir a múltiples espectadores vía WHEP', async () => {
    test.setTimeout(90000);

    const videoFixturePath = path.resolve('tests/fixtures/test_video.y4m');
    const customBrowser = await chromium.launch({
      args: [
        '--allow-loopback-in-peer-connection',
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${videoFixturePath}`,
        '--auto-accept-this-tab-capture'
      ]
    });

    const contextOptions = {
      ignoreHTTPSErrors: true,
      permissions: ['camera', 'microphone'],
      recordVideo: { dir: './test-results/videos/' }
    };

    const contexts = await Promise.all([
      customBrowser.newContext(contextOptions),
      customBrowser.newContext(contextOptions),
      customBrowser.newContext(contextOptions)
    ]);

    const [pageA, pageB, pageC] = await Promise.all(contexts.map(ctx => ctx.newPage()));

    pageA.on('console', msg => console.log(`[PageA] ${msg.text()}`));
    pageB.on('console', msg => console.log(`[PageB] ${msg.text()}`));
    pageC.on('console', msg => console.log(`[PageC] ${msg.text()}`));

    // Pre-initialize configuration with Servidor Amigo broadcast endpoints
    const serverConfigInit = {
      signaling: { host: '127.0.0.1', port: HTTP_PORT, path: '/', secure: false },
      turn: {
        urls: [`stun:127.0.0.1:${TURN_PORT}`, `turn:127.0.0.1:${TURN_PORT}?transport=udp`],
        username: 'pingo',
        credential: 'pingosecret'
      },
      broadcast: {
        enabled: true,
        whipUrl: `http://127.0.0.1:${HTTP_PORT}/api/whip`,
        whepUrl: `http://127.0.0.1:${HTTP_PORT}/api/whep`
      },
      capabilities: {
        broadcastRelay: true,
        turnAllowedForMedia: true
      }
    };

    for (const page of [pageA, pageB, pageC]) {
      await page.addInitScript((cfg) => {
        localStorage.setItem('pingo_server_config', JSON.stringify(cfg));
      }, serverConfigInit);
    }

    await Promise.all([
      pageA.goto('/'),
      pageB.goto('/'),
      pageC.goto('/')
    ]);

    // Wait for all three nodes to connect online
    await expect(pageA.locator('#status-indicator')).toHaveClass(/online/, { timeout: 15000 });
    await expect(pageB.locator('#status-indicator')).toHaveClass(/online/, { timeout: 15000 });
    await expect(pageC.locator('#status-indicator')).toHaveClass(/online/, { timeout: 15000 });

    const idA = await pageA.locator('#my-peer-id').textContent();
    const idB = await pageB.locator('#my-peer-id').textContent();
    const idC = await pageC.locator('#my-peer-id').textContent();

    console.log(`[Test Mesh] Nodos conectados - A: ${idA}, B (Emisor): ${idB}, C: ${idC}`);

    // Connect mesh: A <-> B and B <-> C
    console.log('[Test Mesh] Estableciendo conexiones de datos A <-> B y C <-> B...');
    await pageA.evaluate(async (targetId) => {
      const { connectToPeer } = await import('/src/js/peer-manager.js');
      connectToPeer(targetId);
    }, idB);
    await pageA.waitForFunction((id) => {
      const conn = window.pingo.state.connections[id];
      return conn && conn.open;
    }, idB, { timeout: 15000 });

    await pageC.evaluate(async (targetId) => {
      const { connectToPeer } = await import('/src/js/peer-manager.js');
      connectToPeer(targetId);
    }, idB);
    await pageC.waitForFunction((id) => {
      const conn = window.pingo.state.connections[id];
      return conn && conn.open;
    }, idB, { timeout: 15000 });

    console.log('✅ Malla A <-> B y C <-> B conectada correctamente');

    // Node B selects chat with Node A and shares camera
    console.log('[Test WHIP] Node B abre chat e inicia emisión de cámara hacia el Servidor Amigo...');
    await pageB.evaluate((id) => {
      window.pingo.state.activeChatPeerId = id;
      document.getElementById('nav-comm-btn').click();
    }, idA);

    await pageB.locator('#share-camera-btn').click();

    // Check that local video is displayed on Node B
    await expect(pageB.locator('#local-video')).toBeVisible({ timeout: 10000 });

    // Wait a brief moment for WHIP negotiation
    await pageB.waitForTimeout(2000);

    // Verify Node B badge indicates Servidor Amigo
    await expect(pageB.locator('#local-video-container .video-conn-badge')).toContainText('Servidor Amigo', { timeout: 10000 });
    console.log('[Test WHIP] Badge en Node B verificado como Servidor Amigo');

    // Both Node A and Node C should receive stream notification with Servidor Amigo info
    console.log('[Test WHEP] Verificando llegada de notificación WHEP a Node A y Node C...');
    const notifA = pageA.locator('.stream-notification:has-text("transmitiendo")');
    const notifC = pageC.locator('.stream-notification:has-text("transmitiendo")');

    await expect(notifA).toBeVisible({ timeout: 15000 });
    await expect(notifC).toBeVisible({ timeout: 15000 });

    // Node A clicks 'Ver' to subscribe via WHEP
    console.log('[Test WHEP] Node A acepta y se suscribe vía WHEP...');
    await notifA.locator('button:has-text("Ver")').click();
    await pageA.locator('#nav-comm-btn').click();

    // Node C clicks 'Ver' to subscribe via WHEP
    console.log('[Test WHEP] Node C acepta y se suscribe vía WHEP...');
    await notifC.locator('button:has-text("Ver")').click();
    await pageC.locator('#nav-comm-btn').click();

    // Verify remote video plays on Node A
    await expect(pageA.locator(`#remote-video-${idB}`)).toBeVisible({ timeout: 15000 });
    await pageA.waitForFunction((remoteId) => {
      const video = document.getElementById(`remote-video-${remoteId}`);
      return video && video.readyState >= 2 && !video.paused;
    }, idB, { timeout: 15000 });

    // Verify remote video plays on Node C
    await expect(pageC.locator(`#remote-video-${idB}`)).toBeVisible({ timeout: 15000 });
    await pageC.waitForFunction((remoteId) => {
      const video = document.getElementById(`remote-video-${remoteId}`);
      return video && video.readyState >= 2 && !video.paused;
    }, idB, { timeout: 15000 });

    console.log('✅ Ambos espectadores (Node A y Node C) reproduciendo vídeo WHEP en vivo del Servidor Amigo!');

    // Verify badge on Node A indicates Servidor Amigo
    await expect(pageA.locator(`#remote-video-${idB}-container .video-conn-badge`)).toContainText('Servidor Amigo', { timeout: 10000 });
    console.log('[Test WHEP] Badge en espectador Node A verificado como Servidor Amigo');

    // Stop stream on Node B
    console.log('[Test WHIP] Node B detiene la transmisión...');
    await pageB.locator('#local-video-container .video-ctrl-danger').click();

    // Verify stream ended on Node B
    await expect(pageB.locator('#local-video')).not.toBeVisible();

    await customBrowser.close();
    console.log('🎉 Test de Servidor Amigo WebRTC Broadcast Relay (WHIP/WHEP) completado con éxito!');
  });

  test('Debe aplicar política de protección TURN (bloqueo en Modo Libre vs autorización con Servidor Amigo)', async () => {
    // Unit evaluation of TURN policy logic in constants.js & media-manager.js
    const customBrowser = await chromium.launch();
    const page = await customBrowser.newPage();
    await page.goto('/');

    const resultPolicy = await page.evaluate(async () => {
      const { isTurnAllowedForMedia, saveServerConfig } = await import('/src/js/constants.js');

      // 1. In Modo Libre (capabilities.turnAllowedForMedia: false)
      saveServerConfig({
        capabilities: { turnAllowedForMedia: false }
      });
      const modoLibreAllowed = isTurnAllowedForMedia();

      // 2. In Modo Servidor Amigo (capabilities.turnAllowedForMedia: true)
      saveServerConfig({
        capabilities: { turnAllowedForMedia: true }
      });
      const servidorAmigoAllowed = isTurnAllowedForMedia();

      return { modoLibreAllowed, servidorAmigoAllowed };
    });

    expect(resultPolicy.modoLibreAllowed).toBe(false);
    expect(resultPolicy.servidorAmigoAllowed).toBe(true);

    await customBrowser.close();
    console.log('✅ Política de protección TURN validada correctamente (Modo Libre: false, Servidor Amigo: true)');
  });
});
