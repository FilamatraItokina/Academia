import { buildPaginatedResult, type PaginatedResult } from '../../shared/pagination.ts';
import * as auditRepo from './audit.repository.ts';
import type { ListAuditLogsQuery } from './audit.schema.ts';
import type { AuditLogInput, AuditLogItem } from './audit.types.ts';

export async function recordAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    await auditRepo.createAuditLog(input);
  } catch (err) {
    console.error('Non-blocking audit error:', err);
  }
}

export async function listAuditLogs(
  query: ListAuditLogsQuery
): Promise<PaginatedResult<AuditLogItem>> {
  const { items, total } = await auditRepo.findAuditLogs(query);
  return buildPaginatedResult(items, total, query.page, query.limit);
}
