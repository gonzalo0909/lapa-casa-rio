// lapa-casa-hostel/backend/src/services/audit-log-service.ts
// ventana4 (bloque 2): agrega listAll() -- panel admin, filtros por fecha/entidad/operación en vez de por entidad puntual

import { PoolClient } from 'pg';
import { pool } from '../config/database';

export interface AuditLogEntry {
  entity_type: string;
  entity_id: string;
  operation: string;
  guest_id?: string;
  reservation_id?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

export class AuditLogService {
  async log(entry: AuditLogEntry, client?: PoolClient): Promise<void> {
    try {
      const db = client || pool;
      await db.query(
        `INSERT INTO audit_logs (
          entity_type, entity_id, operation,
          guest_id, reservation_id,
          old_data, new_data,
          user_id, ip_address, user_agent
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          entry.entity_type, entry.entity_id, entry.operation,
          entry.guest_id || null, entry.reservation_id || null,
          entry.old_data ? JSON.stringify(entry.old_data) : null,
          entry.new_data ? JSON.stringify(entry.new_data) : null,
          entry.user_id || null, entry.ip_address || null, entry.user_agent || null
        ]
      );
    } catch (error) {
      console.error('Failed to write audit log entry', { entry, error });
    }
  }

  async getHistory(entityType: string, entityId: string): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT id, operation, user_id, old_data, new_data, created_at
       FROM audit_logs
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
    return rows;
  }

  async listAll(filters: {
    entityType?: string;
    operation?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = filters.page && filters.page > 0 ? filters.page : 1;
    const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 200) : 50;

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.entityType) { params.push(filters.entityType); conditions.push(`entity_type = $${params.length}`); }
    if (filters.operation) { params.push(filters.operation); conditions.push(`operation = $${params.length}`); }
    if (filters.dateFrom) { params.push(filters.dateFrom); conditions.push(`created_at >= $${params.length}::date`); }
    if (filters.dateTo) { params.push(filters.dateTo); conditions.push(`created_at < ($${params.length}::date + interval '1 day')`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, entity_type, entity_id, operation, guest_id, reservation_id, old_data, new_data, user_id, created_at
         FROM audit_logs ${where}
         ORDER BY created_at DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM audit_logs ${where}`, params)
    ]);

    return { data: dataResult.rows, total: countResult.rows[0].total, page, limit };
  }
}

export const auditLogService = new AuditLogService();
