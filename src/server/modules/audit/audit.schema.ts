import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.ts';

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
  search: z.string().trim().max(120).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
