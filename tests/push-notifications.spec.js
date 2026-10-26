import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import crypto from 'crypto';

let serverProcess;
const HTTP_PORT = 9005;
const TURN_PORT = 3480;

let mockPushServer;
let mockPushPort;
let receivedPushHeaders = null;
let receivedPushBody = null;
let mockResponseStatus = 201;

function generateP256Keys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const pub = ecdh.getPublicKey('base64url'); // 65 bytes uncompressed P-256
  const auth = crypto.randomBytes(16).toString('base64url');
  return { p256dh: pub, auth };
}

function generatePingoAuthToken(salt) {
  if (!salt) return 'public';
  const now = new Date();
  const timeKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  return crypto.createHash('sha256').update(salt + timeKey).digest('hex');
}

test.beforeAll(async () => {
  // 1. Iniciar mock Web Push Server (RFC 8291 / 8292 endpoint)
  await new Promise((resolve) => {
    mockPushServer = http.createServer((req, res) => {
      receivedPushHeaders = req.headers;
      let body = [];
      req.on('data', chunk => body.push(chunk));
      req.on('end', () => {
        receivedPushBody = Buffer.concat(body);
        res.writeHead(mockResponseStatus, { 'Content-Type': 'text/plain' });
        res.end(mockResponseStatus === 201 ? 'Created' : 'Gone');
      });
    });
    mockPushServer.listen(0, '127.0.0.1', () => {
      mockPushPort = mockPushServer.address().port;
      console.log(`📡 [Mock Push Service] Escuchando en http://127.0.0.1:${mockPushPort}`);
      resolve();
    });
  });

  // 2. Iniciar pingo-server
  console.log('🚀 [Test Setup] Arrancando pingo-server en puerto 9005...');
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
  if (mockPushServer) {
    mockPushServer.close();
  }
  if (serverProcess) {
    console.log('🛑 [Test Teardown] Deteniendo pingo-server...');
    serverProcess.kill('SIGTERM');
  }
});

test.describe('Notificaciones Web Push (VAPID) E2E', () => {

  test('1. Descubrimiento dinámico de claves VAPID y credenciales Cloud', async ({ request }) => {
    // A. Endpoint dedicado /push/vapid-public-key
    const vapidRes = await request.get(`http://127.0.0.1:${HTTP_PORT}/push/vapid-public-key`);
    expect(vapidRes.ok()).toBeTruthy();
    const vapidData = await vapidRes.json();
    expect(vapidData.vapidPublicKey).toBeDefined();
    expect(vapidData.vapidPublicKey.length).toBeGreaterThan(50);
    console.log('🔑 [Test] Clave VAPID pública descubierta:', vapidData.vapidPublicKey.slice(0, 15) + '...');

    // B. Endpoint /turn-credentials incluye la misma clave VAPID y cloud config
    const turnRes = await request.get(`http://127.0.0.1:${HTTP_PORT}/turn-credentials?peerId=test-user`);
    expect(turnRes.ok()).toBeTruthy();
    const turnData = await turnRes.json();
    expect(turnData.vapidPublicKey).toBe(vapidData.vapidPublicKey);
    expect(turnData.cloud).toBeDefined();
    expect(turnData.cloud.enabled).toBe(true);
    expect(turnData.cloud.vapidPublicKey).toBe(vapidData.vapidPublicKey);
    expect(turnData.cloud.apiEndpoint).toContain(`:${HTTP_PORT}`);
  });

  test('2. Registro de suscripción WebPush en backend y verificación en /api/status', async ({ request }) => {
    const { p256dh, auth } = generateP256Keys();
    const aliceId = 'alice-11223344';

    const subRes = await request.post(`http://127.0.0.1:${HTTP_PORT}/push/subscribe`, {
      data: {
        userPublicKey: aliceId,
        salt: 'alice-secret-salt',
        endpoint: `http://127.0.0.1:${mockPushPort}/sub/alice`,
        keys: { p256dh, auth }
      }
    });
    expect(subRes.ok()).toBeTruthy();
    const text = await subRes.text();
    expect(text).toBe('Cloud activated');

    // Comprobar /api/status
    const statusRes = await request.get(`http://127.0.0.1:${HTTP_PORT}/api/status`);
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.push.enabled).toBe(true);
    expect(status.push.subscriptions).toBeGreaterThanOrEqual(1);
  });

  test('3. Envío de Push Ping autenticado con entrega cifrada a mock push service', async ({ request }) => {
    const { p256dh: aliceP256, auth: aliceAuth } = generateP256Keys();
    const { p256dh: bobP256, auth: bobAuth } = generateP256Keys();
    const bobId = 'bob-55667788';
    const aliceId = 'alice-11223344';

    // Suscribir a Alice como receptora
    const subAliceRes = await request.post(`http://127.0.0.1:${HTTP_PORT}/push/subscribe`, {
      data: {
        userPublicKey: aliceId,
        salt: 'alice-secret-salt',
        endpoint: `http://127.0.0.1:${mockPushPort}/sub/alice`,
        keys: { p256dh: aliceP256, auth: aliceAuth }
      }
    });
    expect(subAliceRes.ok()).toBeTruthy();

    // Suscribir a Bob como emisor
    const subBobRes = await request.post(`http://127.0.0.1:${HTTP_PORT}/push/subscribe`, {
      data: {
        userPublicKey: bobId,
        salt: 'bob-salt',
        endpoint: `http://127.0.0.1:${mockPushPort}/sub/bob`,
        keys: { p256dh: bobP256, auth: bobAuth }
      }
    });
    expect(subBobRes.ok()).toBeTruthy();

    // Bob envía Push Ping a Alice con X-Pingo-Auth válido
    mockResponseStatus = 201;
    receivedPushHeaders = null;
    receivedPushBody = null;

    const authToken = generatePingoAuthToken('bob-salt');
    const sendRes = await request.post(`http://127.0.0.1:${HTTP_PORT}/push/send/${aliceId}?from=${bobId}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Pingo-Auth': authToken
      },
      data: {
        title: '¡Pingo! 🔔',
        body: 'Hola Alice, soy Bob.',
        url: `https://localhost:5188/?pingo=${bobId}&chat=1`
      }
    });

    if (!sendRes.ok()) {
      console.error('Send Error Status:', sendRes.status(), await sendRes.text());
    }
    expect(sendRes.ok()).toBeTruthy();
    expect(sendRes.status()).toBe(201);

    // Verificar que el mock push service recibió la notificación RFC 8291/8292
    expect(receivedPushHeaders).toBeDefined();
    expect(receivedPushHeaders['authorization']).toMatch(/^vapid /);
    expect(receivedPushHeaders['ttl']).toBe('30');
    expect(receivedPushBody).toBeDefined();
    expect(receivedPushBody.length).toBeGreaterThan(0);
    console.log(`✅ [Test] Push entregado con éxito con cabeceras VAPID: ${receivedPushHeaders['authorization'].slice(0, 30)}...`);
  });

  test('4. Auto-limpieza de suscripciones obsoletas (410 Gone)', async ({ request }) => {
    const { p256dh, auth } = generateP256Keys();
    const charlieId = 'charlie-99887766';

    // Suscribir a Charlie
    await request.post(`http://127.0.0.1:${HTTP_PORT}/push/subscribe`, {
      data: {
        userPublicKey: charlieId,
        salt: 'charlie-salt',
        endpoint: `http://127.0.0.1:${mockPushPort}/sub/charlie`,
        keys: { p256dh, auth }
      }
    });

    // Simular que el servicio Push responde 410 Gone (suscripción cancelada por navegador)
    mockResponseStatus = 410;

    // Llamar a /push/test/charlie
    const testRes = await request.get(`http://127.0.0.1:${HTTP_PORT}/push/test/${charlieId}`);
    expect(testRes.status()).toBe(200);

    // Intentar segundo envío: Charlie ya no debe estar registrado
    const secondRes = await request.get(`http://127.0.0.1:${HTTP_PORT}/push/test/${charlieId}`);
    expect(secondRes.status()).toBe(404);
    console.log('✅ [Test] Suscripción muerta eliminada automáticamente tras 410 Gone');
  });

  test('5. Interfaz de Usuario: Botón de Ping Push en Agenda y envío interactivo', async ({ page }) => {
    // Inyectar contacto y configuración en cliente Web
    await page.addInitScript(() => {
      localStorage.setItem('pingo_alias', 'Alice');
      localStorage.setItem('pingo_passphrase', 'claveAlice123');
      localStorage.setItem('pingo_server_config', JSON.stringify({
        signaling: { host: 'localhost', port: 9005, path: '/', secure: false },
        cloud: { enabled: true, apiEndpoint: 'http://localhost:9005' }
      }));
      localStorage.setItem('pingo_agenda', JSON.stringify([
        {
          alias: 'Contacto Remoto',
          phrase: 'secretoRemoto',
          salt: 'salRemoto',
          publicKey: null,
          derivedId: '98765432'
        }
      ]));
    });

    await page.goto('/');

    // Verificar que el botón de campana .send-ping está visible en la tarjeta de contacto
    const pingBtn = page.locator('.contact-card .send-ping').first();
    await expect(pingBtn).toBeVisible();

    // Mockear la respuesta de /push/send/98765432 para validar el flujo UI
    await page.route('**/push/send/*', async route => {
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'Push sent'
      });
    });

    // Pulsar el botón de ping
    await pingBtn.click();

    // Verificar que la barra de estado de ubicación reacciona al envío
    const statusMsg = page.locator('#location-status');
    await expect(statusMsg).toHaveText(/Ping/i);
    console.log('✅ [Test] Flujo de botón Ping Push interactivo en la agenda validado');
  });

});
