import { test, expect } from '@playwright/test';

test.describe('Gitgraph E2E Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Mock geolocation to prevent map issues
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
        await page.goto('/');
        
        // Wait for app to be ready
        await page.waitForSelector('.app-container', { state: 'visible' });
        await page.waitForTimeout(1000); // Give time for internal initializations (IndexedDB/Git)
    });

    test('Should generate commits and visualize them in Gitgraph', async ({ page }) => {
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
        
        // Setup generic dialog handler
        page.on('dialog', async dialog => {
            console.log('DIALOG OPENED:', dialog.message(), dialog.type());
            if (dialog.type() === 'prompt') {
                // Pass a generic title if we just clicked create note
                // Or maybe we should rely on page.once before clicking
            } else {
                await dialog.accept();
            }
        });

        // Go to Workspace & Git
        await page.click('#nav-workspace-btn');
        await page.waitForSelector('#workspace-editor', { state: 'visible' });

        // Helper function to create a note
        const createNote = async (title, content) => {
            // override the generic prompt for this specific call
            const dialogHandler = async dialog => {
                if (dialog.type() === 'prompt') {
                    await dialog.accept(title);
                }
            };
            page.once('dialog', dialogHandler);
            
            // Click create note
            await page.click('#create-note-btn');
            
            // Wait for editor to appear
            await page.waitForSelector('#text-editor-container', { state: 'visible' });
            
            // Fill content
            await page.fill('#text-editor-textarea', content);
            
            // Save the note (this triggers a commit)
            await page.click('#save-editor-btn');
            
            // Wait for it to be saved (the editor container should hide)
            await page.waitForSelector('#text-editor-container', { state: 'hidden' });
        };

        // 1. Create first note
        await createNote('Nota Inicial', 'Este es el primer commit de nuestro grafo');
        
        // 2. Create second note
        await createNote('Segunda Idea', 'Añadiendo más complejidad al repositorio');
        
        // 3. Create third note
        await createNote('Nota Final', 'El último commit antes de verificar');

        // Verify that the routes container shows our 3 notes
        await expect(page.locator('.route-card')).toHaveCount(3);

        // Open Gitgraph modal
        await page.click('#view-gitgraph-btn');
        await page.waitForSelector('#gitgraph-modal', { state: 'visible' });
        
        // Wait for Gitgraph SVG to render
        const svgElement = page.locator('#gitgraph-container svg');
        await svgElement.waitFor({ state: 'visible' });
        await page.waitForTimeout(1000); // Wait for the animation to draw the paths

        // Visual snapshot to document and validate it
        await expect(page.locator('#gitgraph-modal .modal-content')).toHaveScreenshot('gitgraph-with-history.png', { maxDiffPixelRatio: 0.15 });
    });
});
