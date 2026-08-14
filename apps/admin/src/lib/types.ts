// Shared domain types. Content is represented as TYPED BLOCKS (spec §8.2) so that
// templates and models can change independently.

export type PageType =
  | "HOME" | "SERVICE" | "CITY" | "MONEY"
  | "FAQ" | "ABOUT" | "CONTACT" | "PRIVACY" | "TERMS" | "TCPA"
  | "BLOG_INDEX" | "BLOG_POST";

export type TemplateFamily = "aurora" | "meridian";

export interface Block {
  type:
    | "hero" | "richText" | "serviceGrid" | "featureList"
    | "faq" | "cta" | "leadForm" | "legal" | "localContext";
  [k: string]: unknown;
}

export interface HeroBlock extends Block {
  type: "hero";
  eyebrow: string;
  headline: string;
  subhead: string;
  ctaLabel: string;
  imageRef: string;
}
export interface RichTextBlock extends Block {
  type: "richText";
  heading?: string;
  paragraphs: string[];
}
export interface ServiceGridBlock extends Block {
  type: "serviceGrid";
  heading: string;
  items: { title: string; body: string; href: string }[];
}
export interface FeatureListBlock extends Block {
  type: "featureList";
  heading: string;
  items: string[];
}
export interface FaqBlock extends Block {
  type: "faq";
  heading: string;
  items: { q: string; a: string }[];
}
export interface CtaBlock extends Block {
  type: "cta";
  headline: string;
  buttonLabel: string;
}
export interface LeadFormBlock extends Block {
  type: "leadForm";
  heading: string;
  intro: string;
}
export interface LegalBlock extends Block {
  type: "legal";
  heading: string;
  paragraphs: string[];
}
export interface LocalContextBlock extends Block {
  type: "localContext";
  heading: string;
  facts: { label: string; value: string }[];
}

export interface PageMetadata {
  title: string;
  description: string;
  canonicalPath: string;
}

export interface GeneratedPage {
  blocks: Block[];
  metadata: PageMetadata;
  schemaPayload: Record<string, unknown>;
  meaningfulText: string; // used for exact-dup hash + embedding
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// ---- Vertical pack (data-driven config, loaded from DB) ----
export interface PackService { slug: string; name: string; hint: string }
export interface PageBlueprint {
  type: PageType;
  pathTemplate: string;
  priority: number;
  scope: "single" | "perService" | "perCity" | "perServiceCity";
  dependsOn: string[];
  legal?: boolean;
}
export interface VerticalPackConfig {
  key: string;
  version: number;
  name: string;
  vocabulary: Record<string, unknown>;
  services: PackService[];
  pageBlueprints: PageBlueprint[];
  allowedClaims: string[];
  prohibitedClaims: string[];
  requiredLocalFacts: string[];
  faq: { q: string; a: string }[];
  imagery: { heroThemes: string[]; categories: string[] };
}

// ---- Brand profile (stored on brands.profile) ----
export interface BrandProfile {
  tagline: string;
  tone: string;            // e.g. "warm, reassuring"
  voiceAdjectives: string[];
  ctaStyle: string;        // e.g. "Get my free quote"
  palette: { bg: string; surface: string; text: string; primary: string; accent: string };
  typography: { heading: string; body: string };
  phone: string;
  email: string;
  addressCity: string;
  yearsInBusiness: number;
  licenseRef: string;
  services: string[];      // selected service slugs
  cities: string[];        // selected city names (drive CITY + MONEY pages)
  states?: string[];       // selected state codes (targeting metadata)
  zips?: string[];         // selected ZIP codes (targeting metadata)
  analytics: { ga4?: string };
}
