import { test, expect } from '@playwright/test';

test.describe('Edición de Contactos desde la Agenda', () => {
  test('Al pulsar en un contacto de la agenda se abre el formulario de edición y actualiza los datos', async ({ page }) => {
    // Precargar agenda con un contacto de prueba
    await page.addInitScript(() => {
      localStorage.setItem('pingo_alias', 'Usuario Prueba');
      localStorage.setItem('pingo_passphrase', 'clavePrueba123');
      localStorage.setItem('pingo_agenda', JSON.stringify([
        {
          alias: 'Contacto Original',
          phrase: 'secretoContacto',
          salt: 'salContacto',
          publicKey: null,
          derivedId: '87654321'
        }
      ]));
    });

    await page.goto('/');

    // Verificar que el contacto aparece en la lista
    const contactCard = page.locator('.contact-card').first();
    await expect(contactCard).toBeVisible();
    await expect(contactCard.locator('.contact-name')).toHaveText('Contacto Original');

    // 1. Pulsar sobre el contacto para editar
    await contactCard.locator('.contact-info').click();

    // 2. Verificar que se despliega el formulario y carga los datos actuales
    const form = page.locator('#add-contact-form');
    await expect(form).toBeVisible();
    await expect(page.locator('#contact-name')).toHaveValue('Contacto Original');
    await expect(page.locator('#contact-phrase')).toHaveValue('secretoContacto');
    await expect(page.locator('#contact-salt')).toHaveValue('salContacto');
    await expect(page.locator('#save-contact-btn')).toHaveText('Actualizar Contacto');

    // 3. Modificar el nombre y guardar
    await page.locator('#contact-name').fill('Contacto Editado');
    await page.locator('#save-contact-btn').click();

    // 4. Verificar que se cierra el formulario y se actualiza el contacto sin duplicarlo
    await expect(form).toBeHidden();
    const cards = page.locator('.contact-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('.contact-name')).toHaveText('Contacto Editado');

    // 5. Verificar persistencia en localStorage
    const savedAgenda = await page.evaluate(() => JSON.parse(localStorage.getItem('pingo_agenda')));
    expect(savedAgenda).toHaveLength(1);
    expect(savedAgenda[0].alias).toBe('Contacto Editado');
    expect(savedAgenda[0].derivedId).toBe('87654321');
  });
});
