// lapa-casa-hostel/backend/src/database/repositories/guest-repository.ts

import { query } from '../../config/database';
import type { Guest } from '../../types/database';

export class GuestRepository {
  async create(data: {
    full_name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
  }): Promise<Guest> {
    const result = await query<Guest>(
      `INSERT INTO guests (full_name, email, phone, country, language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.full_name, data.email, data.phone ?? null,
       data.country ?? null, data.language ?? null]
    );
    return result.rows[0];
  }

  async upsert(data: {
    full_name: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    language?: string | null;
  }): Promise<Guest> {
    const result = await query<Guest>(
      `INSERT INTO guests (full_name, email, phone, country, language)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
         full_name  = EXCLUDED.full_name,
         phone      = COALESCE(EXCLUDED.phone, guests.phone),
         country    = COALESCE(EXCLUDED.country, guests.country),
         language   = COALESCE(EXCLUDED.language, guests.language),
         updated_at = NOW()
       RETURNING *`,
      [data.full_name, data.email, data.phone ?? null,
       data.country ?? null, data.language ?? null]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Guest | null> {
    const result = await query<Guest>(
      `SELECT * FROM guests WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByEmail(email: string): Promise<Guest | null> {
    const result = await query<Guest>(
      `SELECT * FROM guests WHERE email = $1`,
      [email]
    );
    return result.rows[0] ?? null;
  }

  async findByPhone(phone: string): Promise<Guest | null> {
    const result = await query<Guest>(
      `SELECT * FROM guests WHERE phone = $1 LIMIT 1`,
      [phone]
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, data: Partial<{
    full_name: string;
    phone: string;
    country: string;
    language: string;
  }>): Promise<Guest> {
    const fields = Object.keys(data);
    if (fields.length === 0) {
      const g = await this.findById(id);
      if (!g) throw new Error('Guest not found');
      return g;
    }
    const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => (data as any)[f]);
    const result = await query<Guest>(
      `UPDATE guests SET ${sets}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  async updateStats(_id: string): Promise<void> {
    // no-op: guests table has no stats columns
  }

  async search(filters: {
    name?: string;
    email?: string;
    phone?: string;
    nationality?: string;
  }): Promise<Guest[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.name) {
      conditions.push(`full_name ILIKE $${idx}`);
      params.push(`%${filters.name}%`);
      idx++;
    }
    if (filters.email) {
      conditions.push(`email ILIKE $${idx}`);
      params.push(`%${filters.email}%`);
      idx++;
    }
    if (filters.phone) {
      conditions.push(`phone LIKE $${idx}`);
      params.push(`%${filters.phone}%`);
      idx++;
    }
    if (filters.nationality) {
      conditions.push(`country ILIKE $${idx}`);
      params.push(`%${filters.nationality}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query<Guest>(
      `SELECT * FROM guests ${where} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    return result.rows;
  }

  async findAll(limit: number = 50): Promise<Guest[]> {
    const result = await query<Guest>(
      `SELECT * FROM guests ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async findTop(limit: number = 10): Promise<Guest[]> {
    const result = await query<Guest>(
      `SELECT g.* FROM guests g
       WHERE EXISTS (
         SELECT 1 FROM reservations WHERE guest_id = g.id
           AND status IN ('confirmed','completed')
       )
       ORDER BY (
         SELECT COUNT(*) FROM reservations WHERE guest_id = g.id
       ) DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async findRecent(limit: number = 20): Promise<Guest[]> {
    const result = await query<Guest>(
      `SELECT * FROM guests ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async findInactive(months: number = 12): Promise<Guest[]> {
    const result = await query<Guest>(
      `SELECT g.* FROM guests g
       WHERE NOT EXISTS (
         SELECT 1 FROM reservations
         WHERE guest_id = g.id
           AND created_at >= NOW() - ($1 || ' months')::interval
       )
       ORDER BY g.created_at ASC`,
      [months]
    );
    return result.rows;
  }

  async countByNationality(): Promise<Array<{ nationality: string; count: number }>> {
    const result = await query<{ nationality: string; count: string }>(
      `SELECT country AS nationality, COUNT(*)::int AS count
       FROM guests
       WHERE country IS NOT NULL
       GROUP BY country
       ORDER BY count DESC`
    );
    return result.rows.map(r => ({ nationality: r.nationality, count: parseInt(r.count, 10) }));
  }

  async getStatistics(): Promise<{
    totalGuests: number;
    returningGuests: number;
    topNationalities: Array<{ nationality: string; count: number }>;
  }> {
    const [totals, nats] = await Promise.all([
      query<{ total: string; returning: string }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE (SELECT COUNT(*) FROM reservations WHERE guest_id = g.id) > 1
                )::int AS returning
         FROM guests g`
      ),
      this.countByNationality(),
    ]);
    return {
      totalGuests: parseInt(totals.rows[0].total, 10),
      returningGuests: parseInt(totals.rows[0].returning, 10),
      topNationalities: nats.slice(0, 5),
    };
  }

  async delete(id: string): Promise<void> {
    const reservations = await query(
      `SELECT id FROM reservations WHERE guest_id = $1 LIMIT 1`,
      [id]
    );
    if (reservations.rows.length > 0) {
      throw new Error('Cannot delete guest with existing reservations');
    }
    await query(`DELETE FROM guests WHERE id = $1`, [id]);
  }

  async merge(primaryId: string, duplicateId: string): Promise<Guest> {
    await query(
      `UPDATE reservations SET guest_id = $1 WHERE guest_id = $2`,
      [primaryId, duplicateId]
    );
    await query(`DELETE FROM guests WHERE id = $1`, [duplicateId]);
    const g = await this.findById(primaryId);
    if (!g) throw new Error('Guest not found after merge');
    return g;
  }
}

export default new GuestRepository();
