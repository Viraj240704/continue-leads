import "server-only";
import type { Client } from "./db";

export type AuditEvent =
  | "generated" | "approved" | "rejected" | "scheduled"
  | "published" | "paused" | "rolled_back" | "cost" | "qa" | "plan_created" | "brand_created"
  | "golive_sample_reviewed";

/** Append an immutable audit record (publish_events). Every privileged transition is logged. */
export async function audit(
  c: Client,
  e: {
    tenantId: string;
    brandId?: string | null;
    pageId?: string | null;
    eventType: AuditEvent;
    actorUserId?: string | null;
    fromVersion?: number | null;
    toVersion?: number | null;
    detail?: Record<string, unknown>;
  }
) {
  await c.query(
    `INSERT INTO publish_events (tenant_id, brand_id, page_id, event_type, actor_user_id, from_version, to_version, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      e.tenantId,
      e.brandId ?? null,
      e.pageId ?? null,
      e.eventType,
      e.actorUserId ?? null,
      e.fromVersion ?? null,
      e.toVersion ?? null,
      e.detail ?? {},
    ]
  );
}
