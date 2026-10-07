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
  // Start the local PeerJS signaling server as a separate process on port 9005
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

test.describe('Multi-user P2P Git Traceability and Sync Flow', () => {
  test('Two peers exchange notes/routes via WebRTC, track authors in Gitgraph, and sync to appliance', async ({ browser }) => {
    test.setTimeout(90000);

    // 1. Compute deterministic IDs
    const idAlice = await deriveIdFor('phraseAlice', 'saltAlice');
    const idBob = await deriveIdFor('phraseBob', 'saltBob');

    console.log(`[Test] Alice ID: ${idAlice}, Bob ID: ${idBob}`);

    const identityAlice = { id: idAlice, alias: 'Alice', phrase: 'phraseAlice', salt: 'saltAlice' };
    const identityBob = { id: idBob, alias: 'Bob', phrase: 'phraseBob', salt: 'saltBob' };

    const agendaAlice = [
      { alias: 'Bob', phrase: 'phraseBob', salt: 'saltBob', derivedId: idBob }
    ];
    const agendaBob = [
      { alias: 'Alice', phrase: 'phraseAlice', salt: 'saltAlice', derivedId: idAlice }
    ];

    // 2. Open contexts and pages
    const contextAlice = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextBob = await browser.newContext({ ignoreHTTPSErrors: true });

    const pageAlice = await contextAlice.newPage();
    const pageBob = await contextBob.newPage();

    pageAlice.on('console', msg => console.log(`[Alice Console] ${msg.text()}`));
    pageBob.on('console', msg => console.log(`[Bob Console] ${msg.text()}`));

    await initNodeLocalStorage(pageAlice, identityAlice, agendaAlice);
    await initNodeLocalStorage(pageBob, identityBob, agendaBob);

    // Load pages with local signaling query param
    const testUrl = '/?localSignaling=1';
    await Promise.all([
      pageAlice.goto(testUrl),
      pageBob.goto(testUrl)
    ]);

    // Setup dialog handlers
    pageAlice.on('dialog', async dialog => {
      console.log('[Alice Dialog]:', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') {
        await dialog.accept('Ruta de Alice en el Bosque');
      } else {
        await dialog.accept();
      }
    });

    pageBob.on('dialog', async dialog => {
      console.log('[Bob Dialog]:', dialog.type(), dialog.message());
      if (dialog.type() === 'prompt') {
        await dialog.accept('Nota de Bob');
      } else {
        await dialog.accept();
      }
    });

    // 3. Wait for signaling server registration
    const waitSignaling = async (page, name) => {
      const indicator = page.locator('#status-indicator');
      await expect(indicator).toHaveClass(/online/, { timeout: 15000 });
      console.log(`[Test] ${name} is registered and online on signaling server.`);
    };

    await Promise.all([
      waitSignaling(pageAlice, 'Alice'),
      waitSignaling(pageBob, 'Bob')
    ]);

    // Go to Network tab to see Agenda and connect
    await pageAlice.locator('#nav-network-btn').click();
    await pageBob.locator('#nav-network-btn').click();

    // Alice connects to Bob
    console.log('[Test] Alice initiating connection to Bob...');
    const cardBobInAlice = pageAlice.locator('.contact-card:has-text("Bob")');
    await cardBobInAlice.locator('.connect-contact').click();
    await expect(cardBobInAlice.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });
    console.log('[Test] WebRTC connection established between Alice and Bob!');

    // Verify Bob also sees Alice online
    const cardAliceInBob = pageBob.locator('.contact-card:has-text("Alice")');
    await expect(cardAliceInBob.locator('.contact-status-dot')).toHaveClass(/online/, { timeout: 15000 });

    // 4. Bob creates his own local note
    console.log('[Test] Bob creates his own note in Workspace...');
    await pageBob.locator('#nav-workspace-btn').click();
    await pageBob.waitForSelector('#workspace-editor', { state: 'visible' });

    await pageBob.locator('#create-note-btn').click();
    await pageBob.waitForSelector('#text-editor-container', { state: 'visible' });
    await pageBob.locator('#text-editor-textarea').fill('Bitacora inicial creada por Bob');
    await pageBob.locator('#save-editor-btn').click();
    await pageBob.waitForSelector('#text-editor-container', { state: 'hidden' });

    await expect(pageBob.locator('.route-card')).toHaveCount(1);
    console.log('[Test] Bob created 1 local note.');

    // 5. Alice creates a route / note and commits it
    console.log('[Test] Alice creates a route in Workspace...');
    await pageAlice.locator('#nav-workspace-btn').click();
    await pageAlice.waitForSelector('#workspace-editor', { state: 'visible' });

    await pageAlice.locator('#create-note-btn').click();
    await pageAlice.waitForSelector('#text-editor-container', { state: 'visible' });
    await pageAlice.locator('#text-editor-textarea').fill('Ruta compartida: Puntos de paso A -> B -> C');
    await pageAlice.locator('#save-editor-btn').click();
    await pageAlice.waitForSelector('#text-editor-container', { state: 'hidden' });

    await expect(pageAlice.locator('.route-card')).toHaveCount(1);
    console.log('[Test] Alice created 1 local note.');

    // 6. Alice shares her route with Bob over P2P
    console.log('[Test] Alice shares her route with Bob...');
    const shareBtn = pageAlice.locator('.route-card .share-route');
    await shareBtn.click();

    // Alice confirm modal should appear asking to send to Bob
    await expect(pageAlice.locator('#confirm-modal')).toBeVisible();
    await pageAlice.locator('#confirm-modal-ok').click();
    await expect(pageAlice.locator('#confirm-modal')).toBeHidden();

    // 7. Bob receives incoming route share confirmation modal
    console.log('[Test] Waiting for Bob to receive route share modal...');
    await expect(pageBob.locator('#confirm-modal')).toBeVisible({ timeout: 15000 });
    await expect(pageBob.locator('#confirm-modal-message')).toContainText('quiere compartir una ruta contigo');

    // Bob accepts and imports the route
    await pageBob.locator('#confirm-modal-ok').click();
    await expect(pageBob.locator('#confirm-modal')).toBeHidden();

    // Bob should now have 2 cards in Workspace (his own note + Alice's imported route)
    await expect(pageBob.locator('.route-card')).toHaveCount(2, { timeout: 10000 });
    console.log('[Test] Bob successfully imported Alice route into his collection.');

    // 8. Bob opens Gitgraph and inspects the multi-author tree
    console.log('[Test] Bob inspecting Gitgraph...');
    await pageBob.locator('#view-gitgraph-btn').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'visible' });
    await expect(pageBob.locator('#gitgraph-container svg')).toBeVisible();

    // Assert that Gitgraph legend shows both Bob and Alice
    const legendText = await pageBob.locator('#gitgraph-legend').innerText();
    console.log('[Test] Gitgraph Legend:\n', legendText);
    expect(legendText).toContain('Bob');
    expect(legendText).toContain('Alice');

    // 9. Bob syncs his combined multi-author repository with the appliance
    console.log('[Test] Bob configuring remote and pushing to appliance Git server...');
    await pageBob.locator('#gitgraph-close').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'hidden' });

    await pageBob.locator('#git-remote-url').fill('https://salon.appliances.klitosan.com/git/pingo/routes.git');
    await pageBob.locator('#git-username').fill('pingo');
    await pageBob.locator('#git-token').fill('pingosecret');

    await pageBob.locator('#git-push-btn').click();
    // Wait for the push process to complete (button re-enabled and spinner cleared)
    await expect(pageBob.locator('#git-push-btn')).not.toBeDisabled({ timeout: 15000 });
    await pageBob.waitForTimeout(1000);

    // Reopen Gitgraph to verify Sync Badge is updated
    await pageBob.locator('#view-gitgraph-btn').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'visible' });
    await expect(pageBob.locator('#gitgraph-sync-badge')).toBeVisible();

    // The badge updates asynchronously when getAllCommitsGraph finishes
    await expect(pageBob.locator('#gitgraph-sync-badge')).toContainText('Sincronizado', { timeout: 10000 });
    const badgeText = await pageBob.locator('#gitgraph-sync-badge').innerText();
    console.log(`[Test] Bob Sync Badge: "${badgeText}"`);

    // 10. Exercise the "Right to be Forgotten" (Derecho al Olvido / Soft-Delete)
    console.log('[Test] Bob exercises Right to be Forgotten on Alice...');
    // Bob clicks on Alice's badge in the Gitgraph legend to forget her
    const aliceBadge = pageBob.locator('.gitgraph-author-badge[data-author="Alice"]');
    await expect(aliceBadge).toBeVisible();
    await aliceBadge.click();
    await pageBob.waitForTimeout(500);

    // Verify via UI: In Workspace, Alice's route is now hidden/filtered out by the blocklist
    await pageBob.locator('#gitgraph-close').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'hidden' });

    // Since Alice is forgotten, only Bob's note should be visible (count = 1)
    await expect(pageBob.locator('.route-card')).toHaveCount(1, { timeout: 5000 });
    console.log('[Test] Confirmed: Alice route is hidden from Workspace after applying right to be forgotten!');

    // Reopen Gitgraph to verify that commits can be toggled with "Mostrar olvidados"
    await pageBob.locator('#view-gitgraph-btn').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'visible' });

    const showBlockedCheckbox = pageBob.locator('#gitgraph-show-blocked');
    await expect(showBlockedCheckbox).toBeVisible();

    // Check with "Mostrar olvidados" checked
    await showBlockedCheckbox.check();
    await pageBob.waitForTimeout(500);

    // Alice appears again in legend marked as Olvidad@
    const legendWithBlocked = await pageBob.locator('#gitgraph-legend').innerText();
    console.log('[Test] Legend with show blocked:', legendWithBlocked);
    expect(legendWithBlocked).toContain('Alice');
    expect(legendWithBlocked).toContain('Olvidad@');

    // Click again on Alice's badge to unblock her
    const aliceBlockedBadge = pageBob.locator('.gitgraph-author-badge[data-author="Alice"]');
    await expect(aliceBlockedBadge).toBeVisible();
    await aliceBlockedBadge.click();
    await pageBob.waitForTimeout(500);

    await pageBob.locator('#gitgraph-close').click();
    await pageBob.waitForSelector('#gitgraph-modal', { state: 'hidden' });

    // Both routes should be visible again in Workspace
    await expect(pageBob.locator('.route-card')).toHaveCount(2, { timeout: 5000 });
    console.log('[Test] Confirmed: Alice route restored successfully after unblocking!');

    console.log('[Test] Multi-user P2P Git E2E test completed successfully!');
  });
});
