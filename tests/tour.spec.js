import { test, expect } from '@playwright/test';

test.describe('Pingo Interactive Demo Tours - All Use Cases', () => {
    test.beforeEach(async ({ page }) => {
        await page.context().grantPermissions(['geolocation']);
        await page.context().setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
        await page.goto('/');
        await page.waitForSelector('.app-container', { state: 'visible' });
        await page.waitForTimeout(1000);
        await page.click('#nav-network-btn');
    });

    test('1. Demo Identidad y Agenda: avanza y completa los 8 pasos', async ({ page }) => {
        await page.click('#start-tour-identity-btn');

        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 8');

        for (let i = 2; i <= 8; i++) {
            await page.click('#tour-next-btn');
            await page.waitForTimeout(200);
            await expect(page.locator('#tour-step-badge')).toHaveText(`Paso ${i} de 8`);
        }

        await expect(page.locator('#tour-next-btn')).toContainText('¡Entendido!');
        await page.click('#tour-next-btn');
        await page.waitForTimeout(300);
        await expect(page.locator('#pingo-tour-container')).not.toHaveClass(/tour-active/);
    });

    test('2. Demo Rutas & Git: cambia a Workspace y completa los 6 pasos', async ({ page }) => {
        await page.click('#start-tour-routes-btn');

        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 6');
        await expect(page.locator('#workspace-editor')).toBeVisible();

        for (let i = 2; i <= 6; i++) {
            await page.click('#tour-next-btn');
            await page.waitForTimeout(200);
            await expect(page.locator('#tour-step-badge')).toHaveText(`Paso ${i} de 6`);
        }

        await page.click('#tour-next-btn');
        await page.waitForTimeout(300);
        await expect(page.locator('#pingo-tour-container')).not.toHaveClass(/tour-active/);
    });

    test('3. Demo Geovallas: cambia a Localización y completa los 6 pasos', async ({ page }) => {
        await page.click('#start-tour-geofence-btn');

        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 6');
        await expect(page.locator('#workspace-location')).toBeVisible();

        for (let i = 2; i <= 6; i++) {
            await page.click('#tour-next-btn');
            await page.waitForTimeout(200);
            await expect(page.locator('#tour-step-badge')).toHaveText(`Paso ${i} de 6`);
        }

        await page.click('#tour-next-btn');
        await page.waitForTimeout(300);
        await expect(page.locator('#pingo-tour-container')).not.toHaveClass(/tour-active/);
    });

    test('4. Demo Chat & IA: cambia a Comunicación y completa los 7 pasos', async ({ page }) => {
        await page.click('#start-tour-comm-btn');

        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 7');
        await expect(page.locator('#workspace-comm')).toBeVisible();

        for (let i = 2; i <= 7; i++) {
            await page.click('#tour-next-btn');
            await page.waitForTimeout(200);
            await expect(page.locator('#tour-step-badge')).toHaveText(`Paso ${i} de 7`);
        }

        await page.click('#tour-next-btn');
        await page.waitForTimeout(300);
        await expect(page.locator('#pingo-tour-container')).not.toHaveClass(/tour-active/);
    });

    test('5. Demo Servidores & Relé: abre Ajustes, Modal de Servidores y completa los 8 pasos', async ({ page }) => {
        await page.click('#start-tour-servers-btn');

        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 8');
        await expect(page.locator('#workspace-location')).toBeVisible();

        for (let i = 2; i <= 8; i++) {
            await page.click('#tour-next-btn');
            await page.waitForTimeout(200);
            await expect(page.locator('#tour-step-badge')).toHaveText(`Paso ${i} de 8`);
        }

        await page.click('#tour-next-btn');
        await page.waitForTimeout(300);
        await expect(page.locator('#pingo-tour-container')).not.toHaveClass(/tour-active/);
    });

    test('6. Interacción con la zona destacada: al pulsar en el elemento o spotlight avanza el tour', async ({ page }) => {
        await page.click('#start-tour-identity-btn');
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 1 de 8');

        // Pulsar directamente sobre la zona destacada (spotlight)
        await page.click('#tour-spotlight');
        await page.waitForTimeout(300);

        // Debe haber avanzado al Paso 2 sin cerrar el tour
        await expect(page.locator('#pingo-tour-container')).toHaveClass(/tour-active/);
        await expect(page.locator('#tour-step-badge')).toHaveText('Paso 2 de 8');
    });
});
