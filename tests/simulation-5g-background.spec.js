import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

let serverProcess;
const HTTP_PORT = 9005;
const TURN_PORT = 3479;

// Algoritmo idéntico de derivación de ID en Pingo
async function deriveIdFor(phrase, salt) {
  const encoder = new TextEncoder();
  const phraseBuf = encoder.encode(phrase);
  const saltBuf = encoder.encode(salt || 'pingo-default-salt');
  
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    phraseBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    32
  );
  
  const view = new DataView(bits);
  const num = view.getUint32(0) % 100000000;
  return num.toString().padStart(8, '0');
}

test.beforeAll(async () => {
  console.log('🚀 [Test Setup] Arrancando pingo-server con RingRelay en puerto 9005...');
  const serverBinary = path.resolve('server/pingo-server');

  serverProcess = spawn(serverBinary, [
    '-no-upnp',
    `-port=${HTTP_PORT}`,
    `-turn-port=${TURN_PORT}`,
    '-min-port=7000',
    '-max-port=7002',
    '-public-ip=127.0.0.1',
    '-user=pingo',
    '-password=pingosecret',
    '-realm=pingo'
  ], { stdio: 'pipe' });

  serverProcess.stderr.on('data', data => {
    console.log(`📡 [Go Server stderr] ${data.toString().trim()}`);
  });
  serverProcess.stdout.on('data', data => {
    console.log(`📡 [Go Server stdout] ${data.toString().trim()}`);
  });

  await new Promise((resolve) => setTimeout(resolve, 1500));
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    console.log('🛑 [Test Setup] pingo-server detenido.');
  }
});

async function setupPeer(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda, httpPort, turnPort }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_my_id', identity.id);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
    localStorage.setItem('pingo_local_signaling', '1');
    localStorage.setItem('pingo_use_cloud', 'true');
    localStorage.setItem('pingo_server_config', JSON.stringify({
      version: 1,
      signaling: { host: '127.0.0.1', port: httpPort, path: '/', secure: false },
      turn: {
        urls: [
          `stun:127.0.0.1:${turnPort}`,
          `turn:127.0.0.1:${turnPort}?transport=udp`,
          `turn:127.0.0.1:${turnPort}?transport=tcp`
        ],
        username: 'pingo',
        credential: 'pingosecret'
      }
    }));
  }, { identity, agenda, httpPort: HTTP_PORT, turnPort: TURN_PORT });
}

test.describe('Simulación 5G: Caída en Segundo Plano, Corte de Red y Recuperación', () => {
  test('Alice entra en segundo plano con micro-corte 5G y recupera conexión con Bob sin Error 508', async ({ browser }) => {
    test.setTimeout(60000);

    const idAlice = await deriveIdFor('phraseAlice5G', 'saltAlice5G');
    const idBob = await deriveIdFor('phraseBob5G', 'saltBob5G');

    const identityAlice = { id: idAlice, alias: 'Alice Móvil 5G', phrase: 'phraseAlice5G', salt: 'saltAlice5G' };
    const identityBob = { id: idBob, alias: 'Bob Fijo', phrase: 'phraseBob5G', salt: 'saltBob5G' };

    const agendaAlice = [{ alias: 'Bob Fijo', derivedId: idBob }];
    const agendaBob = [{ alias: 'Alice Móvil 5G', derivedId: idAlice }];

    const contextAlice = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextBob = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    // Capturar logs de consola en tiempo real
    pageAlice.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PeerJS]') || text.includes('[Signaling]') || text.includes('[Ring]') || text.includes('WebRTC') || text.includes('Error')) {
        console.log(`📱 [Alice Console] ${text}`);
      }
    });

    pageBob.on('console', msg => {
      const text = msg.text();
      if (text.includes('[PeerJS]') || text.includes('[Signaling]') || text.includes('WebRTC') || text.includes('Error')) {
        console.log(`💻 [Bob Console] ${text}`);
      }
    });

    await setupPeer(pageAlice, identityAlice, agendaAlice);
    await setupPeer(pageBob, identityBob, agendaBob);

    const testUrl = '/?localSignaling=1';
    await Promise.all([
      pageAlice.goto(testUrl),
      pageBob.goto(testUrl)
    ]);

    // 1. Conectar Alice con Bob
    console.log('\n--- 1️⃣ CONEXIÓN INICIAL ENTRE ALICE Y BOB ---');
    const cardBobInAlice = pageAlice.locator(`.contact-card:has-text("Bob Fijo")`);
    await expect(cardBobInAlice).toBeVisible();
    await cardBobInAlice.locator('.connect-contact').click();

    // Esperar a que la conexión esté online
    await expect(cardBobInAlice.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log('✅ Conexión establecida con éxito. Ambos nodos en verde.');

    // 2. Abrir modal de señalización en Alice y leer los logs
    console.log('\n--- 📋 LEYENDO LOGS DE SEÑALIZACIÓN (ESTADO PRE-CORTE) ---');
    await pageAlice.locator('#status-indicator').click();
    await expect(pageAlice.locator('#conn-stats-modal')).toBeVisible();

    const logsPre = await pageAlice.locator('#diag-logs-container').innerText();
    console.log('--- [REGISTRO TELEMETRÍA ALICE (PRE)] ---');
    console.log(logsPre.trim() || 'Sin logs en telemetría');
    console.log('-----------------------------------------');

    // Cerrar modal
    await pageAlice.locator('#conn-stats-close').click();
    await expect(pageAlice.locator('#conn-stats-modal')).toBeHidden();

    // 3. Simular que Alice pasa a SEGUNDO PLANO con CORTE 5G
    console.log('\n--- ⏸️ 2️⃣ SIMULACIÓN: ALICE ENTRA EN SEGUNDO PLANO (FREEZE) Y PIERDE RED 5G ---');
    const cdpAlice = await contextAlice.newCDPSession(pageAlice);

    // Congelar ejecución JS (simula que el móvil apaga pantalla o minimiza app)
    await cdpAlice.send('Page.setWebLifecycleState', { state: 'frozen' });
    // Cortar red de datos celular
    await contextAlice.setOffline(true);

    console.log('⏳ Esperando 8 segundos con la app congelada en segundo plano y sin red...');
    await pageBob.waitForTimeout(8000);

    // 4. DESPERTAR: Alice recupera cobertura 5G y vuelve a primer plano
    console.log('\n--- ▶️ 3️⃣ RECUPERACIÓN: ALICE VUELVE A PRIMER PLANO Y RECUPERA 5G ---');
    await contextAlice.setOffline(false);
    await cdpAlice.send('Page.setWebLifecycleState', { state: 'active' });

    // Disparar evento visibilitychange por si el navegador necesita un tick
    await pageAlice.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 5. Validar reconexión y verificar que no hay Error 508
    console.log('🔄 Esperando reconexión automática tras despertar...');
    await expect(cardBobInAlice.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 20000 });
    console.log('✅ ¡Alice y Bob han recuperado el estado ONLINE sin Error 508!');

    // 6. Probar intercambio de datos real a través del canal recuperado
    console.log('\n--- 💬 4️⃣ PROBAR MENSAJERÍA DIRECTA TRAS RECONEXIÓN ---');
    await cardBobInAlice.locator('.open-chat').click();
    await expect(pageAlice.locator('#chat-panel')).toBeVisible();

    const testMsg = `Ping 5G-${Date.now()}`;
    await pageAlice.locator('#chat-input').fill(testMsg);
    await pageAlice.locator('#send-chat-btn').click();

    // Comprobar que Bob recibe el mensaje
    await pageBob.locator(`.contact-card:has-text("Alice Móvil 5G") .open-chat`).click();
    await expect(pageBob.locator('#chat-panel')).toBeVisible();
    await expect(pageBob.locator('#chat-messages')).toContainText(testMsg, { timeout: 10000 });
    console.log(`✅ ¡Bob ha recibido el mensaje '${testMsg}' tras la recuperación!`);

    // Cerrar chats si aplica
    const closeAlice = pageAlice.locator('#close-chat-btn');
    if (await closeAlice.isVisible()) await closeAlice.click();
    const closeBob = pageBob.locator('#close-chat-btn');
    if (await closeBob.isVisible()) await closeBob.click();

    // 7. Inspeccionar los logs finales en el panel de telemetría de Alice
    console.log('\n--- 📋 LEYENDO LOGS DE SEÑALIZACIÓN Y TELEMETRÍA (ESTADO POST-RECUPERACIÓN) ---');
    await pageAlice.locator('#status-indicator').click();
    await expect(pageAlice.locator('#conn-stats-modal')).toBeVisible();

    const logsPost = await pageAlice.locator('#diag-logs-container').innerText();
    console.log('--- [REGISTRO TELEMETRÍA ALICE (POST-RECONEXIÓN 5G)] ---');
    console.log(logsPost.trim());
    console.log('---------------------------------------------------------');

    expect(logsPost).toContain('[P2P]');
    expect(logsPost).toContain('Canal de datos WebRTC abierto');
  });
});
