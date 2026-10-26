import { test, expect } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import path from 'path';

let serverProcess;
const TOXIPROXY_CONTAINER = 'pingo-toxiproxy-sim';
const TOXIPROXY_API = 'http://127.0.0.1:8474';

const REAL_HTTP_PORT = 9005;
const REAL_TURN_PORT = 3479;

const PROXY_HTTP_PORT = 9006;
const PROXY_TURN_PORT = 3485;

// Helper: Derivación de ID idéntica a Pingo
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

// Helpers para interactuar con la API REST de Toxiproxy
async function createToxiproxy(name, listen, upstream) {
  const res = await fetch(`${TOXIPROXY_API}/proxies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, listen, upstream, enabled: true })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create proxy ${name}: ${err}`);
  }
}

async function addToxic(proxyName, toxicName, type, attributes, stream = 'downstream') {
  const res = await fetch(`${TOXIPROXY_API}/proxies/${proxyName}/toxics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: toxicName, type, attributes, stream, toxicity: 1.0 })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add toxic ${toxicName} to ${proxyName}: ${err}`);
  }
}

async function removeToxic(proxyName, toxicName) {
  await fetch(`${TOXIPROXY_API}/proxies/${proxyName}/toxics/${toxicName}`, {
    method: 'DELETE'
  });
}

async function setProxyEnabled(proxyName, enabled) {
  const res = await fetch(`${TOXIPROXY_API}/proxies/${proxyName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to toggle proxy ${proxyName} (enabled=${enabled}): ${err}`);
  }
}

test.beforeAll(async () => {
  // 1. Limpiar cualquier contenedor previo y arrancar Toxiproxy
  try {
    execSync(`docker rm -f ${TOXIPROXY_CONTAINER} >/dev/null 2>&1 || true`);
  } catch (e) {}

  console.log('🧪 [Setup] Arrancando contenedor Toxiproxy...');
  execSync(`docker run -d --name ${TOXIPROXY_CONTAINER} --net=host --rm ghcr.io/shopify/toxiproxy:2.11.0`);
  
  // Esperar a que Toxiproxy responda en puerto 8474
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${TOXIPROXY_API}/version`);
      if (res.ok) break;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }

  // 2. Arrancar pingo-server con RingRelay en puertos físicos
  console.log('🚀 [Setup] Arrancando pingo-server con RingRelay en puerto 9005...');
  const serverBinary = path.resolve('server/pingo-server');
  serverProcess = spawn(serverBinary, [
    '-no-upnp',
    `-port=${REAL_HTTP_PORT}`,
    `-turn-port=${REAL_TURN_PORT}`,
    '-min-port=7000',
    '-max-port=7002',
    '-public-ip=127.0.0.1',
    '-user=pingo',
    '-password=pingosecret',
    '-realm=pingo'
  ], { stdio: 'pipe' });

  serverProcess.stderr.on('data', data => {
    const s = data.toString().trim();
    if (s.includes('[TURN') || s.includes('[Ring') || s.includes('508') || s.includes('error')) {
      console.log(`📡 [Go Server] ${s}`);
    }
  });

  await new Promise(r => setTimeout(r, 1500));

  // 3. Crear proxies en Toxiproxy
  console.log('🔀 [Setup] Configurando proxies en Toxiproxy:');
  console.log(`   - Señalización: 127.0.0.1:${PROXY_HTTP_PORT} -> 127.0.0.1:${REAL_HTTP_PORT}`);
  console.log(`   - TURN TCP:     127.0.0.1:${PROXY_TURN_PORT} -> 127.0.0.1:${REAL_TURN_PORT}`);
  
  await createToxiproxy('proxy_signaling', `127.0.0.1:${PROXY_HTTP_PORT}`, `127.0.0.1:${REAL_HTTP_PORT}`);
  await createToxiproxy('proxy_turn', `127.0.0.1:${PROXY_TURN_PORT}`, `127.0.0.1:${REAL_TURN_PORT}`);
});

test.afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    console.log('🛑 [Teardown] pingo-server detenido.');
  }
  try {
    execSync(`docker rm -f ${TOXIPROXY_CONTAINER} >/dev/null 2>&1 || true`);
    console.log('🛑 [Teardown] Toxiproxy detenido.');
  } catch (e) {}
});

async function setupPeer(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda, proxyHttp, proxyTurn }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_my_id', identity.id);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
    localStorage.setItem('pingo_local_signaling', '1');
    localStorage.setItem('pingo_use_cloud', 'true');
    localStorage.setItem('pingo_server_config', JSON.stringify({
      version: 1,
      signaling: { host: '127.0.0.1', port: proxyHttp, path: '/', secure: false },
      turn: {
        urls: [
          `turn:127.0.0.1:${proxyTurn}?transport=tcp`
        ],
        username: 'pingo',
        credential: 'pingosecret'
      }
    }));
  }, { identity, agenda, proxyHttp: PROXY_HTTP_PORT, proxyTurn: PROXY_TURN_PORT });
}

test.describe('Simulación de Red Móvil Caótica con Toxiproxy (TURN + RingRelay)', () => {

  test('Sobrevivencia a latencia 5G, micro-cortes y recuperación sin error 508', async ({ browser }) => {
    test.setTimeout(75000);

    const idAlice = await deriveIdFor('phraseAliceToxi', 'saltAliceToxi');
    const idBob = await deriveIdFor('phraseBobToxi', 'saltBobToxi');

    const identityAlice = { id: idAlice, alias: 'Alice Móvil 5G', phrase: 'phraseAliceToxi', salt: 'saltAliceToxi' };
    const identityBob = { id: idBob, alias: 'Bob Amigo', phrase: 'phraseBobToxi', salt: 'saltBobToxi' };

    const agendaAlice = [{ alias: 'Bob Amigo', derivedId: idBob }];
    const agendaBob = [{ alias: 'Alice Móvil 5G', derivedId: idAlice }];

    const contextAlice = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextBob = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    pageAlice.on('console', msg => {
      const t = msg.text();
      if (t.includes('[Peer]') || t.includes('[TURN]') || t.includes('WebRTC') || t.includes('Error')) {
        console.log(`📱 [Alice] ${t}`);
      }
    });

    await setupPeer(pageAlice, identityAlice, agendaAlice);
    await setupPeer(pageBob, identityBob, agendaBob);

    const testUrl = '/';
    await Promise.all([
      pageAlice.goto(testUrl),
      pageBob.goto(testUrl)
    ]);

    // 1. Conexión Inicial a través de Toxiproxy
    console.log('\n--- 1️⃣ ESTABLECIENDO CONEXIÓN P2P MEDIANTE TOXIPROXY (TURN TCP) ---');
    const cardBob = pageAlice.locator(`.contact-card:has-text("Bob Amigo")`);
    await expect(cardBob).toBeVisible();
    await cardBob.locator('.connect-contact').click();

    await expect(cardBob.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log('✅ Conexión establecida correctamente a través del proxy TURN.');

    // Enviar primer mensaje inicial
    await cardBob.locator('.open-chat').click();
    await expect(pageAlice.locator('#chat-panel')).toBeVisible();
    await pageAlice.locator('#chat-input').fill('Mensaje 1: Conexión base');
    await pageAlice.locator('#send-chat-btn').click();

    await pageBob.locator(`.contact-card:has-text("Alice Móvil 5G") .open-chat`).click();
    await expect(pageBob.locator('#chat-panel')).toBeVisible();
    await expect(pageBob.locator('#chat-messages')).toContainText('Mensaje 1: Conexión base', { timeout: 8000 });
    console.log('✅ Mensaje 1 recibido correctamente por Bob.');

    // 2. Inyectar Latencia y Jitter 5G (150ms + 50ms jitter)
    console.log('\n--- 2️⃣ INYECTANDO LATENCIA Y JITTER 5G EN TIEMPO REAL (150ms ± 50ms) ---');
    await addToxic('proxy_turn', 'mobile_latency', 'latency', { latency: 150, jitter: 50 });
    await addToxic('proxy_signaling', 'sig_latency', 'latency', { latency: 150, jitter: 50 });

    const msgWithLatency = `Mensaje 2: 5G Latente (${Date.now()})`;
    await pageAlice.locator('#chat-input').fill(msgWithLatency);
    await pageAlice.locator('#send-chat-btn').click();

    await expect(pageBob.locator('#chat-messages')).toContainText(msgWithLatency, { timeout: 10000 });
    console.log('✅ Mensaje 2 entregado con éxito a través del túnel con latencia y jitter.');

    // 3. Simular Apagón / Túnel / Micro-corte Total de Red 5G (Caída de proxies)
    console.log('\n--- 3️⃣ SIMULANDO CORTE TOTAL DE RED 5G (BLACKOUT 6 SEGUNDOS) ---');
    await setProxyEnabled('proxy_turn', false);
    await setProxyEnabled('proxy_signaling', false);

    console.log('⏳ Red desactivada durante 6 segundos (simulando ascensor/túnel)...');
    await pageAlice.waitForTimeout(6000);

    // 4. Restauración de Cobertura y Verificación de Auto-Reconexión
    console.log('\n--- 4️⃣ RESTAURANDO COBERTURA 5G Y VERIFICANDO AUTO-RECUPERACIÓN ---');
    await removeToxic('proxy_turn', 'mobile_latency');
    await removeToxic('proxy_signaling', 'sig_latency');
    await setProxyEnabled('proxy_turn', true);
    await setProxyEnabled('proxy_signaling', true);

    // Esperar a que el canal se restablezca automáticamente
    console.log('🔄 Esperando auto-reconexión del canal P2P/TURN...');
    await expect(cardBob.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 25000 });
    console.log('✅ Conexión recuperada con éxito a estado ONLINE tras la caída.');

    // 5. Intercambio de mensajes post-recuperación
    console.log('\n--- 5️⃣ VERIFICANDO INTERCAMBIO DE MENSAJES TRAS LA RECONEXIÓN ---');
    const msgPostRecovery = `Mensaje 3: ¡5G Recuperado! (${Date.now()})`;
    await pageBob.locator('#chat-input').fill(msgPostRecovery);
    await pageBob.locator('#send-chat-btn').click();

    await expect(pageAlice.locator('#chat-messages')).toContainText(msgPostRecovery, { timeout: 10000 });
    console.log('✅ Mensaje 3 entregado y recibido por Alice sin pérdidas.');

    // 6. Verificar Telemetría y comprobar ausencia de Error 508
    console.log('\n--- 6️⃣ AUDITORÍA DE TELEMETRÍA Y CONTROL DE ASIGNACIONES TURN ---');
    await pageAlice.locator('#status-indicator').click();
    await expect(pageAlice.locator('#conn-stats-modal')).toBeVisible();

    const telemetryLogs = await pageAlice.locator('#diag-logs-container').innerText();
    console.log('--- [REGISTRO TELEMETRÍA ALICE (POST-RECUPERACIÓN TOXIPROXY)] ---');
    console.log(telemetryLogs.trim());
    console.log('-----------------------------------------------------------------');

    expect(telemetryLogs).not.toContain('508');
    expect(telemetryLogs).not.toContain('Insufficient Capacity');
    expect(telemetryLogs).toContain('[P2P]');
    console.log('🎉 ¡Prueba superada! El RingRelay multiplexó los puertos y sobrevivió al caos sin error 508.');
  });

});
