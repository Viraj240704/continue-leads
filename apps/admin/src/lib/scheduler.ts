import "server-only";
import type { Client } from "./db";
import { seeded } from "./rng";
import { audit } from "./audit";

export interface ScheduledItem {
  pageId: string;
  path: string;
  wave: number;
  scheduledAt: string;
}
export interface WaveSummary {
  wave: number;
  label: string;
  target: number;
  count: number;
  startsAt: string;
  items: { path: string; scheduledAt: string }[];
}

const DAY = 86_400_000;

/**
 * Build a reproducible, dependency-aware progressive-publish calendar (spec §5).
 * Wave 0 = launch wave (fixed launch_size, immediate, human sign-off). Later waves
 * apply a bounded, seeded jitter to weekly targets and enforce daily caps and
 * dependency ordering. Re-running with the same inputs yields the same calendar.
 */
export async function buildSchedule(
  c: Client,
  opts: { tenantId: string; brandId: string; actorUserId: string; now?: Date }
): Promise<WaveSummary[]> {
  const now = opts.now ?? new Date();
  const policy = (await c.query(`SELECT * FROM site_rollout_policies WHERE brand_id = $1 ORDER BY version DESC LIMIT 1`, [opts.brandId])).rows[0];
  if (!policy) throw new Error("No rollout policy");

  const launchSize: number = policy.launch_size;
  const weekly: number[] = policy.weekly_targets;
  const jitterBound = Number(policy.jitter_bound);
  const dailyCap: number = policy.daily_cap;

  // Approved candidates, deterministic order.
  const candidates = (await c.query(
    `SELECT id, path, priority, depends_on, current_version_id FROM site_pages
      WHERE brand_id = $1 AND enabled = true AND deployment_state = 'approved' AND current_version_id IS NOT NULL
      ORDER BY priority, path`,
    [opts.brandId]
  )).rows as { id: string; path: string; priority: number; depends_on: string[]; current_version_id: string }[];

  // Already-published pages count as satisfied dependencies.
  const publishedIds = new Set<string>(
    (await c.query(`SELECT id FROM site_pages WHERE brand_id = $1 AND deployment_state = 'published'`, [opts.brandId])).rows.map((r) => r.id)
  );

  // Wave targets: launch wave, then weekly (jittered).
  const targets: number[] = [launchSize];
  weekly.forEach((t, i) => {
    const j = seeded(`${opts.brandId}:${policy.version}:week${i + 1}`);
    const mult = 1 - jitterBound + j.next() * (2 * jitterBound); // [1-b, 1+b]
    targets.push(Math.max(1, Math.round(t * mult)));
  });

  const assigned = new Map<string, number>(); // pageId -> wave
  const remaining = new Set(candidates.map((p) => p.id));
  const byId = new Map(candidates.map((p) => [p.id, p]));

  const depsSatisfied = (p: { depends_on: string[] }, wave: number) =>
    p.depends_on.every((d) => publishedIds.has(d) || (assigned.has(d) && assigned.get(d)! <= wave));

  for (let wave = 0; wave < targets.length && remaining.size > 0; wave++) {
    let slots = targets[wave]!;
    // Multiple passes so a page becomes eligible once its parent is placed this wave.
    let progressed = true;
    while (slots > 0 && progressed) {
      progressed = false;
      for (const p of candidates) {
        if (slots <= 0) break;
        if (!remaining.has(p.id)) continue;
        if (!depsSatisfied(p, wave)) continue;
        assigned.set(p.id, wave);
        remaining.delete(p.id);
        slots--;
        progressed = true;
      }
    }
  }
  // Anything still remaining (deep dependency chains) rolls into a final overflow wave.
  if (remaining.size) {
    const wave = targets.length;
    for (const id of remaining) assigned.set(id, wave);
  }

  // Assign concrete times: wave k starts k weeks out (wave 0 = now). Seeded shuffle
  // over allowed weekdays with daily cap and a minimum gap.
  const waveItems = new Map<number, string[]>();
  for (const [id, w] of assigned) (waveItems.get(w) ?? waveItems.set(w, []).get(w)!).push(id);

  // Rebuild schedule deterministically: clear existing not-yet-published rows.
  await c.query(`DELETE FROM publish_schedule WHERE brand_id = $1 AND status = 'scheduled'`, [opts.brandId]);

  const summaries: WaveSummary[] = [];
  for (const [wave, ids] of [...waveItems.entries()].sort((a, b) => a[0] - b[0])) {
    const waveStart = new Date(now.getTime() + wave * 7 * DAY);
    const rng = seeded(`${opts.brandId}:${policy.version}:wave${wave}:dist`);
    const ordered = rng.shuffle(ids.map((id) => byId.get(id)!.path).sort()).map((path) => candidates.find((c2) => c2.path === path)!);

    const items: { path: string; scheduledAt: string }[] = [];
    let dayOffset = wave === 0 ? 0 : 1;
    let perDay = 0;
    for (const p of ordered) {
      if (perDay >= dailyCap) { dayOffset++; perDay = 0; }
      // skip weekends
      let d = new Date(waveStart.getTime() + dayOffset * DAY);
      while (d.getDay() === 0 || d.getDay() === 6) { dayOffset++; d = new Date(waveStart.getTime() + dayOffset * DAY); }
      const hour = 9 + rng.int(0, 7); // 9am-4pm window
      const minute = rng.int(0, 59);
      const when = wave === 0 ? now : new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
      await c.query(
        `INSERT INTO publish_schedule (tenant_id, brand_id, page_id, page_version_id, wave, scheduled_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,'scheduled')
         ON CONFLICT (page_id, wave) DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, status = 'scheduled'`,
        [opts.tenantId, opts.brandId, p.id, p.current_version_id, wave, when]
      );
      await c.query(`UPDATE site_pages SET deployment_state = 'scheduled' WHERE id = $1 AND deployment_state = 'approved'`, [p.id]);
      items.push({ path: p.path, scheduledAt: when.toISOString() });
      perDay++;
    }
    summaries.push({
      wave, label: wave === 0 ? "Launch wave" : `Week ${wave}`,
      target: targets[wave] ?? ids.length, count: items.length,
      startsAt: (wave === 0 ? now : waveStart).toISOString(), items,
    });
  }

  await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, eventType: "scheduled", actorUserId: opts.actorUserId, detail: { waves: summaries.length, total: assigned.size } });
  return summaries;
}
