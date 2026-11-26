import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../../db/index.ts';
import { auditLogs } from '../../../db/schema.ts';
import type { ListAuditLogsQuery } from './audit.schema.ts';
import type { AuditLogInput, AuditLogItem } from './audit.types.ts';

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : null,
      details: input.details ?? null,
      ipAddress: input.ipAddress ?? null,
    });
  } catch (error) {
    console.error('Failed to persist audit log:', error);
    throw new Error('Échec de l’enregistrement du journal d’audit.', { cause: error });
  }
}

export async function findAuditLogs(
  query: ListAuditLogsQuery
): Promise<{ items: AuditLogItem[]; total: number }> {
  try {
    const conditions = [];
    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.entityType) {
      conditions.push(eq(auditLogs.entityType, query.entityType));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(auditLogs.actorEmail, pattern),
          ilike(auditLogs.action, pattern),
          ilike(auditLogs.entityType, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(auditLogs).where(whereClause),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorUserId: r.actorUserId,
        actorEmail: r.actorEmail,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        details: (r.details as Record<string, unknown> | null) ?? null,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
      })),
      total: Number(countResult[0]?.value ?? 0),
    };
  } catch (error) {
    console.error('Database query failed in findAuditLogs:', error);
    throw new Error('Erreur lors de la lecture du journal d’audit.', { cause: error });
  }
}
