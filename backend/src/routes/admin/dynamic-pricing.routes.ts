// lapa-casa-hostel/backend/src/routes/admin/dynamic-pricing.routes.ts
// Rutas admin para el bot de precios dinámicos.
// Montadas bajo /admin/dynamic-pricing (requiere authenticateToken).

import { Router } from 'express';
import { dynamicPricingService } from '../../services/dynamic-pricing-service';
import { ApiResponse } from '../../utils/responses';
import { logger } from '../../utils/logger';

const router = Router();

// ── Config ────────────────────────────────────────────────────────────────

// GET  /admin/dynamic-pricing/config
router.get('/config', async (_req, res, next) => {
  try {
    const cfg = await dynamicPricingService.getConfig();
    res.json(ApiResponse.success(cfg, 'Configuración de precios dinámicos'));
  } catch (err) { next(err); }
});

// PUT  /admin/dynamic-pricing/config
router.put('/config', async (req, res, next) => {
  try {
    const updated = await dynamicPricingService.updateConfig(req.body);
    logger.info('DynamicPricing: config actualizada', { updatedFields: Object.keys(req.body) });
    res.json(ApiResponse.success(updated, 'Configuración actualizada'));
  } catch (err) { next(err); }
});

// ── Eventos ───────────────────────────────────────────────────────────────

// GET  /admin/dynamic-pricing/events
router.get('/events', async (_req, res, next) => {
  try {
    const events = await dynamicPricingService.getEvents();
    res.json(ApiResponse.success(events, 'Eventos de precios'));
  } catch (err) { next(err); }
});

// POST /admin/dynamic-pricing/events
router.post('/events', async (req, res, next) => {
  try {
    const { name, date_from, date_to, adjustment_pct, applies_to, is_active, notes } = req.body;
    if (!name || !date_from || !date_to || adjustment_pct == null) {
      res.status(400).json(ApiResponse.error('name, date_from, date_to y adjustment_pct son requeridos'));
      return;
    }
    const event = await dynamicPricingService.createEvent({
      name, date_from, date_to,
      adjustment_pct: Number(adjustment_pct),
      applies_to: applies_to ?? 'all',
      is_active: is_active ?? true,
      notes,
    });
    res.status(201).json(ApiResponse.success(event, 'Evento creado'));
  } catch (err) { next(err); }
});

// PUT  /admin/dynamic-pricing/events/:id
router.put('/events/:id', async (req, res, next) => {
  try {
    const updated = await dynamicPricingService.updateEvent(req.params.id, req.body);
    res.json(ApiResponse.success(updated, 'Evento actualizado'));
  } catch (err) { next(err); }
});

// DELETE /admin/dynamic-pricing/events/:id
router.delete('/events/:id', async (req, res, next) => {
  try {
    await dynamicPricingService.deleteEvent(req.params.id);
    res.json(ApiResponse.success(null, 'Evento eliminado'));
  } catch (err) { next(err); }
});

// ── Bot ───────────────────────────────────────────────────────────────────

// POST /admin/dynamic-pricing/run — ejecutar bot ahora
router.post('/run', async (_req, res, next) => {
  try {
    logger.info('DynamicPricing: ejecución manual iniciada');
    const result = await dynamicPricingService.run();
    res.json(ApiResponse.success(result, `Bot ejecutado: ${result.processed} fechas calculadas`));
  } catch (err) { next(err); }
});

// GET  /admin/dynamic-pricing/calendar — precios calculados
router.get('/calendar', async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? 90);
    const calendar = await dynamicPricingService.getCalendar(days);
    res.json(ApiResponse.success(calendar, 'Calendario de precios'));
  } catch (err) { next(err); }
});

// GET  /admin/dynamic-pricing/rio-events — eventos en Río (Sympla + curated)
router.get('/rio-events', async (_req, res, next) => {
  try {
    const events = await dynamicPricingService.getRioEvents();
    res.json(ApiResponse.success(events, 'Eventos en Río de Janeiro'));
  } catch (err) { next(err); }
});

export const dynamicPricingRouter = router;
