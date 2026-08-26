import { test, expect } from '@playwright/test';
import { spawn } from 'child_process';
import * as crypto from 'crypto';

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

  // Wait a short duration to ensure PeerJS server is active
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
    const keylen = 16; // 128 bits
    crypto.pbkdf2(phrase, salt, iterations, keylen, 'sha-256', (err, derivedKey) => {
      if (err) throw err;
      // Convert to integer between 10000000 and 99999999
      const hex = derivedKey.toString('hex');
      const num = parseInt(hex.substring(0, 8), 16);
      const id = (10000000 + (num % 90000000)).toString();
      resolve(id);
    });
  });
}

// Pre-initialize local storage for pingo settings
async function initNodeLocalStorage(page, identity, agenda) {
  await page.addInitScript(({ identity, agenda }) => {
    localStorage.setItem('pingo_passphrase', identity.phrase);
    localStorage.setItem('pingo_salt', identity.salt);
    localStorage.setItem('pingo_alias', identity.alias);
    localStorage.setItem('pingo_my_id', identity.id);
    localStorage.setItem('pingo_agenda', JSON.stringify(agenda));
    localStorage.setItem('pingo_use_cloud', 'true'); // Required to load TURN etc.
    localStorage.setItem('pingo_allow_exact_search', 'true');
    localStorage.setItem('pingo_allow_semantic_search', 'true');
  }, { identity, agenda });
}

test('Debe propagar búsquedas P2P, verificar reverse-path routing, controles de privacidad y TTL', async ({ browser }, testInfo) => {
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

  // 2. Open pages with video recording enabled
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

  // 3. Load application on all pages
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
    const card = fromPage.locator(`.contact-card:has-text("${toAlias}")`);
    await card.locator('.connect-contact').click();
    await expect(card.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log(`[Test] Connection established from ${fromName} to ${toAlias}.`);
  };

  // 4. Establish connections to build the topology:
  // Node A <-> Node B <-> [Node C, Node D] <-> Node E
  await connectNodes(pageA, 'NodeB', idB, 'Node A');
  await connectNodes(pageB, 'NodeC', idC, 'Node B');
  await connectNodes(pageB, 'NodeD', idD, 'Node B');
  await connectNodes(pageC, 'NodeE', idE, 'Node C');
  await connectNodes(pageD, 'NodeE', idE, 'Node D');

  // Give connections 1 second to settle and sync statuses on both ends
  await pageA.waitForTimeout(1000);

  // Assert bilateral connectivity statuses are green on all pages
  const checkStatusDot = async (page, alias, name) => {
    const card = page.locator(`.contact-card:has-text("${alias}")`);
    await expect(card.locator('.contact-status-dot')).toHaveClass(/online/);
  };
  await Promise.all([
    checkStatusDot(pageB, 'NodeA', 'Node B'),
    checkStatusDot(pageC, 'NodeB', 'Node C'),
    checkStatusDot(pageD, 'NodeB', 'Node D'),
    checkStatusDot(pageE, 'NodeC', 'Node E'),
    checkStatusDot(pageE, 'NodeD', 'Node E')
  ]);
  console.log('[Test] Network topology A <-> B <-> [C, D] <-> E fully established!');

  // Helper to create a note through the Text Editor UI, saving to Git and indexing
  const createNoteViaUI = async (page, title, content, isPublic, nodeName) => {
    console.log(`[Test] ${nodeName} is creating note "${title}"...`);

    // Switch to Workspace & Git mode to make sure panel and buttons are visible
    await page.locator('#nav-workspace-btn').click();
    await expect(page.locator('#create-note-btn')).toBeVisible();

    // Intercept prompt dialog for note title
    page.once('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.accept(title);
      }
    });

    await page.locator('#create-note-btn').click();
    
    // Fill text editor content
    const editorTextarea = page.locator('#text-editor-textarea');
    await expect(editorTextarea).toBeVisible();
    await editorTextarea.fill(content);

    // Visibility toggle
    const toggle = page.locator('#editor-visibility-toggle');
    const checked = await toggle.isChecked();
    if (checked !== isPublic) {
      await toggle.click();
    }

    // Intercept confirmation alert dialog
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    await page.locator('#save-editor-btn').click();
    await expect(page.locator('#text-editor-container')).toBeHidden();

    // Switch to Communication & Search mode to see the index button
    await page.locator('#nav-comm-btn').click();

    // Re-index content so the new Git commits are registered
    await page.locator('#index-vectors-btn').click();
    await expect(page.locator('#vector-index-progress')).toBeHidden({ timeout: 15000 });

    console.log(`[Test] Note "${title}" created, saved to Git, and indexed on ${nodeName}.`);
  };

  // Create notes sequentially to avoid parallel dialog conflicts
  await createNoteViaUI(pageB, 'Guía de Escalada en Montserrat', 'Guía de Escalada en Montserrat\nescalar en cataluña montserrat', true, 'Node B');
  await createNoteViaUI(pageC, 'Receta de Paella Valenciana', 'Receta de Paella Valenciana\ncocinar arroz y marisco valencia', true, 'Node C');
  await createNoteViaUI(pageD, 'Receta Secreta de Paella', 'Receta Secreta de Paella\ningredientes secretos valencia', false, 'Node D');
  await createNoteViaUI(pageE, 'Manual de Supervivencia y Orientación', 'Manual de Supervivencia y Orientación\norientarse en la montaña supervivencia', true, 'Node E');

  // Switch Page A to Workspace & Git mode so routes list is visible
  await pageA.locator('#nav-workspace-btn').click();
  await pageA.evaluate(() => {
    window.pingo.elements.routesContainer.innerHTML = '';
  });

  // Helper to type query visibly on Page A and then send P2P broadcast
  const performSearchOnNodeA = async (queryText, ttl, queryId) => {
    // We need to be on the comm tab to see the search input
    await pageA.locator('#nav-comm-btn').click();

    const input = pageA.locator('#semantic-search-input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('');
    await input.pressSequentially(`${queryText} (TTL=${ttl})`, { delay: 80 });
    await pageA.waitForTimeout(1500);

    // Switch back to workspace tab to see incoming results
    await pageA.locator('#nav-workspace-btn').click();

    await pageA.evaluate(async ({ queryId, queryText, ttl }) => {
      const { broadcastSearchQuery } = await import('/src/js/peer-manager.js');
      broadcastSearchQuery(queryId, 'exact', queryText, ttl);
    }, { queryId, queryText, ttl });
  };

  // 6. Test Scenario A: Search "Paella" with TTL = 2
  // We expect to find the public recipe from C (2 hops: A -> B -> C),
  // but NOT the private recipe from D (even though D is at 2 hops, it is private).
  console.log('[Test] Starting Test Scenario A: Search "Paella" with TTL = 2');
  const queryIdPaella = 'q_paella_' + Date.now();
  await performSearchOnNodeA('Paella', 2, queryIdPaella);

  // A should receive Node C's public Paella document
  const cardPaellaC = pageA.locator('.contact-card.route-card:has-text("Paella Valenciana")');
  await cardPaellaC.scrollIntoViewIfNeeded();
  await expect(cardPaellaC).toBeVisible({ timeout: 15000 });
  console.log('[Test] Node A successfully received public Paella Valenciana from Node C (2 hops away).');

  // A should NOT receive Node D's private Paella document
  const cardPaellaD = pageA.locator('.contact-card.route-card:has-text("Secreta")');
  await expect(cardPaellaD).toBeHidden({ timeout: 5000 });
  console.log('[Test] Verified Node A did NOT receive private Paella recipe from Node D.');
  await pageA.waitForTimeout(2000); // Let the result stay visible on video

  // 7. Test Scenario B: Search "Supervivencia" with TTL = 2 (Should NOT reach E)
  // Node E is 3 hops away (A -> B -> C/D -> E). With TTL = 2, the query should die before E.
  console.log('[Test] Starting Test Scenario B: Search "Supervivencia" with TTL = 2');
  const queryIdSupervivencia2 = 'q_super2_' + Date.now();
  await performSearchOnNodeA('Supervivencia', 2, queryIdSupervivencia2);

  // A should NOT receive E's document because TTL expired
  const cardSupervivenciaE = pageA.locator('.contact-card.route-card:has-text("Supervivencia")');
  await pageA.locator('#routes-container').scrollIntoViewIfNeeded();
  await expect(cardSupervivenciaE).toBeHidden({ timeout: 5000 });
  console.log('[Test] Verified Node A did NOT receive "Supervivencia" from Node E with TTL = 2.');
  await pageA.waitForTimeout(2000);

  // 8. Test Scenario C: Search "Supervivencia" with TTL = 3 (Should reach E)
  // Node E is 3 hops away. With TTL = 3, the query should reach E and flow back.
  console.log('[Test] Starting Test Scenario C: Search "Supervivencia" with TTL = 3');
  const queryIdSupervivencia3 = 'q_super3_' + Date.now();
  await performSearchOnNodeA('Supervivencia', 3, queryIdSupervivencia3);

  // A should receive E's document
  await cardSupervivenciaE.scrollIntoViewIfNeeded();
  await expect(cardSupervivenciaE).toBeVisible({ timeout: 15000 });
  console.log('[Test] Node A successfully received "Supervivencia" from Node E with TTL = 3!');
  await pageA.waitForTimeout(3000); // Final pause to show results in the video

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
  const nodeNames = ['Node A (Originator)', 'Node B (Relay 1)', 'Node C (Relay 2 - Public paella)', 'Node D (Relay 2 - Private paella)', 'Node E (Relay 3 - Supervivencia)'];
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
