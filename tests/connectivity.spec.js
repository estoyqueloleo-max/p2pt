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
  // Start the local PeerJS signaling server as a separate process on port 9000
  peerProcess = spawn('node', ['./tests/peer-server.cjs'], { stdio: 'inherit' });
  console.log('[Test Signaling Process] Spawning PeerJS server...');
  // Wait a moment for it to start listening
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

test.afterAll(async () => {
  if (peerProcess) {
    peerProcess.kill();
    console.log('[Test Signaling Process] Terminated');
  }
});

// Configure localStorage before page loading
async function initNodeLocalStorage(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_my_id', identity.id);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
    localStorage.setItem('pingo_use_cloud', 'true'); // Required to fetch TURN etc.
  }, { identity, agenda });
}

test('Debe establecer una red compleja de 5 nodos y verificar la propagación del chat P2P', async ({ browser }, testInfo) => {
  test.setTimeout(120000); // 2 minutes timeout for WebRTC handshakes and page loading

  // 1. Calculate IDs
  const idA = await deriveIdFor('phraseA', 'saltA');
  const idB = await deriveIdFor('phraseB', 'saltB');
  const idC = await deriveIdFor('phraseC', 'saltC');
  const idD = await deriveIdFor('phraseD', 'saltD');
  const idE = await deriveIdFor('phraseE', 'saltE');

  console.log(`[Test] Calculated IDs:\n Node A: ${idA}\n Node B: ${idB}\n Node C: ${idC}\n Node D: ${idD}\n Node E: ${idE}`);

  const identityA = { id: idA, alias: 'NodeA', phrase: 'phraseA', salt: 'saltA' };
  const identityB = { id: idB, alias: 'NodeB', phrase: 'phraseB', salt: 'saltB' };
  const identityC = { id: idC, alias: 'NodeC', phrase: 'phraseC', salt: 'saltC' };
  const identityD = { id: idD, alias: 'NodeD', phrase: 'phraseD', salt: 'saltD' };
  const identityE = { id: idE, alias: 'NodeE', phrase: 'phraseE', salt: 'saltE' };

  // Define Agendas to build the topology:
  // Node A <-> Node B <-> [Node C, Node D] <-> Node E
  const agendaA = [
    { alias: 'NodeB', phrase: 'phraseB', salt: 'saltB', derivedId: idB }
  ];
  const agendaB = [
    { alias: 'NodeA', phrase: 'phraseA', salt: 'saltA', derivedId: idA },
    { alias: 'NodeC', phrase: 'phraseC', salt: 'saltC', derivedId: idC },
    { alias: 'NodeD', phrase: 'phraseD', salt: 'saltD', derivedId: idD }
  ];
  const agendaC = [
    { alias: 'NodeB', phrase: 'phraseB', salt: 'saltB', derivedId: idB },
    { alias: 'NodeE', phrase: 'phraseE', salt: 'saltE', derivedId: idE }
  ];
  const agendaD = [
    { alias: 'NodeB', phrase: 'phraseB', salt: 'saltB', derivedId: idB },
    { alias: 'NodeE', phrase: 'phraseE', salt: 'saltE', derivedId: idE }
  ];
  const agendaE = [
    { alias: 'NodeC', phrase: 'phraseC', salt: 'saltC', derivedId: idC },
    { alias: 'NodeD', phrase: 'phraseD', salt: 'saltD', derivedId: idD }
  ];

  // 2. Open pages and init localStorage
  const contexts = await Promise.all([
    browser.newContext({ ignoreHTTPSErrors: true, recordVideo: { dir: './test-results/videos/' } }),
    browser.newContext({ ignoreHTTPSErrors: true, recordVideo: { dir: './test-results/videos/' } }),
    browser.newContext({ ignoreHTTPSErrors: true, recordVideo: { dir: './test-results/videos/' } }),
    browser.newContext({ ignoreHTTPSErrors: true, recordVideo: { dir: './test-results/videos/' } }),
    browser.newContext({ ignoreHTTPSErrors: true, recordVideo: { dir: './test-results/videos/' } })
  ]);

  const [pageA, pageB, pageC, pageD, pageE] = await Promise.all(contexts.map(ctx => ctx.newPage()));

  await initNodeLocalStorage(pageA, identityA, agendaA);
  await initNodeLocalStorage(pageB, identityB, agendaB);
  await initNodeLocalStorage(pageC, identityC, agendaC);
  await initNodeLocalStorage(pageD, identityD, agendaD);
  await initNodeLocalStorage(pageE, identityE, agendaE);

  // 3. Load application on all pages with local signaling flag
  const testUrl = '/';
  await Promise.all([
    pageA.goto(testUrl),
    pageB.goto(testUrl),
    pageC.goto(testUrl),
    pageD.goto(testUrl),
    pageE.goto(testUrl)
  ]);

  console.log('[Test] All pages loaded. Waiting for signaling registration...');

  // Wait for signaling server connection to be active on all nodes
  const waitSignaling = async (page, name) => {
    const indicator = page.locator('#status-indicator');
    await expect(indicator).toHaveClass(/online/, { timeout: 15000 });
    console.log(`[Test] ${name} is registered and online on signaling server.`);
  };

  await Promise.all([
    waitSignaling(pageA, 'Node A'),
    waitSignaling(pageB, 'Node B'),
    waitSignaling(pageC, 'Node C'),
    waitSignaling(pageD, 'Node D'),
    waitSignaling(pageE, 'Node E')
  ]);

  // Ensure we are on the network tab to interact with the agenda
  await Promise.all([
    pageA.locator('#nav-network-btn').click(),
    pageB.locator('#nav-network-btn').click(),
    pageC.locator('#nav-network-btn').click(),
    pageD.locator('#nav-network-btn').click(),
    pageE.locator('#nav-network-btn').click()
  ]);

  // Helper to establish connection from Node X to Node Y
  const connectNodes = async (fromPage, toAlias, toId, fromName) => {
    console.log(`[Test] ${fromName} is connecting to ${toAlias}...`);
    // Find the contact card for toAlias
    const card = fromPage.locator(`.contact-card:has-text("${toAlias}")`);
    // Click the connect icon button inside that card
    await card.locator('.connect-contact').click();
    // Wait for the status dot in the card to become green (online)
    await expect(card.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log(`[Test] Connection established from ${fromName} to ${toAlias}.`);
  };

  // 4. Establish connections to build the topology:
  // A connects to B
  await connectNodes(pageA, 'NodeB', idB, 'Node A');

  // B connects to C and D
  await connectNodes(pageB, 'NodeC', idC, 'Node B');
  await connectNodes(pageB, 'NodeD', idD, 'Node B');

  // C connects to E
  await connectNodes(pageC, 'NodeE', idE, 'Node C');

  // D connects to E
  await connectNodes(pageD, 'NodeE', idE, 'Node D');

  // Give connections 1 second to settle and sync statuses on both ends
  await pageA.waitForTimeout(1000);

  // Assert bilateral connectivity statuses are green on all pages
  const checkStatusDot = async (page, alias, name) => {
    const card = page.locator(`.contact-card:has-text("${alias}")`);
    await expect(card.locator('.contact-status-dot')).toHaveClass(/online/);
    console.log(`[Test] Verified ${name} sees ${alias} as online.`);
  };

  await checkStatusDot(pageB, 'NodeA', 'Node B');
  await checkStatusDot(pageC, 'NodeB', 'Node C');
  await checkStatusDot(pageD, 'NodeB', 'Node D');
  await checkStatusDot(pageE, 'NodeC', 'Node E');
  await checkStatusDot(pageE, 'NodeD', 'Node E');

  console.log('[Test] Network fully established!');

  // 5. Test Chat Message Propagation and De-duplication
  console.log('[Test] Starting Chat tests...');

  // Ensure we are on the network tab to see the contacts
  await pageA.locator('#nav-network-btn').click();

  // Open chat specifically with Node B (activeChatPeerId)
  await pageA.locator(`.contact-card:has-text("NodeB")`).locator('.open-chat').click();

  // Switch to the communication tab to interact with the chat
  await pageA.locator('#nav-comm-btn').click();
  await expect(pageA.locator('#chat-panel h3')).toHaveText(/Chat: NodeB/);

  // Type message and click send on Node A
  const msgText = 'Hello from Node A - ' + Date.now();
  await pageA.locator('#chat-input').fill(msgText);
  await pageA.locator('#send-chat-btn').click();
  console.log(`[Test] Node A sent message: "${msgText}"`);

  // Verify Node B received it
  await pageB.locator('#nav-comm-btn').click();
  const messageInB = pageB.locator('#chat-messages').locator('.message-bubble.received', { hasText: msgText });
  await expect(messageInB).toBeVisible({ timeout: 10000 });
  console.log('[Test] Node B successfully received the message.');

  // Verify Node C and Node D received the relayed message (1 hop relay)
  await pageC.locator('#nav-comm-btn').click();
  const messageInC = pageC.locator('#chat-messages').locator('.message-bubble.received', { hasText: msgText });
  await expect(messageInC).toBeVisible({ timeout: 10000 });
  console.log('[Test] Node C successfully received the relayed message.');

  await pageD.locator('#nav-comm-btn').click();
  const messageInD = pageD.locator('#chat-messages').locator('.message-bubble.received', { hasText: msgText });
  await expect(messageInD).toBeVisible({ timeout: 10000 });
  console.log('[Test] Node D successfully received the relayed message.');

  // Verify Node E did NOT receive the message (since C and D stop relaying due to relayedFrom flag)
  await pageE.locator('#nav-comm-btn').click();
  const messageInE = pageE.locator('#chat-messages').locator('.message-bubble.received', { hasText: msgText });
  await expect(messageInE).toBeHidden({ timeout: 5000 });
  console.log('[Test] Node E correctly did NOT receive the message (propagation limited to 2 hops).');

  // Get video paths before closing contexts
  const videoPaths = await Promise.all([
    pageA.video()?.path(),
    pageB.video()?.path(),
    pageC.video()?.path(),
    pageD.video()?.path(),
    pageE.video()?.path()
  ]);

  // Close contexts to save the videos
  await Promise.all(contexts.map(ctx => ctx.close()));

  // Attach videos to the test report
  const nodeNames = ['Node A (Sender)', 'Node B (Receiver & Relay)', 'Node C (Relay)', 'Node D (Relay)', 'Node E (Limit Hops)'];
  for (let i = 0; i < videoPaths.length; i++) {
    const path = videoPaths[i];
    if (path) {
      await testInfo.attach(`Video - ${nodeNames[i]}`, {
        path: path,
        contentType: 'video/webm'
      });
    }
  }
});
