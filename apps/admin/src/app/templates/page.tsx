import { requirePermission } from "@/lib/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requirePermission("sites", "read");
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <p className="eyebrow mb-1">Brand management</p>
        <h1 className="font-sans text-2xl font-bold">Templates</h1>
        <p className="text-sm text-dim">Site design templates. Sites are built by picking a template here.</p>
      </div>

      <div className="card flex min-h-[320px] flex-col items-center justify-center text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Template library — coming soon</h2>
        <p className="mt-1 max-w-md text-sm text-dim">
          Upload a ZIP of your Figma-exported templates here. The importer will auto-detect each template&apos;s
          regions (hero, body, FAQ, CTA, lead form), re-host images, and make them selectable in the site wizard.
        </p>
        <span className="mt-4 pill bg-faint/12 text-faint">Not built yet</span>
      </div>
    </AppShell>
  );
}
