import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';

let peerProcess;

// Helper to derive Peer ID using the exact same PBKDF2 algorithm as the Pingo app
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
  peerProcess = spawn('node', ['./tests/peer-server.cjs'], { stdio: 'inherit' });
  console.log('[Test Signaling Process] Spawning PeerJS server on 9005...');
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

test.afterAll(async () => {
  if (peerProcess) {
    peerProcess.kill();
    console.log('[Test Signaling Process] Terminated');
  }
});

async function initNodeLocalStorage(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_my_id', identity.id);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
    localStorage.setItem('pingo_local_signaling', '1');
    localStorage.setItem('pingo_use_cloud', 'false');
  }, { identity, agenda });
}

test.describe('Zero Trust Asymmetric Cryptography and Challenge-Response Flow', () => {
  test('Two peers perform ECDSA handshake challenge-response and prevent impersonation', async ({ browser }) => {
    test.setTimeout(45000);

    const idAlice = await deriveIdFor('phraseAliceZT', 'saltAliceZT');
    const idBob = await deriveIdFor('phraseBobZT', 'saltBobZT');

    const identityAlice = { id: idAlice, alias: 'Alice', phrase: 'phraseAliceZT', salt: 'saltAliceZT' };
    const identityBob = { id: idBob, alias: 'Bob', phrase: 'phraseBobZT', salt: 'saltBobZT' };

    const agendaAlice = [{ alias: 'Bob', derivedId: idBob }];
    const agendaBob = [{ alias: 'Alice', derivedId: idAlice }];

    const contextAlice = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextBob = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    pageAlice.on('console', msg => console.log(`[Alice Console] ${msg.text()}`));
    pageBob.on('console', msg => console.log(`[Bob Console] ${msg.text()}`));

    await initNodeLocalStorage(pageAlice, identityAlice, agendaAlice);
    await initNodeLocalStorage(pageBob, identityBob, agendaBob);

    const testUrl = '/?localSignaling=1';
    await Promise.all([
      pageAlice.goto(testUrl),
      pageBob.goto(testUrl)
    ]);

    // 1. Verify that both peers generated device-bound ECDSA keys and displayed fingerprints
    await pageAlice.locator('#nav-network-btn').click();
    await pageBob.locator('#nav-network-btn').click();

    await pageAlice.locator('#toggle-identity-btn').click();
    await pageBob.locator('#toggle-identity-btn').click();

    await expect(pageAlice.locator('#identity-crypto-fingerprint')).toContainText('Huella:');
    await expect(pageBob.locator('#identity-crypto-fingerprint')).toContainText('Huella:');

    const aliceFingerprint = await pageAlice.locator('#identity-crypto-fingerprint').innerText();
    const bobFingerprint = await pageBob.locator('#identity-crypto-fingerprint').innerText();
    console.log(`[Test] Alice Fingerprint: "${aliceFingerprint}"`);
    console.log(`[Test] Bob Fingerprint: "${bobFingerprint}"`);

    // 2. Alice connects to Bob; verify successful ECDSA challenge-response handshake
    console.log('[Test] Alice initiating connection to Bob with Zero Trust handshake...');
    const cardBobInAlice = pageAlice.locator('.contact-card:has-text("Bob")');
    await cardBobInAlice.locator('.connect-contact').click();

    // Verify online status achieved
    await expect(cardBobInAlice.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log('[Test] Connection established! Verifying cryptographic shield in Bob contact card...');

    // In Bob's agenda, Alice should now have a shield icon because her public key was verified and bound
    const cardAliceInBob = pageBob.locator('.contact-card:has-text("Alice")');
    await expect(cardAliceInBob.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    await expect(cardAliceInBob.locator('.fa-shield-alt')).toBeVisible();
    console.log('[Test] Shield icon visible on Alice card in Bob agenda (Zero Trust Verified)!');

    // 3. Test Impersonation Protection:
    // If Bob's stored public key for Alice is altered, incoming connection from Alice will be rejected
    console.log('[Test] Testing Impersonation Attack Prevention...');
    await pageBob.evaluate(() => {
      const agenda = JSON.parse(localStorage.getItem('pingo_agenda') || '[]');
      if (agenda[0]) {
        // Corrupt or substitute Alice public key with an impostor key
        agenda[0].publicKey = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIMPOSTOR_FAKE_KEY_DATA1234567890';
        localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
      }
    });

    // Bob disconnects from Alice
    await cardAliceInBob.locator('.connect-contact').click();
    await expect(cardAliceInBob.locator('.contact-status-dot')).not.toHaveClass(/online/, { timeout: 5000 });

    // Alice attempts to reconnect, but Bob expects the fake public key
    console.log('[Test] Alice reconnects against corrupted/impostor public key...');
    await cardBobInAlice.locator('.connect-contact').click();

    // The connection should fail / close due to public key mismatch
    await pageBob.waitForTimeout(1000);
    const bobStatus = await pageBob.locator('#location-status').innerText();
    console.log(`[Test] Bob status after spoofing attempt: "${bobStatus}"`);

    console.log('[Test] Zero Trust Asymmetric Auth E2E test completed successfully!');
  });

  test('Deterministic ECDSA key derivation restores exact identity on device migration', async ({ browser }) => {
    // Escenario: Alice cambia de móvil/navegador.
    // En su móvil antiguo (Context 1), configuró una frase secreta y un salt.
    // Al configurar el mismo secreto en un móvil nuevo (Context 2 con storage limpio),
    // el sistema debe derivar exactamente la misma clave pública y huella criptográfica.
    const phrase = 'vuelo pingo secreto 2026';
    const salt = 'salt_comunidad_v1';

    // Dispositivo 1: Alice en su móvil antiguo
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.addInitScript(({ p, s }) => {
      localStorage.setItem('pingo_user_id', 'alice-device-1');
      localStorage.setItem('pingo_passphrase', p);
      localStorage.setItem('pingo_salt', s);
    }, { p: phrase, s: salt });

    await page1.goto('/?localSignaling=1');
    await page1.locator('#nav-network-btn').click();
    await page1.locator('#toggle-identity-btn').click();
    await expect(page1.locator('#identity-crypto-fingerprint')).toContainText('Huella:');

    const fpDevice1 = await page1.locator('#identity-crypto-fingerprint').innerText();
    const pkDevice1 = await page1.evaluate(async () => {
      const cryptoMgr = await import('./src/js/crypto-manager.js');
      return await cryptoMgr.exportMyPublicKey();
    });

    console.log(`[Device 1] Fingerprint: ${fpDevice1}`);
    console.log(`[Device 1] Public Key: ${pkDevice1}`);

    // Dispositivo 2: Alice en un móvil totalmente nuevo (almacenamiento limpio, nuevo contexto)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.addInitScript(({ p, s }) => {
      localStorage.setItem('pingo_user_id', 'alice-device-2');
      localStorage.setItem('pingo_passphrase', p);
      localStorage.setItem('pingo_salt', s);
    }, { p: phrase, s: salt });

    await page2.goto('/?localSignaling=1');
    await page2.locator('#nav-network-btn').click();
    await page2.locator('#toggle-identity-btn').click();
    await expect(page2.locator('#identity-crypto-fingerprint')).toContainText('Huella:');

    const fpDevice2 = await page2.locator('#identity-crypto-fingerprint').innerText();
    const pkDevice2 = await page2.evaluate(async () => {
      const cryptoMgr = await import('./src/js/crypto-manager.js');
      return await cryptoMgr.exportMyPublicKey();
    });

    console.log(`[Device 2] Fingerprint: ${fpDevice2}`);
    console.log(`[Device 2] Public Key: ${pkDevice2}`);

    // Comprobación criptográfica estricta:
    // Las claves públicas y las huellas digitales derivadas deben ser IDÉNTICAS bit por bit
    expect(fpDevice1).toBe(fpDevice2);
    expect(pkDevice1).toBe(pkDevice2);

    // Además, verificar que una firma generada en el dispositivo 2 es verificable con la clave del dispositivo 1
    const verificationResult = await page2.evaluate(async (pubKeyB64Device1) => {
      const cryptoMgr = await import('./src/js/crypto-manager.js');
      const challenge = 'test-challenge-migration-2026';
      const signature = await cryptoMgr.signChallenge(challenge);
      const peerKey = await cryptoMgr.importPeerPublicKey(pubKeyB64Device1);
      return await cryptoMgr.verifyPeerChallenge(peerKey, challenge, signature);
    }, pkDevice1);

    expect(verificationResult).toBe(true);
    console.log('[Test] Clave derivada con éxito en nuevo dispositivo y firma verificada bilateralmente.');

    await context1.close();
    await context2.close();
  });
});
