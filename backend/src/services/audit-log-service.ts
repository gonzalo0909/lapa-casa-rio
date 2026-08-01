// lapa-casa-hostel/backend/src/services/audit-log-service.ts

import { query } from '../config/database';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  userId?: string;
  userEmail?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditLogService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs
           (entity_type, entity_id, action, user_id, user_email,
            old_values, new_values, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.entityType,
          entry.entityId,
          entry.action,
          entry.userId ?? null,
          entry.userEmail ?? null,
          entry.oldValues ? JSON.stringify(entry.oldValues) : null,
          entry.newValues ? JSON.stringify(entry.newValues) : null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null
        ]
      );
    } catch (error) {
      console.error('Failed to write audit log entry', { entry, error });
    }
  }

  async getHistory(
    entityType: string,
    entityId: string
  ): Promise<Array<{
    id: string;
    action: string;
    userEmail: string | null;
    oldValues: unknown;
    newValues: unknown;
    createdAt: Date;
  }>> {
    try {
      const result = await query(
        `SELECT id, action, user_email, old_values, new_values, created_at
         FROM audit_logs
         WHERE entity_type = $1 AND entity_id = $2
         ORDER BY created_at DESC`,
        [entityType, entityId]
      );
      return result.rows.map(r => ({
        id: r.id,
        action: r.action,
        userEmail: r.user_email,
        oldValues: r.old_values,
        newValues: r.new_values,
        createdAt: r.created_at
      }));
    } catch (error) {
      console.error('Failed to read audit log', { entityType, entityId, error });
      return [];
    }
  }
}

export const auditLogService = new AuditLogService();
