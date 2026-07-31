// lapa-casa-hostel/backend/src/services/audit-log-service.ts

import { PrismaClient } from '@prisma/client';

/**
 * AuditLogService - Writes to the audit_logs table.
 *
 * The table already existed in the schema with no writer. Any caller
 * that changes something worth tracing (price overrides, room type
 * conversions, cancellations, manual admin edits) should call `log()`
 * with the before/after values -- this is intentionally a thin,
 * fire-and-forget-safe wrapper, not a business-logic layer.
 */

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
  constructor(private prisma: PrismaClient) {}

  /**
   * Records a single audit event. Never throws: a failure to write an
   * audit trail should not block the operation being audited.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          userId: entry.userId,
          userEmail: entry.userEmail,
          oldValues: entry.oldValues ?? undefined,
          newValues: entry.newValues ?? undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent
        }
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to write audit log entry', { entry, error });
    }
  }

  /**
   * Retrieves the audit history for a single entity, most recent first.
   */
  async getHistory(entityType: string, entityId: string): Promise<
    Array<{
      id: string;
      action: string;
      userEmail: string | null;
      oldValues: unknown;
      newValues: unknown;
      createdAt: Date;
    }>
  > {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        userEmail: true,
        oldValues: true,
        newValues: true,
        createdAt: true
      }
    });
  }
}
