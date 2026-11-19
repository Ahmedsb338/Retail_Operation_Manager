import type { AppDatabase } from '../../db/index.ts';
import { auditLog, type AppRole } from '../../db/schema.ts';

export type AuditActorType = 'STORE_MANAGER' | 'AREA_MANAGER' | 'ANONYMOUS' | 'SYSTEM_CLI';

export interface AuditEntryInput {
  actorType: AuditActorType;
  actorRole: AppRole | null;
  actorIdentifier: string;
  branchCode?: string | null;
  action: string;
  domain: string;
  recordId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string;
}

export async function writeAuditLog(db: AppDatabase, entry: AuditEntryInput): Promise<void> {
  await db.insert(auditLog).values({
    actorType: entry.actorType,
    actorRole: entry.actorRole,
    actorIdentifier: entry.actorIdentifier.slice(0, 160),
    branchCode: entry.branchCode ?? null,
    action: entry.action.slice(0, 80),
    domain: entry.domain.slice(0, 80),
    recordId: entry.recordId ? String(entry.recordId).slice(0, 120) : null,
    detailsJson: entry.details ?? null,
    ipAddress: (entry.ipAddress ?? '').slice(0, 120),
  });
}
