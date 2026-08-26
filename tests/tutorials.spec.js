import { test, expect, chromium } from '@playwright/test';
import path from 'path';

/**
 * Script automatizado de grabación de videotutoriales para Pingo
 * Graba en vídeo Full HD (1920x1080) la ejecución de los tours interactivos y funcionalidades.
 */

test.describe('Grabación Automatizada de Videotutoriales Pingo', () => {
    let browser;
    let context;
    let page;

    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true,
            args: ['--window-size=1920,1080', '--no-sandbox']
        });
    });

    test.afterAll(async () => {
        if (browser) await browser.close();
    });

    test.beforeEach(async () => {
        context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            recordVideo: {
                dir: path.resolve('docs/tutorials/videos/'),
                size: { width: 1920, height: 1080 }
            },
            permissions: ['geolocation', 'notifications'],
            ignoreHTTPSErrors: true
        });
        await context.setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
        page = await context.newPage();
        await page.goto('https://localhost:5188/');
        await page.waitForSelector('.app-container', { state: 'visible' });
        await page.waitForTimeout(1000);
    });

    test.afterEach(async () => {
        if (context) await context.close();
    });

    test('Episodio 01: Identidad Criptográfica y Agenda Privada', async () => {
        test.setTimeout(90000);
        await page.click('#nav-network-btn');
        await page.waitForTimeout(1000);

        // Iniciar tour interactivo de identidad
        await page.click('#start-tour-identity-btn');
        await page.waitForTimeout(1500);

        // Avanzar por los 8 pasos pausando para visualización
        for (let i = 1; i <= 8; i++) {
            await page.waitForTimeout(2000);
            await page.click('#tour-next-btn');
        }

        await page.waitForTimeout(2000);
    });

    test('Episodio 02: Mapa en Vivo, Geovallas y Persistencia', async () => {
        test.setTimeout(90000);
        await page.click('#nav-network-btn');
        await page.waitForTimeout(1000);

        // Iniciar tour de geovallas
        await page.click('#start-tour-geofence-btn');
        await page.waitForTimeout(1500);

        for (let i = 1; i <= 6; i++) {
            await page.waitForTimeout(2000);
            await page.click('#tour-next-btn');
        }

        await page.waitForTimeout(2000);
    });

    test('Episodio 03: Workspace Cartográfico y Control de Versiones Git', async () => {
        test.setTimeout(90000);
        await page.click('#nav-network-btn');
        await page.waitForTimeout(1000);

        // Iniciar tour de rutas y Git
        await page.click('#start-tour-routes-btn');
        await page.waitForTimeout(1500);

        for (let i = 1; i <= 6; i++) {
            await page.waitForTimeout(2000);
            await page.click('#tour-next-btn');
        }

        await page.waitForTimeout(2000);
    });

    test('Episodio 04: Comunicación Mesh, Streaming P2P e IA Local', async () => {
        test.setTimeout(90000);
        await page.click('#nav-network-btn');
        await page.waitForTimeout(1000);

        // Iniciar tour de comunicación
        await page.click('#start-tour-comm-btn');
        await page.waitForTimeout(1500);

        for (let i = 1; i <= 7; i++) {
            await page.waitForTimeout(2000);
            await page.click('#tour-next-btn');
        }

        await page.waitForTimeout(2000);
    });

    test('Episodio 05: Servidor Autónomo y Gestión de Nodos', async () => {
        test.setTimeout(90000);
        await page.click('#nav-network-btn');
        await page.waitForTimeout(1000);

        // Iniciar tour de servidores y relé
        await page.click('#start-tour-servers-btn');
        await page.waitForTimeout(1500);

        for (let i = 1; i <= 8; i++) {
            await page.waitForTimeout(2000);
            await page.click('#tour-next-btn');
        }

        await page.waitForTimeout(2000);
    });
});
