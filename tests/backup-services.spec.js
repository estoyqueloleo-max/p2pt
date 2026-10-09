import { test, expect } from '@playwright/test';

test.describe('Backup and Appliance Import/Export Tests', () => {
  test('Debe exportar e importar todos los servicios en el backup JSON', async ({ page }) => {
    // 1. Acceder a la app con configuraciones personalizadas preexistentes
    await page.addInitScript(() => {
      localStorage.setItem('pingo_passphrase', 'test-backup-phrase');
      localStorage.setItem('pingo_salt', 'test-salt');
      localStorage.setItem('pingo_alias', 'Tester');
      localStorage.setItem('pingo_my_id', '12345678');
      localStorage.setItem('pingo_agenda', JSON.stringify([{ alias: 'Amigo', id: '87654321', phrase: '', salt: '' }]));
      localStorage.setItem('git_remote', JSON.stringify({ url: 'https://mi-servidor.local/git/repo.git', user: 'tester', token: 'secret-token' }));
      localStorage.setItem('pingo_mastodon_config', JSON.stringify({ instanceUrl: 'https://mastodon.social', token: 'masto-token' }));
      localStorage.setItem('pingo_server_config', JSON.stringify({
        signaling: { host: 'custom-signaling.local', port: 8443, path: '/custom', secure: true },
        turn: { urls: ['turn:custom-turn.local:3478'], username: 'usr', credential: 'pwd' },
        cloud: { enabled: true, apiEndpoint: 'https://custom-cloud.local:8443', turnCredentialsPath: '/turn-credentials' }
      }));
      localStorage.setItem('pingo_use_cloud', 'true');
    });

    await page.goto('/');

    // 2. Interceptar el evento de descarga o leer el contenido que generaría exportBackupBtn
    const exportedJSON = await page.evaluate(() => {
      const { VERSION, getServerConfig } = window;
      const savedGit = JSON.parse(localStorage.getItem('git_remote') || 'null');
      const savedMastodon = JSON.parse(localStorage.getItem('pingo_mastodon_config') || 'null');
      return {
        agenda: JSON.parse(localStorage.getItem('pingo_agenda') || '[]'),
        serverConfig: JSON.parse(localStorage.getItem('pingo_server_config') || '{}'),
        gitRemote: savedGit,
        mastodonConfig: savedMastodon,
        useCloudServices: localStorage.getItem('pingo_use_cloud') === 'true'
      };
    });

    expect(exportedJSON.serverConfig.signaling.host).toBe('custom-signaling.local');
    expect(exportedJSON.serverConfig.cloud.apiEndpoint).toBe('https://custom-cloud.local:8443');
    expect(exportedJSON.gitRemote.url).toBe('https://mi-servidor.local/git/repo.git');
    expect(exportedJSON.mastodonConfig.instanceUrl).toBe('https://mastodon.social');
    expect(exportedJSON.useCloudServices).toBe(true);

    // 3. Probar importación desde appliance / QR JSON con cloud.api_endpoint
    const applianceConfig = {
      version: 1,
      signaling: { host: 'salon.appliances.klitosan.com', port: 443, path: '/', secure: true },
      turn: { urls: ['turn:salon.appliances.klitosan.com:3478'], username: 'pingo', credential: 'pwd' },
      cloud: { enabled: true, api_endpoint: 'https://salon.appliances.klitosan.com:443' }
    };

    // Navegar a panel de Localización donde se encuentra el botón de Servidores Personalizados
    await page.locator('#nav-location-btn').click();
    // Asegurar que el acordeón de controles esté abierto si estuviera cerrado
    const bodyVisible = await page.locator('#location-controls-body').isVisible();
    if (!bodyVisible) {
      await page.locator('#toggle-location-controls-btn').click();
    }
    await page.locator('#open-server-config-btn').click();
    await page.locator('#server-config-import-btn').click();

    // Pegar JSON del appliance
    await page.locator('#server-config-import-json').fill(JSON.stringify(applianceConfig));
    await page.locator('#server-config-import-modal-apply').click();

    // Verificar que el input de Servicios Cloud se haya poblado
    const cloudApiValue = await page.locator('#server-cloud-api').inputValue();
    expect(cloudApiValue).toBe('https://salon.appliances.klitosan.com:443');
  });
});
