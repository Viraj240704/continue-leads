import { requireSession } from "@/lib/session";
import { AppShell, StatePill, QaPill, IndexPill } from "@/components/AppShell";
import { Logo, LogoMark } from "@/components/Logo";
import { WaveRail } from "@/components/WaveRail";
import { ValidationPill, SalePill, QualityBar } from "@/app/leads/Market";

export const dynamic = "force-dynamic";

const PALETTE: { name: string; v: string }[] = [
  { name: "canvas", v: "#F5F6F8" }, { name: "surface", v: "#FFFFFF" }, { name: "raised", v: "#F1F3F6" },
  { name: "line", v: "#E4E7EC" }, { name: "ink", v: "#101828" }, { name: "dim", v: "#475467" },
  { name: "faint", v: "#8A94A6" }, { name: "primary", v: "#4F46E5" }, { name: "amber", v: "#D97706" },
  { name: "data", v: "#175CD3" }, { name: "ok", v: "#12B76A" }, { name: "warn", v: "#F79009" },
  { name: "bad", v: "#F04438" }, { name: "info", v: "#2E90FA" }, { name: "violet", v: "#7A5AF8" },
];

export default async function StyleGuide() {
  const user = await requireSession();
  return (
    <AppShell user={user}>
      <div className="mb-8">
        <p className="eyebrow mb-1">Design system</p>
        <h1 className="font-display text-3xl font-bold">Foundry</h1>
        <p className="mt-1 max-w-2xl text-sm text-dim">
          The design language for Continue Leads — a clean, light enterprise system: white surfaces, soft
          elevation, indigo primary action, amber brand accent, Inter UI type and monospace for data. The
          signature motif is the wave rail, the cadence of progressive publishing.
        </p>
      </div>

      {/* Logo */}
      <Section title="Logo" n="01">
        <div className="flex flex-wrap items-center gap-6">
          <div className="card flex items-center gap-4"><Logo size={30} /></div>
          <div className="card flex items-center gap-4"><LogoMark size={40} /><span className="mono text-xs text-faint">mark</span></div>
          <div className="rounded-[var(--r-lg)] bg-white p-5"><Logo size={26} /></div>
        </div>
        <p className="mt-3 max-w-xl text-xs text-dim">Ascending wave-bars with a rising continuation arrow — progressive rollout and growing lead volume. Amber over graphite.</p>
      </Section>

      {/* Signature */}
      <Section title="Signature — wave rail" n="02">
        <div className="flex flex-wrap items-end gap-8">
          <Demo label="empty"><WaveRail total={16} live={0} count={16} /></Demo>
          <Demo label="launch wave"><WaveRail total={20} live={6} sched={4} count={16} /></Demo>
          <Demo label="scaling"><WaveRail total={20} live={13} sched={3} count={16} /></Demo>
          <Demo label="complete"><WaveRail total={20} live={20} count={16} /></Demo>
        </div>
      </Section>

      {/* Palette */}
      <Section title="Palette" n="03">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {PALETTE.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-[var(--r)] border border-line">
              <div style={{ background: c.v, height: 56 }} />
              <div className="bg-surface px-2 py-1.5">
                <div className="text-xs font-semibold capitalize">{c.name}</div>
                <div className="mono text-[10px] text-faint">{c.v}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typography" n="04">
        <div className="card space-y-4">
          <div>
            <p className="stat-label mb-1">Display · Space Grotesk</p>
            <p className="font-display text-4xl font-bold tracking-tight">Manufacture distinct sites at scale</p>
          </div>
          <div className="divider" />
          <div>
            <p className="stat-label mb-1">Body · Inter</p>
            <p className="max-w-2xl text-sm text-dim">Every page is generated from structured brand inputs, checked against a semantic-similarity gate, previewed privately, approved by a human, and published in reproducible waves.</p>
          </div>
          <div className="divider" />
          <div>
            <p className="stat-label mb-1">Mono · IBM Plex Mono</p>
            <p className="mono text-sm text-data">/services/interior-painting/springfield · sim 0.603 · $37.20</p>
          </div>
        </div>
      </Section>

      {/* Components */}
      <Section title="Components" n="05">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <p className="stat-label mb-3">Buttons</p>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn">Primary</button>
              <button className="btn-ghost">Ghost</button>
              <button className="btn-danger">Danger</button>
              <button className="btn btn-sm">Small</button>
            </div>
          </div>
          <div className="card">
            <p className="stat-label mb-3">Status pills</p>
            <div className="flex flex-wrap gap-2">
              {["draft", "generated", "approved", "scheduled", "published", "paused", "qa_failed"].map((s) => <StatePill key={s} state={s} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <QaPill status="pass" /><QaPill status="warn" /><QaPill status="fail" />
              <IndexPill state="indexable" /><IndexPill state="noindex" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <ValidationPill status="valid" /><ValidationPill status="review" /><ValidationPill status="invalid" />
              <SalePill status="for_sale" /><SalePill status="sold" />
            </div>
          </div>
          <div className="card">
            <p className="stat-label mb-3">Inputs</p>
            <div className="space-y-2">
              <div><label className="label">Brand name</label><input className="input" defaultValue="Copperline Painting Co" /></div>
              <div><label className="label">Domain</label><input className="input mono" defaultValue="copperlinepainting.com" /></div>
            </div>
          </div>
          <div className="card">
            <p className="stat-label mb-3">Meters & stats</p>
            <div className="flex items-center gap-8">
              <div><div className="stat-num" style={{ color: "var(--amber)" }}>$48.00</div><div className="stat-label">Lead price</div></div>
              <div className="flex-1 space-y-2">
                <QualityBar score={92} /><QualityBar score={58} /><QualityBar score={24} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Table */}
      <Section title="Data table" n="06">
        <div className="data-table overflow-x-auto rounded-[var(--r-lg)] border border-line">
          <table className="w-full border-collapse">
            <thead className="bg-raised/40"><tr>
              <th className="th">Path</th><th className="th">Type</th><th className="th">Deploy</th><th className="th">QA</th><th className="th">Sim</th>
            </tr></thead>
            <tbody>
              {[["/", "HOME", "published", "pass", "0.31"], ["/services/interior-painting", "SERVICE", "approved", "pass", "0.52"], ["/services/interior-painting/springfield", "MONEY", "scheduled", "warn", "0.78"]].map((r, i) => (
                <tr key={i} className="border-t border-line/60">
                  <td className="td mono text-xs">{r[0]}</td><td className="td text-faint">{r[1]}</td>
                  <td className="td"><StatePill state={r[2]!} /></td><td className="td"><QaPill status={r[3]} /></td>
                  <td className="td mono text-data">{r[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </AppShell>
  );
}

function Section({ title, n, children }: { title: string; n: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="mono text-xs text-amber">{n}</span>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="h-px flex-1" style={{ background: "linear-gradient(90deg, var(--line), transparent)" }} />
      </div>
      {children}
    </section>
  );
}
function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {children}
      <span className="mono text-[10px] text-faint">{label}</span>
    </div>
  );
}
