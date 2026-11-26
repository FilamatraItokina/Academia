export interface AuditLogInput {
  actorUserId?: number | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditLogItem {
  id: number;
  actorUserId: number | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}
