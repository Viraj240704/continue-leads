"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrandAction } from "@/app/actions/site";
import { checkDomainAction } from "@/app/actions/manage";
import { GeoSelect, type GeoSelection } from "./GeoSelect";
import { SITE_TYPES, URL_PRESETS, buildMoneyPath, previewUrl, validatePattern, templateName, TEMPLATE_CATALOG, type SiteType } from "@/lib/site-strategy";
import { CADENCES, DEFAULT_BLOG, validateBlog, type BlogConfig, type Cadence } from "@/lib/blog";
import { DESIGN_PRESETS } from "@/lib/presets";

interface PackData {
  id: string;
  key: string;
  name: string;
  services: { slug: string; name: string; hint: string }[];
  blueprints: { scope: string }[];
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Wizard({ packs }: { packs: PackData[] }) {
  const [packId, setPackId] = useState(packs[0]?.id ?? "");
  const pack = packs.find((p) => p.id === packId);
  const [name, setName] = useState("Evergreen " + (pack?.name.split(" ")[0] ?? "Co"));
  const [domain, setDomain] = useState("evergreen-demo.com");
  const [serviceSlugs, setServiceSlugs] = useState<string[]>(pack?.services.map((s) => s.slug) ?? []);
  const [geo, setGeo] = useState<GeoSelection>({ states: ["CO"], cities: ["CO|Denver", "CO|Aurora"], zips: [] });
  const [siteType, setSiteType] = useState<SiteType>("local");
  const [urlPattern, setUrlPattern] = useState("/services/{service}/{city}");
  const [urlMode, setUrlMode] = useState<"preset" | "custom">("preset");
  const [confirmText, setConfirmText] = useState("");
  const [templatePresetId, setTemplatePresetId] = useState<string>(""); // "" = auto-assign
  const [blog, setBlog] = useState<BlogConfig>({ ...DEFAULT_BLOG });
  const [topicsRaw, setTopicsRaw] = useState("");
  const [phone, setPhone] = useState("(555) 010-2000");
  const [email, setEmail] = useState("hello@evergreen-demo.com");
  const [addressCity, setAddressCity] = useState("Denver");
  const [years, setYears] = useState(12);
  const [licenseRef, setLicenseRef] = useState("Lic #CL-000123");
  const [tagline, setTagline] = useState("Craftsmanship you can see, service you can trust.");
  const [ga4, setGa4] = useState("");
  const [brief, setBrief] = useState("");
  const [domainMode, setDomainMode] = useState<"have" | "find">("have");
  const [domainQuote, setDomainQuote] = useState<any>(null);
  const [registerAfter, setRegisterAfter] = useState(false);
  const [domainNote, setDomainNote] = useState<string | null>(null);
  const [launchSize, setLaunchSize] = useState(8);
  const [dailyCap, setDailyCap] = useState(3);
  const [weeklyTargets, setWeeklyTargets] = useState("6,8,12,17");
  const [timezone, setTimezone] = useState("America/Denver");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [aboutText, setAboutText] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // City names that drive page generation (deduped from "STATE|City" keys).
  const cityNames = useMemo(
    () => Array.from(new Set(geo.cities.map((c) => c.split("|")[1]!).filter(Boolean))),
    [geo.cities]
  );

  const pageCount = useMemo(() => {
    if (!pack) return 0;
    const s = serviceSlugs.length, ct = Math.max(cityNames.length, 1);
    let n = 0;
    for (const b of pack.blueprints) {
      if (b.scope === "single") n += 1;
      else if (b.scope === "perService") n += s;
      else if (b.scope === "perCity") n += ct;
      else if (b.scope === "perServiceCity") n += s * ct;
    }
    if (blog.enabled) n += 1 + (Number(blog.initialPosts) || 0); // blog index + launch posts
    return n;
  }, [pack, serviceSlugs, cityNames, blog.enabled, blog.initialPosts]);

  const estCost = (pageCount * 0.032).toFixed(2);

  function selectPack(id: string) {
    setPackId(id);
    const p = packs.find((x) => x.id === id);
    setServiceSlugs(p?.services.map((s) => s.slug) ?? []);
  }
  function toggleService(slug: string) {
    setServiceSlugs((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  }

  function submit() {
    setError(null);
    if (!name.trim() || !domain.trim()) { setError("Name and domain are required."); return; }
    if (!packId) { setError("Choose a product pack."); return; }
    if (serviceSlugs.length === 0) { setError("Select at least one service."); return; }
    if (cityNames.length === 0) { setError("Select at least one city in the geography step."); return; }
    const patErr = validatePattern(urlPattern);
    if (patErr) { setError(`URL strategy: ${patErr}`); return; }
    const blogErr = validateBlog(blog);
    if (blogErr) { setError(`Blog: ${blogErr}`); return; }

    const input = {
      name: name.trim(),
      slug: slugify(name),
      domain: domain.trim(),
      verticalPackId: packId,
      templatePresetId: templatePresetId || undefined, // "" => auto-assign internally
      siteType,
      urlPattern,
      blogConfig: { ...blog, topics: topicsRaw.split(",").map((t) => t.trim()).filter(Boolean) },
      brief: brief.trim(),
      domainStatus: (registerAfter ? "pending" : "provided") as "pending" | "provided",
      profile: {
        tagline, tone: "", voiceAdjectives: [] as string[], ctaStyle: "",
        palette: { bg: "", surface: "", text: "", primary: "", accent: "" },
        typography: { heading: "", body: "" },
        phone, email, addressCity, yearsInBusiness: Number(years) || 1, licenseRef,
        services: serviceSlugs, cities: cityNames, states: geo.states, zips: geo.zips,
        analytics: ga4 ? { ga4 } : {},
      },
      rollout: {
        launchSize: Number(launchSize) || 8,
        weeklyTargets: weeklyTargets.split(",").map((x) => Number(x.trim())).filter((x) => x > 0),
        dailyCap: Number(dailyCap) || 3,
        timezone,
      },
    };
    startTransition(async () => {
      try {
        setStatus("Creating brand & page plan…");
        const brandId = await createBrandAction(input, registerAfter);
        const upload = async (fd: FormData, label: string) => {
          setStatus(`Uploading ${label}…`);
          const r = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: fd });
          const j = await r.json();
          if (!j.ok) throw new Error(`${label}: ${j.error ?? "upload failed"}`);
        };
        if (logoFile) { const fd = new FormData(); fd.set("kind", "logo"); fd.set("file", logoFile); await upload(fd, "logo"); }
        if (aboutText.trim()) { const fd = new FormData(); fd.set("kind", "about"); fd.set("text", aboutText); await upload(fd, "about-us text"); }
        if (docFile) { const fd = new FormData(); fd.set("kind", docFile.type.startsWith("image/") ? "image" : "document"); fd.set("file", docFile); await upload(fd, "document"); }
        setStatus("Opening console…");
        router.push(`/brands/${brandId}`);
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        setStatus(null);
        setError(e?.message ?? "Failed to create brand.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        {/* Product pack */}
        <section className="card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">1 · Product</h2>
            <a href="/packs/import" className="text-xs text-accent hover:underline">Import products from Excel</a>
          </div>
          <p className="mb-3 text-xs text-dim">Choose the product pack. Its services appear below.</p>
          <select className="input" value={packId} onChange={(e) => selectPack(e.target.value)}>
            {packs.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.services.length} services</option>)}
          </select>
        </section>

        {/* Template */}
        <section className="card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">2 · Template</h2>
            <a href="/templates" className="text-xs text-accent hover:underline">Manage templates</a>
          </div>
          <p className="mb-2 text-xs text-dim">Choose a design template for this site, or let the platform assign one automatically.</p>
          <select className="input" value={templatePresetId} onChange={(e) => setTemplatePresetId(e.target.value)}>
            <option value="">Auto-assign (recommended) — rotates so same-product sites look distinct</option>
            {DESIGN_PRESETS.map((t) => (
              <option key={t.id} value={t.id}>{templateName(t.id)}</option>
            ))}
          </select>
          {templatePresetId && TEMPLATE_CATALOG[templatePresetId] && (
            <p className="mt-2 text-xs text-dim">{TEMPLATE_CATALOG[templatePresetId]!.blurb}</p>
          )}
          <p className="mt-2 text-[11px] text-faint">Your uploaded Figma templates will appear in this list once the importer ships — for now these are starter templates.</p>
        </section>

        {/* Identity */}
        <section className="card">
          <h2 className="mb-3 font-semibold">3 · Brand identity</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Brand name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Domain"><input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} /></Field>
            <Field label="Tagline"><input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
            <Field label="Slug (auto)"><input className="input opacity-70" value={slugify(name)} readOnly /></Field>
            <Field label="Phone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Base city"><input className="input" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} /></Field>
            <Field label="Years in business"><input className="input" type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} /></Field>
            <Field label="License reference"><input className="input" value={licenseRef} onChange={(e) => setLicenseRef(e.target.value)} /></Field>
            <Field label="Site type (scale)">
              <select className="input" value={siteType} onChange={(e) => setSiteType(e.target.value as SiteType)}>
                {SITE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.scale}</option>)}
              </select>
            </Field>
            <Field label="GA4 ID (optional)"><input className="input" value={ga4} onChange={(e) => setGa4(e.target.value)} placeholder="G-XXXXXXX" /></Field>
          </div>
        </section>

        {/* Content brief */}
        <section className="card">
          <h2 className="mb-1 font-semibold">4 · Content brief <span className="text-xs font-normal text-faint">(optional)</span></h2>
          <p className="mb-2 text-xs text-dim">Extra instructions for the generator — differentiators, emphasis, tone.</p>
          <textarea className="input min-h-[90px]" value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Family-owned since 1998, eco-friendly low-VOC paints, same-week scheduling." />
        </section>

        {/* Domain */}
        <section className="card">
          <h2 className="mb-3 font-semibold">5 · Domain</h2>
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => { setDomainMode("have"); setRegisterAfter(false); setDomainQuote(null); }}
              className={`pill border px-3 py-1 ${domainMode === "have" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>I have a domain</button>
            <button type="button" onClick={() => setDomainMode("find")}
              className={`pill border px-3 py-1 ${domainMode === "find" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>Find &amp; register one</button>
          </div>
          {domainMode === "have" ? (
            <p className="text-sm text-dim">Using <span className="font-mono text-ink">{domain}</span> — edit it in <b>Brand identity</b> above.</p>
          ) : (
            <>
              <div className="flex gap-2">
                <input className="input" value={domain} onChange={(e) => { setDomain(e.target.value); setDomainQuote(null); setRegisterAfter(false); }} placeholder="yourbrand.com" />
                <button type="button" className="btn-ghost" disabled={pending}
                  onClick={() => startTransition(async () => { setDomainNote(null); setDomainQuote(await checkDomainAction(domain)); })}>Check</button>
              </div>
              {domainQuote && (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{domainQuote.domain}</span>
                    {domainQuote.available
                      ? <span className="pill bg-ok/12 text-ok">available · ${domainQuote.priceUsd}/yr</span>
                      : <span className="pill bg-bad/12 text-bad">taken</span>}
                  </div>
                  {domainQuote.available ? (
                    <button type="button" className="btn mt-1" onClick={() => { setRegisterAfter(true); setDomainNote(`Will register ${domainQuote.domain} on create.`); }}>Use &amp; register (simulated)</button>
                  ) : (
                    <div className="pt-1">
                      <div className="text-xs text-dim">Available alternatives:</div>
                      {domainQuote.suggestions?.filter((s: any) => s.available).slice(0, 3).map((s: any) => (
                        <button key={s.domain} type="button" className="mr-2 text-xs text-accent hover:underline"
                          onClick={() => { setDomain(s.domain); setRegisterAfter(true); setDomainQuote(null); setDomainNote(`Will register ${s.domain} on create.`); }}>{s.domain} (${s.priceUsd})</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {domainNote && <p className="mt-2 text-xs text-ok">{domainNote}</p>}
              <p className="mt-2 text-[11px] text-faint">Registration is simulated — no real purchase occurs.</p>
            </>
          )}
        </section>

        {/* Logo & assets */}
        <section className="card">
          <h2 className="mb-1 font-semibold">6 · Logo & assets <span className="text-xs font-normal text-faint">(optional)</span></h2>
          <p className="mb-3 text-xs text-dim">The logo appears on the generated site; about-us text feeds the About page.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Logo (image)</label>
              <input type="file" accept="image/*" className="text-xs" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
              {logoFile && <p className="mt-1 text-xs text-ok">✓ {logoFile.name}</p>}
            </div>
            <div>
              <label className="label">Document / image (optional)</label>
              <input type="file" className="text-xs" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              {docFile && <p className="mt-1 text-xs text-ok">✓ {docFile.name}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label">About-us text</label>
              <textarea className="input min-h-[70px]" value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Tell the story of the business — used to write the About page." />
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="card">
          <h2 className="mb-3 font-semibold">7 · Services</h2>
          <div className="flex flex-wrap gap-2">
            {pack?.services.map((s) => (
              <button key={s.slug} type="button" onClick={() => toggleService(s.slug)}
                className={`pill border px-3 py-1 ${serviceSlugs.includes(s.slug) ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>
                {s.name}
              </button>
            ))}
          </div>
        </section>

        {/* Geography */}
        <section className="card">
          <h2 className="mb-1 font-semibold">8 · Geography</h2>
          <p className="mb-3 text-xs text-dim">Pick target areas — State → City → ZIP. Selected cities generate location pages. Or upload a template.</p>
          <GeoSelect value={geo} onChange={setGeo} />
        </section>

        {/* URL strategy */}
        <section className="card">
          <h2 className="mb-1 font-semibold">9 · URL strategy</h2>
          <p className="mb-3 text-xs text-dim">The money-page URL pattern (service × city). <b>Locked after publish</b> — permalinks never change.</p>
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setUrlMode("preset")}
              className={`pill border px-3 py-1 ${urlMode === "preset" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>Preset</button>
            <button type="button" onClick={() => setUrlMode("custom")}
              className={`pill border px-3 py-1 ${urlMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>Custom builder</button>
          </div>
          {urlMode === "preset" ? (
            <div className="space-y-1.5">
              {URL_PRESETS.map((p) => (
                <label key={p.pattern} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${urlPattern === p.pattern ? "border-primary bg-primary/5" : "border-line"}`}>
                  <input type="radio" name="urlpat" checked={urlPattern === p.pattern} onChange={() => setUrlPattern(p.pattern)} />
                  <span className="mono">{p.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              <input className="input mono" value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} placeholder="/services/{service}/{city}" />
              <p className="mt-1 text-xs text-faint">Use tokens <span className="mono">{"{service}"}</span> and <span className="mono">{"{city}"}</span>. Lowercase, / and - only.</p>
              {validatePattern(urlPattern) && <p className="mt-1 text-xs text-bad">{validatePattern(urlPattern)}</p>}
            </div>
          )}
          <div className="mt-3 rounded-md border border-line bg-canvas px-3 py-2">
            <span className="text-xs text-faint">Example: </span>
            <span className="mono text-sm text-primary">{previewUrl(domain, urlPattern)}</span>
          </div>
        </section>

        {/* Blog */}
        <section className="card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">10 · Blog</h2>
            <button
              type="button"
              aria-pressed={blog.enabled}
              onClick={() => setBlog((b) => ({ ...b, enabled: !b.enabled }))}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                blog.enabled ? "border-primary bg-primary/10 text-primary" : "border-line text-dim hover:text-ink"
              }`}
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${blog.enabled ? "bg-primary" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${blog.enabled ? "left-[18px]" : "left-0.5"}`} />
              </span>
              {blog.enabled ? "Blog enabled" : "Enable blog"}
            </button>
          </div>
          <p className="mb-3 text-xs text-dim">A cadence-published blog drives topical authority. Off by default.</p>
          {blog.enabled && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Cadence">
                  <select className="input" value={blog.cadence} onChange={(e) => setBlog({ ...blog, cadence: e.target.value as Cadence })}>
                    {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Posts per run"><input className="input" type="number" min={1} value={blog.postsPerRun} onChange={(e) => setBlog({ ...blog, postsPerRun: Number(e.target.value) })} /></Field>
                <Field label="Launch posts"><input className="input" type="number" min={0} value={blog.initialPosts} onChange={(e) => setBlog({ ...blog, initialPosts: Number(e.target.value) })} /></Field>
                <Field label="URL prefix"><input className="input mono" value={blog.urlPrefix} onChange={(e) => setBlog({ ...blog, urlPrefix: e.target.value })} placeholder="/blog" /></Field>
                <Field label="Post URL pattern"><input className="input mono" value={blog.postPattern} onChange={(e) => setBlog({ ...blog, postPattern: e.target.value })} placeholder="/blog/{slug}" /></Field>
              </div>
              <Field label="Topic focus areas (comma-separated)">
                <input className="input" value={topicsRaw} onChange={(e) => setTopicsRaw(e.target.value)} placeholder="cabinet painting, color trends, exterior prep" />
              </Field>
              <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs">
                <span className="text-faint">Publishes </span>
                <b>{blog.initialPosts}</b><span className="text-faint"> posts at launch, then </span>
                <b>{blog.postsPerRun}</b><span className="text-faint">/{blog.cadence === "weekly" ? "week" : blog.cadence === "biweekly" ? "2 weeks" : "month"}</span>
                <span className="text-faint"> · Example: </span>
                <span className="mono text-primary">{(domain || "yoursite.com").replace(/^https?:\/\//, "")}{blog.postPattern.replace("{slug}", "cabinet-painting-cost")}</span>
              </div>
            </div>
          )}
        </section>

        {/* Rollout */}
        <section className="card">
          <h2 className="mb-3 font-semibold">11 · Rollout policy</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Launch wave size (6–10 indexable)"><input className="input" type="number" value={launchSize} onChange={(e) => setLaunchSize(Number(e.target.value))} /></Field>
            <Field label="Daily cap"><input className="input" type="number" value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} /></Field>
            <Field label="Weekly targets (comma)"><input className="input" value={weeklyTargets} onChange={(e) => setWeeklyTargets(e.target.value)} /></Field>
            <Field label="Timezone"><input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
          </div>
        </section>

        {error && <p className="text-sm text-bad">{error}</p>}
      </div>

      {/* Summary rail */}
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <div className="card space-y-3">
          <h3 className="font-semibold">Estimate</h3>
          <Row k="Product" v={pack?.name ?? "—"} />
          <Row k="Services" v={String(serviceSlugs.length)} />
          <Row k="Cities" v={String(cityNames.length)} />
          <Row k="ZIPs" v={String(geo.zips.length)} />
          <div className="my-2 border-t border-line" />
          <Row k="Pages to generate" v={String(pageCount)} big />
          <Row k="Est. generation cost" v={`$${estCost}`} big />
          <p className="text-xs text-faint">Design is assigned automatically so brands in the same product look distinct. Every page starts <b>noindex</b>; only {launchSize} become indexable at launch.</p>
          {pageCount > 40 && (
            <div className="rounded-md border border-warn/40 bg-warn/5 p-2">
              <p className="text-xs text-warn">Large batch ({pageCount} pages, ~${estCost}). Type <b>GENERATE</b> to confirm.</p>
              <input className="input mt-1.5 h-8 py-0" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="GENERATE" />
            </div>
          )}
          <button
            onClick={submit}
            disabled={pending || (pageCount > 40 && confirmText.trim().toUpperCase() !== "GENERATE")}
            className="btn w-full justify-center"
          >
            {pending ? "Working…" : "Create brand & page plan"}
          </button>
          {status && <p className="text-center text-xs text-data">{status}</p>}
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}
function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-start gap-3 text-sm">
      <span className="min-w-0 text-dim">{k}</span>
      <span className={`min-w-0 break-words text-right leading-snug ${big ? "text-lg font-bold" : "font-medium"}`}>{v}</span>
    </div>
  );
}
