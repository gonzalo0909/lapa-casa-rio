// lapa-casa-hostel/backend/src/services/dynamic-pricing-service.ts
//
// Bot de precios dinámicos.
// Corre nightly (cron) o on-demand desde el admin.
// Calcula precio por room_type por día combinando:
//   1. Ocupación de esa unidad
//   2. Proximidad de la fecha
//   3. Día de semana
//   4. Eventos especiales (Carnaval, Rock in Rio, etc.)
// Guarda resultado en price_cache (una fila por room_type por fecha).

import { query } from '../config/database';
import { logger } from '../utils/logger';

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface DynamicPricingConfig {
  id: string;
  occ_tier_low_pct: number;
  occ_tier_mid_pct: number;
  occ_tier_high_pct: number;
  occ_tier_vhigh_pct: number;
  occ_adj_low: number;
  occ_adj_mid: number;
  occ_adj_high: number;
  occ_adj_vhigh: number;
  occ_adj_max: number;
  prox_tier_far: number;
  prox_tier_mid: number;
  prox_tier_near: number;
  prox_tier_close: number;
  prox_adj_far: number;
  prox_adj_mid: number;
  prox_adj_near: number;
  prox_adj_close: number;
  prox_adj_lastmin: number;
  dow_adj_weekday: number;
  dow_adj_weekend: number;
  price_min_brl: number;
  price_max_brl: number;
  horizon_days: number;
}

export interface PricingEvent {
  id: string;
  name: string;
  date_from: string;
  date_to: string;
  adjustment_pct: number;
  applies_to: 'all' | 'hostel' | 'apartment';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UnitConfig {
  id?: string;
  room_type_id: string;
  room_name: string;
  property_type: 'hostel' | 'apartment';
  base_price: number; // de room_types.base_price
  min_price_brl: number | null; // override o null = usar global
  max_price_brl: number | null;
  bot_enabled: boolean;
  notes?: string;
  updated_at?: string;
}

export interface PriceCacheEntry {
  target_date: string;
  room_type_id: string;
  room_name: string;
  property_type: 'hostel' | 'apartment';
  base_price: number;
  final_price: number;
  occ_factor: number;
  prox_factor: number;
  dow_factor: number;
  event_factor: number;
  event_name?: string;
  occupancy_pct?: number;
  calculated_at: string;
}

// ── Servicio ──────────────────────────────────────────────────────────────

class DynamicPricingService {
  // ── Configuración global ───────────────────────────────────────────────

  async getConfig(): Promise<DynamicPricingConfig> {
    const res = await query('SELECT * FROM dynamic_pricing_config LIMIT 1');
    return res.rows[0] as DynamicPricingConfig;
  }

  async updateConfig(data: Partial<DynamicPricingConfig>): Promise<DynamicPricingConfig> {
    const entries = Object.entries(data).filter(([k]) => k !== 'id' && k !== 'updated_at');
    if (!entries.length) {
      return this.getConfig();
    }
    const fields = entries.map(([k], i) => `${k} = $${i + 1}`).join(', ');
    const values = entries.map(([, v]) => v);
    const res = await query(
      `UPDATE dynamic_pricing_config SET ${fields}, updated_at = now() RETURNING *`,
      values,
    );
    return res.rows[0] as DynamicPricingConfig;
  }

  // ── Config por unidad ──────────────────────────────────────────────────

  async getUnitConfigs(): Promise<UnitConfig[]> {
    const res = await query<UnitConfig>(
      `SELECT
         uc.id, rt.id AS room_type_id, rt.name AS room_name, rt.property_type,
         rt.base_price, uc.min_price_brl, uc.max_price_brl,
         uc.bot_enabled, uc.notes, uc.updated_at
       FROM room_types rt
       LEFT JOIN dynamic_pricing_unit_config uc ON uc.room_type_id = rt.id
       ORDER BY rt.property_type, rt.name`,
    );
    // Para unidades sin config aún, rellenar defaults
    return res.rows.map((r) => ({
      ...r,
      bot_enabled: r.bot_enabled ?? true,
      min_price_brl: r.min_price_brl ?? null,
      max_price_brl: r.max_price_brl ?? null,
    }));
  }

  async upsertUnitConfig(
    roomTypeId: string,
    data: {
      min_price_brl?: number | null;
      max_price_brl?: number | null;
      bot_enabled?: boolean;
      notes?: string;
    },
  ): Promise<UnitConfig> {
    await query(
      `INSERT INTO dynamic_pricing_unit_config (room_type_id, min_price_brl, max_price_brl, bot_enabled, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (room_type_id) DO UPDATE SET
         min_price_brl = EXCLUDED.min_price_brl,
         max_price_brl = EXCLUDED.max_price_brl,
         bot_enabled   = EXCLUDED.bot_enabled,
         notes         = EXCLUDED.notes,
         updated_at    = now()`,
      [
        roomTypeId,
        data.min_price_brl ?? null,
        data.max_price_brl ?? null,
        data.bot_enabled ?? true,
        data.notes ?? null,
      ],
    );
    const all = await this.getUnitConfigs();
    return all.find((u) => u.room_type_id === roomTypeId)!;
  }

  // ── Eventos ────────────────────────────────────────────────────────────

  async getEvents(): Promise<PricingEvent[]> {
    const res = await query('SELECT * FROM pricing_events ORDER BY date_from ASC');
    return res.rows as PricingEvent[];
  }

  async createEvent(
    data: Omit<PricingEvent, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<PricingEvent> {
    const res = await query(
      `INSERT INTO pricing_events (name, date_from, date_to, adjustment_pct, applies_to, is_active, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        data.name,
        data.date_from,
        data.date_to,
        data.adjustment_pct,
        data.applies_to ?? 'all',
        data.is_active ?? true,
        data.notes ?? null,
      ],
    );
    return res.rows[0] as PricingEvent;
  }

  async updateEvent(id: string, data: Partial<PricingEvent>): Promise<PricingEvent> {
    const res = await query(
      `UPDATE pricing_events
       SET name=$2, date_from=$3, date_to=$4, adjustment_pct=$5,
           applies_to=$6, is_active=$7, notes=$8, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        id,
        data.name,
        data.date_from,
        data.date_to,
        data.adjustment_pct,
        data.applies_to,
        data.is_active,
        data.notes,
      ],
    );
    return res.rows[0] as PricingEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await query('DELETE FROM pricing_events WHERE id = $1', [id]);
  }

  // ── Caché ──────────────────────────────────────────────────────────────

  async getCalendar(days = 90, roomTypeId?: string): Promise<PriceCacheEntry[]> {
    const args: unknown[] = [days];
    let filter = '';
    if (roomTypeId) {
      args.push(roomTypeId);
      filter = `AND pc.room_type_id = $${args.length}`;
    }

    const res = await query(
      `SELECT pc.*, rt.name AS room_name, rt.property_type
       FROM price_cache pc
       JOIN room_types rt ON rt.id = pc.room_type_id
       WHERE pc.target_date >= CURRENT_DATE
         AND pc.target_date <= CURRENT_DATE + $1::int
         ${filter}
       ORDER BY pc.target_date, rt.property_type, rt.name`,
      args,
    );
    return res.rows as PriceCacheEntry[];
  }

  // ── Lógica del bot ─────────────────────────────────────────────────────

  /** Ocupación (0-100) para una room_type en una fecha */
  private async getOccupancy(date: Date, roomTypeId: string): Promise<number> {
    const dateStr = date.toISOString().slice(0, 10);
    try {
      const res = await query<{ total: string; occupied: string }>(
        `SELECT
           COUNT(b.id)::int AS total,
           COUNT(rb.id) FILTER (WHERE rb.id IS NOT NULL)::int AS occupied
         FROM beds b
         LEFT JOIN reservation_beds rb ON rb.bed_id = b.id
           AND rb.check_in  <= $1::date
           AND rb.check_out >  $1::date
           AND EXISTS (
             SELECT 1 FROM reservations r
             WHERE r.id = rb.reservation_id AND r.status NOT IN ('cancelled')
           )
         WHERE b.room_type_id = $2 AND b.is_active = true`,
        [dateStr, roomTypeId],
      );
      const { total, occupied } = res.rows[0] ?? { total: '0', occupied: '0' };
      const t = parseInt(total, 10);
      const o = parseInt(occupied, 10);
      return t > 0 ? Math.round((o / t) * 100) : 0;
    } catch {
      return 0;
    }
  }

  private occFactor(occPct: number, cfg: DynamicPricingConfig): number {
    let adj: number;
    if (occPct < cfg.occ_tier_low_pct) {
      adj = cfg.occ_adj_low;
    } else if (occPct < cfg.occ_tier_mid_pct) {
      adj = cfg.occ_adj_mid;
    } else if (occPct < cfg.occ_tier_high_pct) {
      adj = cfg.occ_adj_high;
    } else if (occPct < cfg.occ_tier_vhigh_pct) {
      adj = cfg.occ_adj_vhigh;
    } else {
      adj = cfg.occ_adj_max;
    }
    return 1 + adj / 100;
  }

  private proxFactor(daysAhead: number, cfg: DynamicPricingConfig): number {
    let adj: number;
    if (daysAhead > cfg.prox_tier_far) {
      adj = cfg.prox_adj_far;
    } else if (daysAhead > cfg.prox_tier_mid) {
      adj = cfg.prox_adj_mid;
    } else if (daysAhead > cfg.prox_tier_near) {
      adj = cfg.prox_adj_near;
    } else if (daysAhead > cfg.prox_tier_close) {
      adj = cfg.prox_adj_close;
    } else {
      adj = cfg.prox_adj_lastmin;
    }
    return 1 + adj / 100;
  }

  private dowFactor(date: Date, cfg: DynamicPricingConfig): number {
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 5 || dow === 6;
    return 1 + (isWeekend ? cfg.dow_adj_weekend : cfg.dow_adj_weekday) / 100;
  }

  private eventFactor(
    date: Date,
    events: PricingEvent[],
    propertyType: 'hostel' | 'apartment',
  ): { factor: number; name?: string } {
    const dateStr = date.toISOString().slice(0, 10);
    const applicable = events.filter(
      (e) =>
        e.is_active &&
        e.date_from <= dateStr &&
        e.date_to >= dateStr &&
        (e.applies_to === 'all' || e.applies_to === propertyType),
    );
    if (!applicable.length) {
      return { factor: 1 };
    }
    applicable.sort((a, b) => b.adjustment_pct - a.adjustment_pct);
    const top = applicable[0];
    return { factor: 1 + top.adjustment_pct / 100, name: top.name };
  }

  /** Corre el bot: calcula precio por room_type para los próximos N días */
  async run(): Promise<{ processed: number; errors: number }> {
    logger.info('DynamicPricingBot: iniciando cálculo por unidad...');
    const cfg = await this.getConfig();
    const events = await this.getEvents();
    const unitCfgs = await this.getUnitConfigs();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Solo unidades con bot habilitado
    const activeUnits = unitCfgs.filter((u) => u.bot_enabled);

    let processed = 0;
    let errors = 0;

    for (const unit of activeUnits) {
      for (let d = 0; d < cfg.horizon_days; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);

        try {
          const occPct = await this.getOccupancy(date, unit.room_type_id);
          const base = unit.base_price;
          const oFactor = this.occFactor(occPct, cfg);
          const pFactor = this.proxFactor(d, cfg);
          const dFactor = this.dowFactor(date, cfg);
          const { factor: eFactor, name: eName } = this.eventFactor(
            date,
            events,
            unit.property_type,
          );

          // Límites: override de unidad si existen, si no, global
          const minPrice = unit.min_price_brl ?? cfg.price_min_brl;
          const maxPrice = unit.max_price_brl ?? cfg.price_max_brl;

          let final = base * oFactor * pFactor * dFactor * eFactor;
          final = Math.max(minPrice, Math.min(maxPrice, final));
          final = Math.round(final * 2) / 2; // redondea a 0.50 más cercano

          const dateStr = date.toISOString().slice(0, 10);
          await query(
            `INSERT INTO price_cache
               (target_date, room_type_id, property_type, base_price, final_price,
                occ_factor, prox_factor, dow_factor, event_factor, event_name,
                occupancy_pct, calculated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
             ON CONFLICT (target_date, room_type_id)
             DO UPDATE SET
               property_type = EXCLUDED.property_type,
               base_price    = EXCLUDED.base_price,
               final_price   = EXCLUDED.final_price,
               occ_factor    = EXCLUDED.occ_factor,
               prox_factor   = EXCLUDED.prox_factor,
               dow_factor    = EXCLUDED.dow_factor,
               event_factor  = EXCLUDED.event_factor,
               event_name    = EXCLUDED.event_name,
               occupancy_pct = EXCLUDED.occupancy_pct,
               calculated_at = now()`,
            [
              dateStr,
              unit.room_type_id,
              unit.property_type,
              base,
              final,
              oFactor,
              pFactor,
              dFactor,
              eFactor,
              eName ?? null,
              occPct,
            ],
          );
          processed++;
        } catch (err) {
          logger.error('DynamicPricingBot: error', {
            room: unit.room_name,
            date: date.toISOString().slice(0, 10),
            error: err instanceof Error ? err.message : String(err),
          });
          errors++;
        }
      }
    }

    logger.info('DynamicPricingBot: completado', { processed, errors, units: activeUnits.length });
    return { processed, errors };
  }

  // ── Eventos de Río (Sympla + curated fallback) ────────────────────────

  async getRioEvents(): Promise<{ name: string; date: string; venue?: string; url?: string }[]> {
    try {
      const res = await fetch(
        'https://www.sympla.com.br/api/public/v3/events?token=&s=&city=Rio+de+Janeiro&state=RJ&page=1&page_size=20',
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) {
        throw new Error(`Sympla HTTP ${res.status}`);
      }
      const data = (await res.json()) as any;
      return (data?.data ?? []).slice(0, 20).map((e: any) => ({
        name: e.name ?? '',
        date: e.start_date ?? '',
        venue: e.address?.name ?? '',
        url: e.url ?? '',
      }));
    } catch {
      return [
        { name: 'Réveillon Copacabana', date: '2025-12-31', venue: 'Copacabana' },
        { name: 'Carnaval de Rua', date: '2026-02-14', venue: 'Santa Teresa / Lapa' },
        { name: 'Rock in Rio', date: '2026-09-19', venue: 'Cidade do Rock' },
        { name: 'Lollapalooza Brasil', date: '2026-03-27', venue: 'Autódromo de Interlagos' },
        { name: 'Festas Juninas', date: '2026-06-13', venue: 'Várias localizaciones' },
      ];
    }
  }
}

export const dynamicPricingService = new DynamicPricingService();
