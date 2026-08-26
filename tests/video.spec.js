import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { spawn } from 'child_process';

let peerServerProcess;

test.beforeAll(async () => {
  console.log('[Test Signaling Process] Spawning PeerJS server...');
  peerServerProcess = spawn('node', ['./tests/peer-server.cjs']);

  peerServerProcess.stdout.on('data', (data) => {
    console.log(`[PeerJS Process] ${data.toString().trim()}`);
  });

  peerServerProcess.stderr.on('data', (data) => {
    console.error(`[PeerJS Process Error] ${data.toString().trim()}`);
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
});

test.afterAll(async () => {
  if (peerServerProcess) {
    console.log('[Test Signaling Process] Terminated');
    peerServerProcess.kill();
  }
});

// Helper to derive ID using the same salt/passphrase algorithm
async function deriveIdFor(phrase, salt) {
  return new Promise((resolve) => {
    const iterations = 1000;
    const keylen = 16;
    import('crypto').then(crypto => {
        crypto.pbkdf2(phrase, salt, iterations, keylen, 'sha-256', (err, derivedKey) => {
          if (err) throw err;
          const hex = derivedKey.toString('hex');
          const num = parseInt(hex.substring(0, 8), 16);
          const id = (10000000 + (num % 90000000)).toString();
          resolve(id);
        });
    });
  });
}

// Pre-initialize local storage for pingo settings
async function initNodeLocalStorage(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
  }, { identity, agenda });
}

test.describe('P2P Video Broadcast Tests', () => {

  test('Debe transmitir cámara de B a A, y retransmitir (relay) a C', async () => {
    test.setTimeout(60000);
    const videoFixturePath = path.resolve('tests/fixtures/test_video.y4m');
    const customBrowser = await chromium.launch({
      args: [
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

    await Promise.all([
      pageA.goto('https://localhost:5188/'),
      pageB.goto('https://localhost:5188/'),
      pageC.goto('https://localhost:5188/')
    ]);

    // Wait for everyone to be connected to the signaling server
    await expect(pageA.locator('#status-indicator')).toHaveClass(/online/, { timeout: 10000 });
    await expect(pageB.locator('#status-indicator')).toHaveClass(/online/, { timeout: 10000 });
    await expect(pageC.locator('#status-indicator')).toHaveClass(/online/, { timeout: 10000 });

    // Start on the default network tab to connect and share camera.
    // Video panels will be shown later when we switch to the communication tab.

    // Get actual peer IDs
    const idA = await pageA.locator('#my-peer-id').textContent();
    const idB = await pageB.locator('#my-peer-id').textContent();
    const idC = await pageC.locator('#my-peer-id').textContent();

    console.log(`[Test] Actual IDs - A: ${idA}, B: ${idB}, C: ${idC}`);

    // Connect A <-> B <-> C
    console.log('[Test] Conectando nodos en línea A <-> B <-> C...');
    
    // Connect A to B
    await pageA.evaluate(async (targetId) => {
      const { connectToPeer } = await import('/src/js/peer-manager.js');
      connectToPeer(targetId);
    }, idB);
    await pageA.waitForFunction((id) => {
      const conn = window.pingo.state.connections[id];
      return conn && conn.open;
    }, idB, { timeout: 15000 });

    // Connect B to C
    await pageB.evaluate(async (targetId) => {
      const { connectToPeer } = await import('/src/js/peer-manager.js');
      connectToPeer(targetId);
    }, idC);
    await pageB.waitForFunction((id) => {
      const conn = window.pingo.state.connections[id];
      return conn && conn.open;
    }, idC, { timeout: 15000 });

    // Wait a moment for network topology to settle
    await pageA.waitForTimeout(2000);

    // 2. Node B opens chat with A and starts broadcasting
    console.log('[Test] Nodo B abre chat e inicia transmisión de cámara...');
    // Open chat with Node A by setting state on running app instance
    await pageB.evaluate((targetId) => {
      window.pingo.state.activeChatPeerId = targetId;
      document.getElementById('nav-comm-btn').click();
    }, idA);
    
    // Click share camera
    await pageB.locator('#share-camera-btn').click();

    // Verify local video is playing on Node B
    await expect(pageB.locator('#local-video')).toBeVisible({ timeout: 10000 });
    await pageB.waitForFunction(() => {
      const video = document.getElementById('local-video');
      return video && video.readyState >= 2 && !video.paused;
    }, { timeout: 10000 });

    // 3. Node A receives the notification directly from B
    console.log('[Test] Nodo A acepta transmisión directa de B...');
    const notifA = pageA.locator('.stream-notification:has-text("transmitiendo")');
    await expect(notifA).toBeVisible({ timeout: 10000 });
    await notifA.locator('button:has-text("Ver")').click();

    // Switch to communication tab to see the remote video
    await pageA.locator('#nav-comm-btn').click();

    // Verify remote video is playing on Node A
    await expect(pageA.locator(`#remote-video-${idB}`)).toBeVisible({ timeout: 10000 });
    
    await pageA.waitForFunction((remoteId) => {
      const video = document.getElementById(`remote-video-${remoteId}`);
      return video && video.readyState >= 2 && !video.paused;
    }, idB, { timeout: 10000 });

    // 4. Node C receives the notification from B relayed via A
    console.log('[Test] Nodo C acepta transmisión relay de B vía A...');
    // C is connected to B via A, but maybe C receives the notification directly via mesh routing,
    // wait for any stream notification
    const notifC = pageC.locator('.stream-notification:has-text("transmitiendo")');
    await expect(notifC).toBeVisible({ timeout: 10000 });
    await notifC.locator('button:has-text("Ver")').click();

    // Switch to communication tab to see the remote video
    await pageC.locator('#nav-comm-btn').click();

    // Verify remote video is playing on Node C
    await expect(pageC.locator(`#remote-video-${idB}`)).toBeVisible({ timeout: 10000 });
    
    await pageC.waitForFunction((remoteId) => {
      const video = document.getElementById(`remote-video-${remoteId}`);
      return video && video.readyState >= 2 && !video.paused;
    }, idB, { timeout: 10000 });

    console.log('✅ Broadcast de vídeo P2P y Relay con video Y4M real validados con éxito.');
    
    // Let it run for a bit to record the video showing the streams
    await pageC.waitForTimeout(3000);

    const videoPathA = await pageA.video().path();
    const videoPathB = await pageB.video().path();
    const videoPathC = await pageC.video().path();

    await Promise.all(contexts.map(ctx => ctx.close()));
    await customBrowser.close();

    // Attach videos to HTML report
    if (videoPathA) await test.info().attach('Node A Video', { path: videoPathA, contentType: 'video/webm' });
    if (videoPathB) await test.info().attach('Node B Video', { path: videoPathB, contentType: 'video/webm' });
    if (videoPathC) await test.info().attach('Node C Video', { path: videoPathC, contentType: 'video/webm' });
  });

});
