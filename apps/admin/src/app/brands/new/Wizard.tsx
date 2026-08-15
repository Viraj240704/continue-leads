"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrandAction } from "@/app/actions/site";
import { checkDomainAction } from "@/app/actions/manage";
import { GeoSelect, type GeoSelection } from "./GeoSelect";
import {
  SITE_TYPES,
  URL_PRESETS,
  previewUrl,
  validatePattern,
  templateName,
  TEMPLATE_CATALOG,
  type SiteType,
} from "@/lib/site-strategy";
import { CADENCES, DEFAULT_BLOG, validateBlog, type BlogConfig, type Cadence } from "@/lib/blog";
import { DESIGN_PRESETS } from "@/lib/presets";

interface PackData {
  id: string;
  key: string;
  name: string;
  services: { slug: string; name: string; hint: string }[];
  blueprints: { scope: string }[];
}

type SectionId =
  | "product"
  | "template"
  | "identity"
  | "brief"
  | "domain"
  | "assets"
  | "services"
  | "geography"
  | "url"
  | "blog"
  | "rollout";

type SectionStatus = "completed" | "active" | "untouched" | "optional" | "error";
type TabId = "foundation" | "brand-setup" | "services-assets" | "targeting-structure" | "publishing-launch";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function compactList(values: string[], limit = 2) {
  if (values.length === 0) return "";
  if (values.length <= limit) return values.join(", ");
  return `${values.slice(0, limit).join(", ")} +${values.length - limit}`;
}

function clipSummary(value: string, max = 64) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

const SECTION_ORDER: { id: SectionId; number: string; title: string; description: string; optional?: boolean }[] = [
  { id: "product", number: "01", title: "Product", description: "Choose the pack that drives services and page blueprints." },
  { id: "template", number: "02", title: "Template", description: "Pick a design preset or keep auto-assignment." },
  { id: "identity", number: "03", title: "Brand identity", description: "Core company details, contact info, and site scale." },
  { id: "brief", number: "04", title: "Content brief", description: "Optional generator notes, differentiators, and tone guidance.", optional: true },
  { id: "domain", number: "05", title: "Domain", description: "Use an existing domain or simulate registration." },
  { id: "assets", number: "06", title: "Logo & assets", description: "Optional files and About content for the generated site.", optional: true },
  { id: "services", number: "07", title: "Services", description: "Select at least one service from the chosen product pack." },
  { id: "geography", number: "08", title: "Geography", description: "Choose the states, cities, and ZIPs that drive coverage." },
  { id: "url", number: "09", title: "URL strategy", description: "Set the money-page URL structure before publish." },
  { id: "blog", number: "10", title: "Blog", description: "Optional topical authority publishing settings.", optional: true },
  { id: "rollout", number: "11", title: "Rollout policy", description: "Control launch size, pacing, and timezone." },
];

const TAB_ORDER: {
  id: TabId;
  title: string;
  description: string;
  sections: SectionId[];
}[] = [
  {
    id: "foundation",
    title: "Foundation",
    description: "Product and template selection",
    sections: ["product", "template"],
  },
  {
    id: "brand-setup",
    title: "Brand Setup",
    description: "Identity, brief, and domain",
    sections: ["identity", "brief", "domain"],
  },
  {
    id: "services-assets",
    title: "Services & Assets",
    description: "Site inputs and service coverage",
    sections: ["assets", "services"],
  },
  {
    id: "targeting-structure",
    title: "Targeting & Structure",
    description: "Geography and URL strategy",
    sections: ["geography", "url"],
  },
  {
    id: "publishing-launch",
    title: "Publishing & Launch",
    description: "Blog and rollout controls",
    sections: ["blog", "rollout"],
  },
];
function tabIcon(id: TabId, className = "w-5 h-5") {
  switch (id) {
    case "foundation":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "brand-setup":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="22" x2="9" y2="16" />
          <line x1="15" y1="22" x2="15" y2="16" />
          <line x1="9" y1="16" x2="15" y2="16" />
          <path d="M8 6h.01" />
          <path d="M16 6h.01" />
          <path d="M8 10h.01" />
          <path d="M16 10h.01" />
        </svg>
      );
    case "services-assets":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "targeting-structure":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case "publishing-launch":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
          <path d="M12 12c-1.1-1.1-1.1-2.9 0-4L16.5 3.5c1.1-1.1 2.9-1.1 4 0s1.1 2.9 0 4L16 12c-1.1 1.1-2.9 1.1-4 0Z" />
          <path d="m9 15-3-3" />
          <path d="M9 15c-1.5 1.5-2.5 3.5-2.5 3.5s2-1 3.5-2.5" />
          <path d="M15 9c1.5-1.5 3.5-2.5 3.5-2.5s-1 2-2.5 3.5" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

function sectionIcon(id: SectionId, className = "w-5 h-5") {
  switch (id) {
    case "product":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "template":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      );
    case "identity":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "brief":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "domain":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "assets":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      );
    case "services":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "geography":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case "url":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "blog":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8" />
          <path d="M15 18h-5" />
          <path d="M10 6h8v4h-8V6Z" />
        </svg>
      );
    case "rollout":
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="m12 3-1.912 5.886L4 9l5.886 1.912L12 17l1.912-5.886L20 9l-5.886-1.912L12 3Z" />
          <path d="M5 3v4" />
          <path d="M19 17v4" />
          <path d="M3 5h4" />
          <path d="M17 19h4" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
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
  const [templatePresetId, setTemplatePresetId] = useState<string>("");
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
  const [activeTab, setActiveTab] = useState<TabId>("foundation");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [servicesPage, setServicesPage] = useState(0);
  const [suggestionsPage, setSuggestionsPage] = useState(0);
  const router = useRouter();

  const cityNames = useMemo(
    () => Array.from(new Set(geo.cities.map((c) => c.split("|")[1]!).filter(Boolean))),
    [geo.cities]
  );

  const selectedServiceNames = useMemo(
    () => pack?.services.filter((service) => serviceSlugs.includes(service.slug)).map((service) => service.name) ?? [],
    [pack, serviceSlugs]
  );

  const pageCount = useMemo(() => {
    if (!pack) return 0;
    const serviceCount = serviceSlugs.length;
    const cityCount = Math.max(cityNames.length, 1);
    let total = 0;
    for (const blueprint of pack.blueprints) {
      if (blueprint.scope === "single") total += 1;
      else if (blueprint.scope === "perService") total += serviceCount;
      else if (blueprint.scope === "perCity") total += cityCount;
      else if (blueprint.scope === "perServiceCity") total += serviceCount * cityCount;
    }
    if (blog.enabled) total += 1 + (Number(blog.initialPosts) || 0);
    return total;
  }, [pack, serviceSlugs, cityNames, blog.enabled, blog.initialPosts]);

  const estCost = (pageCount * 0.032).toFixed(2);
  const urlError = validatePattern(urlPattern);
  const blogError = validateBlog(blog);
  const requiresGenerateConfirmation = pageCount > 40;
  const generateConfirmed = !requiresGenerateConfirmation || confirmText.trim().toUpperCase() === "GENERATE";

  function selectPack(id: string) {
    setPackId(id);
    const nextPack = packs.find((x) => x.id === id);
    setServiceSlugs(nextPack?.services.map((service) => service.slug) ?? []);
    setServicesPage(0);
  }

  function toggleService(slug: string) {
    setServiceSlugs((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  }

  function submit() {
    setError(null);
    if (!name.trim() || !domain.trim()) {
      setError("Name and domain are required.");
      setActiveTab("brand-setup");
      return;
    }
    if (!packId) {
      setError("Choose a product pack.");
      setActiveTab("foundation");
      return;
    }
    if (serviceSlugs.length === 0) {
      setError("Select at least one service.");
      setActiveTab("services-assets");
      return;
    }
    if (cityNames.length === 0) {
      setError("Select at least one city in the geography step.");
      setActiveTab("targeting-structure");
      return;
    }
    if (urlError) {
      setError(`URL strategy: ${urlError}`);
      setActiveTab("targeting-structure");
      return;
    }
    if (blogError) {
      setError(`Blog: ${blogError}`);
      setActiveTab("publishing-launch");
      return;
    }

    const input = {
      name: name.trim(),
      slug: slugify(name),
      domain: domain.trim(),
      verticalPackId: packId,
      templatePresetId: templatePresetId || undefined,
      siteType,
      urlPattern,
      blogConfig: { ...blog, topics: topicsRaw.split(",").map((topic) => topic.trim()).filter(Boolean) },
      brief: brief.trim(),
      domainStatus: (registerAfter ? "pending" : "provided") as "pending" | "provided",
      profile: {
        tagline,
        tone: "",
        voiceAdjectives: [] as string[],
        ctaStyle: "",
        palette: { bg: "", surface: "", text: "", primary: "", accent: "" },
        typography: { heading: "", body: "" },
        phone,
        email,
        addressCity,
        yearsInBusiness: Number(years) || 1,
        licenseRef,
        services: serviceSlugs,
        cities: cityNames,
        states: geo.states,
        zips: geo.zips,
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
        setStatus("Creating brand & page plan...");
        const brandId = await createBrandAction(input, registerAfter);
        const upload = async (formData: FormData, label: string) => {
          setStatus(`Uploading ${label}...`);
          const response = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: formData });
          const json = await response.json();
          if (!json.ok) throw new Error(`${label}: ${json.error ?? "upload failed"}`);
        };
        if (logoFile) {
          const formData = new FormData();
          formData.set("kind", "logo");
          formData.set("file", logoFile);
          await upload(formData, "logo");
        }
        if (aboutText.trim()) {
          const formData = new FormData();
          formData.set("kind", "about");
          formData.set("text", aboutText);
          await upload(formData, "about-us text");
        }
        if (docFile) {
          const formData = new FormData();
          formData.set("kind", docFile.type.startsWith("image/") ? "image" : "document");
          formData.set("file", docFile);
          await upload(formData, "document");
        }
        setStatus("Opening console...");
        router.push(`/brands/${brandId}`);
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        setStatus(null);
        setError(e?.message ?? "Failed to create brand.");
      }
    });
  }

  const sectionState = {
    product: {
      status: !packId ? "error" : "completed",
      summary: pack ? pack.name : "Not configured",
    },
    template: {
      status: "completed",
      summary: templatePresetId ? templateName(templatePresetId) : "Auto-assign",
    },
    identity: {
      status: !name.trim() || !domain.trim() ? "error" : "completed",
      summary: name.trim() && domain.trim() ? `${name.trim()} · ${domain.trim()}` : "Not configured",
    },
    brief: {
      status: brief.trim() ? "completed" : "optional",
      summary: brief.trim() ? clipSummary(brief, 70) : "Optional",
    },
    domain: {
      status: !domain.trim() ? "error" : domainMode === "find" && registerAfter ? "completed" : "completed",
      summary: domainMode === "find"
        ? registerAfter
          ? `Register ${domain.trim()}`
          : domainQuote?.available
            ? `${domain.trim()} available · $${domainQuote.priceUsd}/yr`
            : domain.trim() || "Not configured"
        : domain.trim() || "Not configured",
    },
    assets: {
      status: logoFile || docFile || aboutText.trim() ? "completed" : "optional",
      summary: compactList(
        [logoFile ? `Logo: ${logoFile.name}` : "", docFile ? `File: ${docFile.name}` : "", aboutText.trim() ? "About text added" : ""].filter(Boolean),
        2
      ) || "Optional",
    },
    services: {
      status: serviceSlugs.length === 0 ? "error" : "completed",
      summary: serviceSlugs.length === 0 ? "Not configured" : compactList(selectedServiceNames, 2),
    },
    geography: {
      status: cityNames.length === 0 ? "error" : "completed",
      summary: cityNames.length === 0
        ? "Not configured"
        : `${cityNames.length} cities · ${geo.zips.length} ZIPs · ${geo.states.length} states`,
    },
    url: {
      status: urlError ? "error" : "completed",
      summary: urlError ? urlError : urlPattern,
    },
    blog: {
      status: blog.enabled ? (blogError ? "error" : "completed") : "optional",
      summary: blog.enabled
        ? `${blog.initialPosts} launch · ${blog.postsPerRun}/${blog.cadence === "weekly" ? "week" : blog.cadence === "biweekly" ? "2 weeks" : "month"}`
        : "Optional",
    },
    rollout: {
      status: "completed",
      summary: `${launchSize} launch · ${dailyCap}/day · ${timezone}`,
    },
  } satisfies Record<SectionId, { status: Exclude<SectionStatus, "active">; summary: string }>;

  const sections: Array<(typeof SECTION_ORDER)[number] & { status: SectionStatus; summary: string }> = SECTION_ORDER.map((section) => ({
    ...section,
    status: sectionState[section.id].status,
    summary: sectionState[section.id].summary,
  }));

  const tabs: Array<(typeof TAB_ORDER)[number] & { status: SectionStatus }> = TAB_ORDER.map((tab) => {
    const statuses = tab.sections.map((sectionId) => sectionState[sectionId].status);
    let status: SectionStatus = "untouched";
    if (activeTab === tab.id) {
      status = "active";
    } else if (statuses.includes("error")) {
      status = "error";
    } else if (statuses.every((value) => value === "optional")) {
      status = "untouched";
    } else if (statuses.every((value) => value === "completed" || value === "optional")) {
      status = "completed";
    } else if (statuses.some((value) => value === "completed")) {
      status = "completed";
    }
    return { ...tab, status };
  });

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!;
  const activeTabSections = activeTabMeta.sections
    .map((sectionId) => sections.find((section) => section.id === sectionId))
    .filter(Boolean) as typeof sections;

  const activeSectionContent: Record<SectionId, React.ReactNode> = {
    product: (
      <div className="flex h-full flex-col">
        <CustomSelect
          value={packId}
          onChange={(v) => selectPack(v)}
          rootClassName="w-full"
          options={packs.map((p) => ({ value: p.id, label: `${p.name} — ${p.services.length} services` }))}
        />
      </div>
    ),
    template: (
      <div className="flex h-full flex-col gap-3">
        <CustomSelect
          value={templatePresetId}
          onChange={setTemplatePresetId}
          rootClassName="w-full"
          options={[
            { value: "", label: "Auto-assign (recommended) — rotates so same-product sites look distinct" },
            ...DESIGN_PRESETS.map((t) => ({ value: t.id, label: templateName(t.id) })),
          ]}
        />
        {templatePresetId && TEMPLATE_CATALOG[templatePresetId] && (
          <p className="text-xs text-dim">{TEMPLATE_CATALOG[templatePresetId]!.blurb}</p>
        )}
        <p className="text-[11px] text-faint">Figma templates will appear here once the importer ships; these are starter templates for now.</p>
      </div>
    ),
    identity: (
      <div className="space-y-4">
        {/* <div>
          <h2 className="font-semibold text-ink">Brand identity</h2>
          <p className="mt-1 text-xs text-dim">Enter core brand details, contact information, and site scale.</p>
        </div> */}
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
            <CustomSelect
              value={siteType}
              onChange={(v) => setSiteType(v as SiteType)}
              options={SITE_TYPES.map((type) => ({ value: type.value, label: `${type.label} — ${type.scale}` }))}
            />
          </Field>
          <Field label="GA4 ID (optional)"><input className="input" value={ga4} onChange={(e) => setGa4(e.target.value)} placeholder="G-XXXXXXX" /></Field>
        </div>
      </div>
    ),
    brief: (
      <div className="space-y-4">
    
        <textarea
          className="input min-h-[110px]"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. Family-owned since 1998, eco-friendly low-VOC paints, same-week scheduling."
        />
      </div>
    ),
    domain: (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setDomainMode("have");
              setRegisterAfter(false);
              setDomainQuote(null);
            }}
            className={`pill border px-3 py-1 ${domainMode === "have" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}
          >
            I have a domain
          </button>
          <button
            type="button"
            onClick={() => setDomainMode("find")}
            className={`pill border px-3 py-1 ${domainMode === "find" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}
          >
            Find and register one
          </button>
        </div>
        {domainMode === "have" ? (
          <p className="text-sm text-dim">
            Using <span className="font-mono text-ink">{domain}</span> - edit it in <b>Brand identity</b>.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                className="input"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setDomainQuote(null);
                  setRegisterAfter(false);
                }}
                placeholder="yourbrand.com"
              />
              <button
                type="button"
                className="btn-ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setDomainNote(null);
                    const quote = await checkDomainAction(domain);
                    setDomainQuote(quote);
                    setSuggestionsPage(0);
                  })
                }
              >
                Check
              </button>
            </div>
            {domainQuote && (
              <div className="space-y-3 rounded-lg border border-line bg-canvas px-4 py-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-ink">{domainQuote.domain}</span>
                  {domainQuote.available ? (
                    <span className="pill bg-ok/12 text-ok">available - ${domainQuote.priceUsd}/yr</span>
                  ) : (
                    <span className="pill bg-bad/12 text-bad">taken</span>
                  )}
                </div>
                {domainQuote.available ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setRegisterAfter(true);
                      setDomainNote(`Will register ${domainQuote.domain} on create.`);
                    }}
                  >
                    Use and register (simulated)
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="text-xs text-dim">Available alternatives:</div>
                    {(() => {
                      const suggestionsList = domainQuote.suggestions?.filter((suggestion: any) => suggestion.available) ?? [];
                      const currentSuggestions = suggestionsList.slice(suggestionsPage * 14, (suggestionsPage + 1) * 14);
                      const sugRow1 = currentSuggestions.slice(0, 7);
                      const sugRow2 = currentSuggestions.slice(7, 14);
                      return (
                        <>
                          {sugRow1.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {sugRow1.map((suggestion: any) => (
                                <button
                                  key={suggestion.domain}
                                  type="button"
                                  className="text-xs text-accent hover:underline border border-line bg-white rounded-md px-2.5 py-1 transition-all"
                                  onClick={() => {
                                    setDomain(suggestion.domain);
                                    setRegisterAfter(true);
                                    setDomainQuote(null);
                                    setDomainNote(`Will register ${suggestion.domain} on create.`);
                                  }}
                                >
                                  {suggestion.domain} (${suggestion.priceUsd})
                                </button>
                              ))}
                            </div>
                          )}
                          {sugRow2.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {sugRow2.map((suggestion: any) => (
                                <button
                                  key={suggestion.domain}
                                  type="button"
                                  className="text-xs text-accent hover:underline border border-line bg-white rounded-md px-2.5 py-1 transition-all"
                                  onClick={() => {
                                    setDomain(suggestion.domain);
                                    setRegisterAfter(true);
                                    setDomainQuote(null);
                                    setDomainNote(`Will register ${suggestion.domain} on create.`);
                                  }}
                                >
                                  {suggestion.domain} (${suggestion.priceUsd})
                                </button>
                              ))}
                            </div>
                          )}
                          {suggestionsList.length > 14 && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setSuggestionsPage((p) => Math.max(0, p - 1))}
                                disabled={suggestionsPage === 0}
                                className="p-1 rounded-md border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                              </button>
                              <span className="text-xs text-faint font-medium">
                                Page {suggestionsPage + 1} of {Math.ceil(suggestionsList.length / 14)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSuggestionsPage((p) => Math.min(Math.ceil(suggestionsList.length / 14) - 1, p + 1))}
                                disabled={(suggestionsPage + 1) * 14 >= suggestionsList.length}
                                className="p-1 rounded-md border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
            {domainNote && <p className="text-xs text-ok">{domainNote}</p>}
            <p className="text-[11px] text-faint">Registration is simulated. No real purchase occurs.</p>
          </>
        )}
      </div>
    ),
    assets: (
      <div className="space-y-4">
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Logo (image)</label>
            <input type="file" accept="image/*" className="text-xs" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
            {logoFile && <p className="mt-1 text-xs text-ok">Loaded: {logoFile.name}</p>}
          </div>
          <div>
            <label className="label">Document / image (optional)</label>
            <input type="file" className="text-xs" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
            {docFile && <p className="mt-1 text-xs text-ok">Loaded: {docFile.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">About-us text</label>
            <textarea
              className="input min-h-[90px]"
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              placeholder="Tell the story of the business - used to write the About page."
            />
          </div>
        </div>
      </div>
    ),
    services: (
      <div className="space-y-2.5">
        {(() => {
          const servicesList = pack?.services ?? [];
          const currentServices = servicesList.slice(servicesPage * 14, (servicesPage + 1) * 14);
          const row1 = currentServices.slice(0, 7);
          const row2 = currentServices.slice(7, 14);
          return (
            <>
              {row1.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {row1.map((service) => (
                    <button
                      key={service.slug}
                      type="button"
                      onClick={() => toggleService(service.slug)}
                      className={`pill border px-3 py-1.5 text-xs transition-all ${
                        serviceSlugs.includes(service.slug)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-line bg-white text-dim hover:bg-raised/40"
                      }`}
                    >
                      {service.name}
                    </button>
                  ))}
                </div>
              )}
              {row2.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {row2.map((service) => (
                    <button
                      key={service.slug}
                      type="button"
                      onClick={() => toggleService(service.slug)}
                      className={`pill border px-3 py-1.5 text-xs transition-all ${
                        serviceSlugs.includes(service.slug)
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-line bg-white text-dim hover:bg-raised/40"
                      }`}
                    >
                      {service.name}
                    </button>
                  ))}
                </div>
              )}
              {servicesList.length > 14 && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setServicesPage((p) => Math.max(0, p - 1))}
                    disabled={servicesPage === 0}
                    className="p-1 rounded-md border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-xs text-faint font-medium">
                    Page {servicesPage + 1} of {Math.ceil(servicesList.length / 14)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServicesPage((p) => Math.min(Math.ceil(servicesList.length / 14) - 1, p + 1))}
                    disabled={(servicesPage + 1) * 14 >= servicesList.length}
                    className="p-1 rounded-md border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    ),
    geography: (
      <div className="space-y-4">
      
        <GeoSelect value={geo} onChange={setGeo} />
      </div>
    ),
    url: (
      <div className="space-y-4">
      
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setUrlMode("preset")}
            className={`pill border px-3 py-1 ${urlMode === "preset" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}
          >
            Preset
          </button>
          <button
            type="button"
            onClick={() => setUrlMode("custom")}
            className={`pill border px-3 py-1 ${urlMode === "custom" ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}
          >
            Custom builder
          </button>
        </div>
        {urlMode === "preset" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {URL_PRESETS.map((preset) => (
              <label
                key={preset.pattern}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-xs transition-colors ${
                  urlPattern === preset.pattern ? "border-primary bg-primary/5 text-primary" : "border-line bg-white hover:bg-raised/40"
                }`}
              >
                <input type="radio" name="urlpat" checked={urlPattern === preset.pattern} onChange={() => setUrlPattern(preset.pattern)} className="accent-primary" />
                <span className="mono font-semibold">{preset.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <div>
            <input className="input mono" value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} placeholder="/services/{service}/{city}" />
            <p className="mt-1 text-xs text-faint">Use tokens <span className="mono">{"{service}"}</span> and <span className="mono">{"{city}"}</span>. Lowercase, slash, and hyphen only.</p>
            {urlError && <p className="mt-1 text-xs text-bad">{urlError}</p>}
          </div>
        )}
        <div className="rounded-md border border-line bg-canvas px-3 py-2">
          <span className="text-xs text-faint">Example: </span>
          <span className="mono text-sm text-primary">{previewUrl(domain, urlPattern)}</span>
        </div>
      </div>
    ),
    blog: (
      <div className="space-y-4">
        {blog.enabled && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cadence">
                <CustomSelect
                  value={blog.cadence}
                  onChange={(v) => setBlog({ ...blog, cadence: v as Cadence })}
                  rootClassName="max-w-[240px]"
                  options={CADENCES.map((cadence) => ({ value: cadence.value, label: cadence.label }))}
                />
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
              <span className="text-faint"> - Example: </span>
              <span className="mono text-primary">{(domain || "yoursite.com").replace(/^https?:\/\//, "")}{blog.postPattern.replace("{slug}", "cabinet-painting-cost")}</span>
            </div>
            {blogError && <p className="text-xs text-bad">{blogError}</p>}
          </div>
        )}
      </div>
    ),
    rollout: (
      <div className="space-y-4">
        
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Launch wave size (6-10 indexable)"><input className="input" type="number" value={launchSize} onChange={(e) => setLaunchSize(Number(e.target.value))} /></Field>
          <Field label="Daily cap"><input className="input" type="number" value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} /></Field>
          <Field label="Weekly targets (comma)"><input className="input" value={weeklyTargets} onChange={(e) => setWeeklyTargets(e.target.value)} /></Field>
          <Field label="Timezone"><input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></Field>
        </div>
      </div>
    ),
  };

  return (
    <div className="space-y-4 pb-32">
      {/* Tab Row Container */}
      <div className="sticky top-16 z-20 bg-[#F8FAFC] py-1.5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-5 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors shrink-0 min-w-[160px] sm:min-w-0 ${
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-line bg-white hover:bg-raised/50"
                }`}
              >
                {tabIcon(tab.id, `w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-faint"}`)}
                <span className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-dim"}`}>
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Foundation tab: 2-col side-by-side layout */}
      {activeTab === "foundation" ? (
        <div className="grid items-stretch gap-3 sm:grid-cols-2">
          {activeTabSections.map((section) => (
            <section key={section.id} className="card flex h-full min-h-[228px] flex-col p-0">
              {/* Section header */}
              <div className="flex items-start justify-between gap-3 border-b border-line/60 px-5 pt-4 pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-faint tabular-nums shrink-0">{section.number}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-none text-ink">{section.title}</h3>
                    <p className="mt-1 text-xs text-dim leading-snug">{section.description}</p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
                  {section.summary && (
                    <span className="mt-0.5 hidden truncate text-xs text-faint sm:inline max-w-[140px]">{section.summary}</span>
                  )}
                </div>
              </div>
              {/* Section body */}
              <div className="flex flex-1 flex-col px-5 py-4">
                {activeSectionContent[section.id]}
              </div>
              <div className="mt-auto flex items-end justify-between border-t border-line/60 px-5 py-4">
                {section.id === "product" ? (
                  <a
                    href="/packs/import"
                    className="btn-ghost btn-sm h-9 justify-start border-line text-primary"
                  >
                    Import from Excel
                  </a>
                ) : (
                  <span />
                )}
                {section.id === "template" ? (
                  <a
                    href="/templates"
                    className="btn-ghost btn-sm h-9 justify-start border-line text-primary"
                  >
                    Manage templates
                  </a>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {activeTabSections.map((section) => (
            <section key={section.id} className="rounded-lg border border-line bg-white">
              {/* Section header */}
              <div className={`flex items-start justify-between gap-3 px-5 ${section.id === "blog" ? "pt-3 pb-2" : "pt-4 pb-3 border-b border-line/60"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-faint tabular-nums shrink-0">{section.number}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-ink leading-none">{section.title}</h3>
                    <p className="mt-1 text-xs text-dim leading-snug">{section.description}</p>
                  </div>
                </div>
                <div className="shrink-0 flex max-w-[220px] flex-col items-end text-right">
                  {section.id !== "blog" && section.summary && (
                    <span className="mt-0.5 hidden max-w-[220px] truncate text-xs text-faint sm:inline">{section.summary}</span>
                  )}
                  {section.id === "blog" && (
                    <button
                      type="button"
                      aria-pressed={blog.enabled}
                      onClick={() => setBlog((current) => ({ ...current, enabled: !current.enabled }))}
                      className={`mt-1.5 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                        blog.enabled ? "border-primary/30 bg-primary/8 text-primary" : "border-line bg-white text-dim hover:text-ink"
                      }`}
                    >
                      <span className={`relative h-5 w-9 rounded-full transition-colors ${blog.enabled ? "bg-primary" : "bg-line"}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${blog.enabled ? "left-[18px]" : "left-0.5"}`} />
                      </span>
                      {blog.enabled ? "Blog enabled" : "Enable blog"}
                    </button>
                  )}
                </div>
              </div>
              {/* Section body — expands naturally with content */}
              <div className={section.id === "blog" ? "px-5 pt-1 pb-3" : "px-5 py-4"}>
                {activeSectionContent[section.id]}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Error & Progress Feedback */}
      <div className="space-y-2">
        {error && <p className="text-sm text-bad">{error}</p>}
        {status && <p className="text-sm text-data">{status}</p>}
      </div>

      {/* Fixed Bottom Bar — estimate stats only */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white/97 shadow-[0_-2px_8px_rgba(16,24,40,0.06)] backdrop-blur md:left-[72px] xl:left-[220px]"
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex shrink-0 flex-col gap-2 xl:w-[280px]">
              <button
                type="button"
                onClick={() => setActiveTab("foundation")}
                className="flex items-center gap-3 text-left transition-opacity hover:opacity-80 shrink-0"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line">
                  <img
                    src="/brand_thumbnail.jpg"
                    alt="Product thumbnail"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <span className="block max-w-[220px] truncate font-semibold text-sm text-ink">
                    {pack?.name ?? "-"}
                  </span>
                  <span className="block text-xs text-faint">Current page plan estimate</span>
                </div>
              </button>

              {!requiresGenerateConfirmation && (
                <button
                  onClick={submit}
                  disabled={pending}
                  className="btn flex h-10 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm shadow-sm"
                >
                  {pending ? (
                    "Working..."
                  ) : (
                    <>
                      <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="m12 3-1.912 5.886L4 9l5.886 1.912L12 17l1.912-5.886L20 9l-5.886-1.912L12 3Z" />
                        <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
                      </svg>
                      <span>Create brand & page plan</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="hidden h-6 w-px shrink-0 bg-line xl:block" />

            <div
              className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden md:pb-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <EstimatePill
                label="Services"
                value={String(serviceSlugs.length)}
                onClick={() => setActiveTab("services-assets")}
                icon={
                  <svg className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                }
              />
              <EstimatePill
                label="Cities"
                value={String(cityNames.length)}
                onClick={() => setActiveTab("targeting-structure")}
                icon={
                  <svg className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                }
              />
              <EstimatePill
                label="ZIPs"
                value={String(geo.zips.length)}
                onClick={() => setActiveTab("targeting-structure")}
                icon={
                  <svg className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
              />
              <EstimatePill
                label="Pages"
                value={String(pageCount)}
                onClick={() => setActiveTab("publishing-launch")}
                icon={
                  <svg className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                }
              />
              <EstimatePill
                label="Est. cost"
                value={`$${estCost}`}
                onClick={() => setActiveTab("publishing-launch")}
                icon={
                  <svg className="w-4 h-4 text-dim" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
              />
            </div>

            <div className="flex shrink-0 flex-col gap-2 xl:ml-3 xl:w-[320px] xl:items-end">
              {requiresGenerateConfirmation && (
                <div className="w-full">
                  <p className="mb-1.5 text-xs font-medium text-warn xl:text-right">
                    Large batch ({pageCount} pages, ~${estCost}). Type <b>GENERATE</b> to confirm.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
                    <input
                      className="input h-10 w-full py-0 text-sm sm:flex-1 xl:max-w-[160px] xl:text-center"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="GENERATE"
                    />
                    <button
                      onClick={submit}
                      disabled={pending || !generateConfirmed}
                      className="btn flex h-10 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm shadow-sm sm:w-auto"
                    >
                      {pending ? (
                        "Working..."
                      ) : (
                        <>
                          <svg className="h-4 w-4 shrink-0 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <path d="m12 3-1.912 5.886L4 9l5.886 1.912L12 17l1.912-5.886L20 9l-5.886-1.912L12 3Z" />
                            <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
                          </svg>
                          <span>Create brand & page plan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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

function EstimatePill({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm transition-colors hover:bg-raised/40 shadow-xs"
    >
      {icon}
      <span className="text-dim text-xs">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: SectionStatus }) {
  const config: Record<SectionStatus, { icon: string; label: string; tone: string }> = {
    completed: { icon: "✓", label: "completed", tone: "text-ok" },
    active: { icon: "●", label: "active", tone: "text-primary" },
    untouched: { icon: "○", label: "untouched", tone: "text-faint" },
    optional: { icon: "—", label: "optional", tone: "text-dim" },
    error: { icon: "!", label: "validation error", tone: "text-bad" },
  };
  const current = config[status];
  return <span className={`shrink-0 text-[11px] font-medium ${current.tone}`}>{current.icon} {current.label}</span>;
}

function CustomSelect({
  value,
  onChange,
  options,
  rootClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  rootClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative w-full ${rootClassName ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-white px-3 text-left transition-colors hover:bg-raised/40"
      >
        <span className="truncate text-sm text-ink">{selected?.label}</span>
        <svg
          className={`w-4 h-4 text-faint shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Options list — inline, pushes card height */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-md border border-line bg-white shadow-lg [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                opt.value === value
                  ? "bg-primary/5 text-primary font-medium"
                  : "text-ink hover:bg-raised/60"
              }`}
            >
              {opt.value === value && (
                <svg className="w-3.5 h-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="m5 12 5 5L20 7" />
                </svg>
              )}
              <span className={opt.value === value ? "" : "ml-5"}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
