// lapa-casa-hostel/tests/frontend/booking-flow.spec.ts

import { test, expect } from '@playwright/test';

/**
 * @fileoverview End-to-end tests for complete booking flow
 * Tests user journey from date selection to payment confirmation
 */

test.describe('Complete Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('successful booking with credit card', async ({ page }) => {
    // Step 1: Select dates
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Verificando disponibilidade')).toBeVisible();
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Step 2: Select room and beds
    const room = page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 12A' });
    await room.locator('[aria-label="Número de camas"]').fill('8');
    
    await expect(page.locator('text=R$ 1.382,40')).toBeVisible();
    await expect(page.locator('text=Desconto grupo: 10%')).toBeVisible();

    await page.click('text=Continuar');

    // Step 3: Fill guest information
    await page.fill('[aria-label="Nome completo"]', 'João Silva');
    await page.fill('[aria-label="Email"]', 'joao.silva@example.com');
    await page.fill('[aria-label="Telefone"]', '+5521999999999');
    await page.selectOption('[aria-label="País"]', 'BR');

    await page.click('text=Continuar para pagamento');

    // Step 4: Payment
    await expect(page.locator('text=Depósito (30%)')).toBeVisible();
    await expect(page.locator('text=R$ 414,72')).toBeVisible();

    await page.click('[aria-label="Cartão de crédito"]');

    // Fill Stripe card details
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]');
    await stripeFrame.locator('[placeholder="Card number"]').fill('4242424242424242');
    await stripeFrame.locator('[placeholder="MM / YY"]').fill('12/28');
    await stripeFrame.locator('[placeholder="CVC"]').fill('123');

    await page.click('text=Pagar depósito');

    // Step 5: Confirmation
    await expect(page.locator('text=Reserva confirmada')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Booking ID:')).toBeVisible();
    await expect(page.locator('text=joao.silva@example.com')).toBeVisible();
  });

  test('successful booking with PIX', async ({ page }) => {
    // Select dates
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Select room
    const room = page.locator('[data-testid="room-card"]').first();
    await room.locator('[aria-label="Número de camas"]').fill('5');
    await page.click('text=Continuar');

    // Guest info
    await page.fill('[aria-label="Nome completo"]', 'Maria Santos');
    await page.fill('[aria-label="Email"]', 'maria@example.com');
    await page.fill('[aria-label="Telefone"]', '+5521988888888');
    await page.click('text=Continuar para pagamento');

    // Select PIX
    await page.click('[aria-label="PIX"]');
    await page.click('text=Gerar código PIX');

    // Verify QR code displayed
    await expect(page.locator('[alt="QR Code PIX"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Copiar código')).toBeVisible();
    await expect(page.locator('text=Expira em:')).toBeVisible();

    // Copy PIX code
    await page.click('text=Copiar código');
    await expect(page.locator('text=Código copiado')).toBeVisible();
  });

  test('booking with group discount applied', async ({ page }) => {
    await page.fill('[aria-label="Data de entrada"]', '2025-06-01');
    await page.fill('[aria-label="Data de saída"]', '2025-06-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Select multiple rooms for 26+ beds
    await page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 12A' })
      .locator('[aria-label="Número de camas"]').fill('12');
    
    await page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 12B' })
      .locator('[aria-label="Número de camas"]').fill('12');
    
    await page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 7' })
      .locator('[aria-label="Número de camas"]').fill('7');

    // Verify 20% discount
    await expect(page.locator('text=Desconto grupo: 20%')).toBeVisible();
    await expect(page.locator('text=31 camas')).toBeVisible();
  });

  test('carnival booking with minimum nights validation', async ({ page }) => {
    await page.fill('[aria-label="Data de entrada"]', '2026-02-14');
    await page.fill('[aria-label="Data de saída"]', '2026-02-16');

    await expect(page.locator('text=Mínimo 5 noites no Carnaval')).toBeVisible();

    // Fix by extending dates
    await page.fill('[aria-label="Data de saída"]', '2026-02-19');

    await expect(page.locator('text=Temporada: Carnaval')).toBeVisible();
    await expect(page.locator('text=+100%')).toBeVisible();
  });

  test('flexible room converts to mixed', async ({ page }) => {
    // Book less than 48h before with flexible room
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkIn = tomorrow.toISOString().split('T')[0];
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 3);
    const checkOut = dayAfter.toISOString().split('T')[0];

    await page.fill('[aria-label="Data de entrada"]', checkIn);
    await page.fill('[aria-label="Data de saída"]', checkOut);

    await expect(page.locator('text=Flexible 7')).toBeVisible({ timeout: 10000 });

    const flexibleRoom = page.locator('[data-testid="room-card"]').filter({ hasText: 'Flexible 7' });
    
    // Should show conversion notice
    await expect(flexibleRoom.locator('text=Convertido para misto')).toBeVisible();
  });

  test('back navigation preserves data', async ({ page }) => {
    // Step 1: Dates
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Step 2: Rooms
    await page.locator('[data-testid="room-card"]').first()
      .locator('[aria-label="Número de camas"]').fill('10');
    await page.click('text=Continuar');

    // Step 3: Guest
    await page.fill('[aria-label="Nome completo"]', 'Test User');
    await page.fill('[aria-label="Email"]', 'test@example.com');
    
    // Go back
    await page.click('text=Voltar');

    // Verify room selection preserved
    const bedsInput = page.locator('[data-testid="room-card"]').first()
      .locator('[aria-label="Número de camas"]');
    await expect(bedsInput).toHaveValue('10');

    // Go back again
    await page.click('text=Voltar');

    // Verify dates preserved
    await expect(page.locator('[aria-label="Data de entrada"]')).toHaveValue('2025-07-01');
    await expect(page.locator('[aria-label="Data de saída"]')).toHaveValue('2025-07-05');
  });

  test('validation errors prevent progression', async ({ page }) => {
    // Try to continue without selecting dates
    await page.click('text=Continuar');
    
    await expect(page.locator('text=Selecione as datas')).toBeVisible();

    // Select dates
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Try to continue without selecting room
    await page.click('text=Continuar');
    
    await expect(page.locator('text=Selecione pelo menos um quarto')).toBeVisible();

    // Select room
    await page.locator('[data-testid="room-card"]').first()
      .locator('[aria-label="Número de camas"]').fill('5');
    await page.click('text=Continuar');

    // Try to continue without guest info
    await page.click('text=Continuar para pagamento');

    await expect(page.locator('text=Nome é obrigatório')).toBeVisible();
    await expect(page.locator('text=Email é obrigatório')).toBeVisible();
  });

  test('mobile responsive layout', async ({ page, viewport }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    
    // Calendar should be in mobile view
    const calendar = page.locator('[role="dialog"]');
    await expect(calendar).toHaveClass(/mobile-calendar/);

    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Room cards should stack vertically
    const rooms = page.locator('[data-testid="room-card"]');
    const count = await rooms.count();
    
    for (let i = 0; i < count; i++) {
      const room = rooms.nth(i);
      await expect(room).toBeVisible();
    }
  });

  test('handles no availability scenario', async ({ page }) => {
    // Mock fully booked dates
    await page.route('**/api/availability/check', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ available: false, rooms: [] })
      });
    });

    await page.fill('[aria-label="Data de entrada"]', '2025-12-25');
    await page.fill('[aria-label="Data de saída"]', '2025-12-30');

    await expect(page.locator('text=Não há quartos disponíveis')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Tente outras datas')).toBeVisible();
  });

  test('payment method switching', async ({ page }) => {
    // Complete steps to payment
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="room-card"]').first()
      .locator('[aria-label="Número de camas"]').fill('5');
    await page.click('text=Continuar');

    await page.fill('[aria-label="Nome completo"]', 'Test User');
    await page.fill('[aria-label="Email"]', 'test@example.com');
    await page.fill('[aria-label="Telefone"]', '+5521999999999');
    await page.click('text=Continuar para pagamento');

    // Switch between payment methods
    await page.click('[aria-label="Cartão de crédito"]');
    await expect(page.locator('text=Dados do cartão')).toBeVisible();

    await page.click('[aria-label="PIX"]');
    await expect(page.locator('text=QR Code será gerado')).toBeVisible();

    await page.click('[aria-label="Mercado Pago"]');
    await expect(page.locator('[data-testid="mp-card-form"]')).toBeVisible();
  });

  test('large group booking (50% deposit)', async ({ page }) => {
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    // Book 20+ beds for 50% deposit
    await page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 12A' })
      .locator('[aria-label="Número de camas"]').fill('12');
    await page.locator('[data-testid="room-card"]').filter({ hasText: 'Mixto 12B' })
      .locator('[aria-label="Número de camas"]').fill('10');

    await page.click('text=Continuar');

    await page.fill('[aria-label="Nome completo"]', 'Group Leader');
    await page.fill('[aria-label="Email"]', 'group@example.com');
    await page.fill('[aria-label="Telefone"]', '+5521999999999');
    await page.click('text=Continuar para pagamento');

    // Verify 50% deposit
    await expect(page.locator('text=Depósito (50%)')).toBeVisible();
  });

  test('seasonal pricing display', async ({ page }) => {
    // High season
    await page.fill('[aria-label="Data de entrada"]', '2025-12-20');
    await page.fill('[aria-label="Data de saída"]', '2025-12-25');
    
    await expect(page.locator('text=Temporada alta +50%')).toBeVisible();

    // Medium season
    await page.fill('[aria-label="Data de entrada"]', '2025-04-10');
    await page.fill('[aria-label="Data de saída"]', '2025-04-15');
    
    await expect(page.locator('text=Temporada média')).toBeVisible();

    // Low season
    await page.fill('[aria-label="Data de entrada"]', '2025-07-10');
    await page.fill('[aria-label="Data de saída"]', '2025-07-15');
    
    await expect(page.locator('text=Temporada baixa -20%')).toBeVisible();
  });

  test('special requests field', async ({ page }) => {
    await page.fill('[aria-label="Data de entrada"]', '2025-07-01');
    await page.fill('[aria-label="Data de saída"]', '2025-07-05');
    
    await expect(page.locator('text=Mixto 12A')).toBeVisible({ timeout: 10000 });

    await page.locator('[data-testid="room-card"]').first()
      .locator('[aria-label="Número de camas"]').fill('5');
    await page.click('text=Continuar');

    await page.fill('[aria-label="Nome completo"]', 'Test User');
    await page.fill('[aria-label="Email"]', 'test@example.com');
    await page.fill('[aria-label="Telefone"]', '+5521999999999');

    // Add special request
    await page.fill('[aria-label="Pedidos especiais"]', 'Late check-in requested at 11 PM');

    await page.click('text=Continuar para pagamento');

    // Verify in summary
    await expect(page.locator('text=Late check-in requested')).toBeVisible();
  });
});
