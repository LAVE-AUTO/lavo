import { db } from '@/lib/db';
import { adminLogs } from '@/lib/db/schema';

type InsertAdminLogParams = {
  admin_id: string;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
};

export async function insertAdminLog(params: InsertAdminLogParams): Promise<void> {
  await db.insert(adminLogs).values({
    admin_id: params.admin_id,
    action: params.action,
    target_type: params.target_type ?? null,
    target_id: params.target_id ?? null,
    details: params.details ?? null,
  });
}
