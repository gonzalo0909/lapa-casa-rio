// lapa-casa-hostel/backend/src/database/models/guest.ts

import { pool } from '../../config/database';
import { Guest } from '../../types/database';

export class GuestModel {
  static async createGuest(data: {
    full_name: string; email: string; phone?: string; nationality?: string;
    language?: string; document_type?: string; document_number?: string;
    newsletter_opt_in?: boolean; notes?: string;
  }): Promise<Guest> {
    const { rows } = await pool.query(
      `INSERT INTO guests (full_name, email, phone, nationality, language, document_type, document_number, newsletter_opt_in, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.full_name, data.email, data.phone||null, data.nationality||null, data.language||null,
       data.document_type||null, data.document_number||null, data.newsletter_opt_in||false, data.notes||null]
    );
    return rows[0];
  }

  static async getGuestById(id: string): Promise<Guest | null> {
    const { rows } = await pool.query(`SELECT * FROM guests WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  static async getGuestByEmail(email: string): Promise<Guest | null> {
    const { rows } = await pool.query(`SELECT * FROM guests WHERE email = $1`, [email]);
    return rows[0] || null;
  }

  static async getGuestByPhone(phone: string): Promise<Guest | null> {
    const { rows } = await pool.query(`SELECT * FROM guests WHERE phone = $1 LIMIT 1`, [phone]);
    return rows[0] || null;
  }

  static async findOrCreateGuest(data: { full_name: string; email: string; phone?: string; nationality?: string; language?: string }): Promise<Guest> {
    const existing = await this.getGuestByEmail(data.email);
    if (existing) return this.updateGuest(existing.id, data);
    return this.createGuest(data);
  }

  static async updateGuest(id: string, data: Partial<Guest>): Promise<Guest> {
    const fields = Object.keys(data).filter(k => k !== 'id');
    const params: any[] = fields.map(k => (data as any)[k]);
    params.push(id);
    const set = fields.map((k, i) => `${k} = $${i+1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE guests SET ${set}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params
    );
    return rows[0];
  }

  static async searchGuests(query: { name?: string; email?: string; phone?: string; nationality?: string }): Promise<Guest[]> {
    const conditions: string[] = [], params: any[] = [];
    if (query.name)        { params.push(`%${query.name}%`);        conditions.push(`full_name ILIKE $${params.length}`); }
    if (query.email)       { params.push(`%${query.email}%`);       conditions.push(`email ILIKE $${params.length}`); }
    if (query.phone)       { params.push(`%${query.phone}%`);       conditions.push(`phone LIKE $${params.length}`); }
    if (query.nationality) { params.push(`%${query.nationality}%`); conditions.push(`nationality ILIKE $${params.length}`); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`SELECT * FROM guests ${where} ORDER BY created_at DESC LIMIT 50`, params);
    return rows;
  }

  static async getRecentGuests(limit = 20): Promise<Guest[]> {
    const { rows } = await pool.query(`SELECT * FROM guests ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows;
  }

  static async getNewsletterSubscribers(): Promise<Guest[]> {
    const { rows } = await pool.query(`SELECT id, full_name, email, language FROM guests WHERE newsletter_opt_in = true`);
    return rows;
  }

  static async updateNewsletterPreference(id: string, optIn: boolean): Promise<Guest> {
    const { rows } = await pool.query(
      `UPDATE guests SET newsletter_opt_in = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [optIn, id]
    );
    return rows[0];
  }

  static async getGuestStats(): Promise<{ totalGuests: number; returningGuests: number; newsletterSubscribers: number }> {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE id IN (SELECT guest_id FROM reservations GROUP BY guest_id HAVING COUNT(*) > 1)) AS returning,
        COUNT(*) FILTER (WHERE newsletter_opt_in = true) AS newsletter
      FROM guests
    `);
    return { totalGuests: Number(rows[0].total), returningGuests: Number(rows[0].returning), newsletterSubscribers: Number(rows[0].newsletter) };
  }

  static async deleteGuest(id: string): Promise<void> {
    const { rows } = await pool.query(`SELECT COUNT(*) FROM reservations WHERE guest_id = $1`, [id]);
    if (Number(rows[0].count) > 0) throw new Error('Cannot delete guest with existing bookings');
    await pool.query(`DELETE FROM guests WHERE id = $1`, [id]);
  }

  static async mergeGuests(primaryId: string, duplicateId: string): Promise<Guest> {
    await pool.query(`UPDATE reservations SET guest_id = $1 WHERE guest_id = $2`, [primaryId, duplicateId]);
    await pool.query(`DELETE FROM guests WHERE id = $1`, [duplicateId]);
    return (await this.getGuestById(primaryId))!;
  }
}

export default GuestModel;
