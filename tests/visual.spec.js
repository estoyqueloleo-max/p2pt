import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests - Pingo Workspaces', () => {
    test.beforeEach(async ({ page }) => {
        // Mock geolocation to a fixed point to prevent map changes between tests
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
        
        await page.goto('/');
        
        // Wait for map or basic elements to load
        await page.waitForSelector('.app-container', { state: 'visible' });
        // Small wait to allow Leaflet and icons to render
        await page.waitForTimeout(1500); 
    });

    test('Workspace 1: Network & Identity', async ({ page }) => {
        await page.click('#nav-network-btn');
        await page.waitForSelector('#workspace-network', { state: 'visible' });
        await page.waitForTimeout(500); // UI transition
        await expect(page).toHaveScreenshot('workspace-network.png', { maxDiffPixels: 200 });
    });

    test('Workspace 2: Workspace & Git Editor', async ({ page }) => {
        await page.click('#nav-workspace-btn');
        await page.waitForSelector('#workspace-editor', { state: 'visible' });
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('workspace-editor.png', { maxDiffPixels: 200 });
    });

    test('Workspace 3: Communication & Search', async ({ page }) => {
        await page.click('#nav-comm-btn');
        await page.waitForSelector('#workspace-comm', { state: 'visible' });
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('workspace-comm.png', { maxDiffPixels: 200 });
    });

    test('Workspace 4: Location & Map', async ({ page }) => {
        await page.click('#nav-location-btn');
        await page.waitForSelector('#workspace-location', { state: 'visible' });
        await page.waitForTimeout(500);
        // We mask the map container because map tiles might change slightly
        await expect(page).toHaveScreenshot('workspace-location.png', { 
            mask: [page.locator('#map')],
            maxDiffPixels: 200 
        });
    });

    test('Modal: Gitgraph Visualization', async ({ page }) => {
        await page.click('#nav-workspace-btn');
        await page.waitForSelector('#workspace-editor', { state: 'visible' });
        
        // Open the Gitgraph modal
        await page.click('#view-gitgraph-btn');
        await page.waitForSelector('#gitgraph-modal', { state: 'visible' });
        
        // Wait for the SVG/canvas to be drawn by @gitgraph/js inside the container
        await page.waitForSelector('#gitgraph-container svg, #gitgraph-container p', { state: 'visible' });
        await page.waitForTimeout(500); // Allow animation/render to finish
        
        await expect(page.locator('#gitgraph-modal .modal-content')).toHaveScreenshot('modal-gitgraph.png', { maxDiffPixels: 200 });
    });

    test('Mobile Diagnostics: Workspace 2 (375px)', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.click('#nav-workspace-btn');
        await page.waitForSelector('#workspace-editor', { state: 'visible' });
        await page.waitForTimeout(500);

        const diag = await page.evaluate(() => {
            const vpW = window.innerWidth;
            const docW = document.documentElement.clientWidth;
            const bodyW = document.body.clientWidth;
            const panel = document.getElementById('workspace-editor');
            const main = document.getElementById('main-content');
            const items = [];

            document.querySelectorAll('#workspace-editor *').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.right > docW + 1 || el.scrollWidth > el.clientWidth + 1) {
                    items.push({
                        tag: el.tagName,
                        id: el.id,
                        cls: el.className,
                        right: Math.round(r.right),
                        scrollW: el.scrollWidth,
                        clientW: el.clientWidth,
                        html: el.outerHTML.substring(0, 100)
                    });
                }
            });

            return {
                vpW,
                docW,
                bodyW,
                mainW: main ? main.scrollWidth : null,
                panelScrollW: panel ? panel.scrollWidth : null,
                panelClientW: panel ? panel.clientWidth : null,
                items
            };
        });

        console.log('--- MOBILE DIAGNOSTICS RESULT ---');
        console.log(JSON.stringify(diag, null, 2));
        console.log('---------------------------------');
    });
});
