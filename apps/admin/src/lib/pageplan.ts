import type { BrandProfile, PageType, VerticalPackConfig } from "./types";
import { buildMoneyPath } from "./site-strategy";
import { buildPostPath, initialPostTitles, type BlogConfig } from "./blog";

export interface PlanItem {
  pageType: PageType;
  path: string;
  title: string;
  priority: number;
  context: { service?: string; city?: string };
  dependsOnPaths: string[];
}

export function citySlug(c: string) {
  return c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function homePath() { return "/"; }
function servicePath(slug: string) { return `/services/${slug}`; }
function cityPath(city: string) { return `/areas/${citySlug(city)}`; }
function moneyPath(slug: string, city: string, pattern?: string) {
  return pattern ? buildMoneyPath(pattern, slug, city) : `/services/${slug}/${citySlug(city)}`;
}

/**
 * Deterministic page-plan generator (spec P3). Same pack + brand inputs always
 * produce the same versioned plan; results are diffable. Every page begins noindex.
 */
export function generatePagePlan(pack: VerticalPackConfig, profile: BrandProfile, urlPattern?: string, blog?: BlogConfig): PlanItem[] {
  const services = pack.services.filter((s) => profile.services.includes(s.slug));
  const cities = profile.cities.length ? profile.cities : [profile.addressCity];
  const items: PlanItem[] = [];

  for (const bp of pack.pageBlueprints) {
    switch (bp.scope) {
      case "single": {
        items.push({
          pageType: bp.type,
          path: bp.pathTemplate,
          title: singleTitle(bp.type, pack),
          priority: bp.priority,
          context: {},
          dependsOnPaths: bp.dependsOn.includes("HOME") ? [homePath()] : [],
        });
        break;
      }
      case "perService": {
        for (const s of services) {
          items.push({
            pageType: bp.type,
            path: servicePath(s.slug),
            title: s.name,
            priority: bp.priority,
            context: { service: s.slug },
            dependsOnPaths: [homePath()],
          });
        }
        break;
      }
      case "perCity": {
        for (const city of cities) {
          items.push({
            pageType: bp.type,
            path: cityPath(city),
            title: `${pack.name.split(" ")[0]} in ${city}`,
            priority: bp.priority,
            context: { city },
            dependsOnPaths: [homePath()],
          });
        }
        break;
      }
      case "perServiceCity": {
        for (const s of services) {
          for (const city of cities) {
            items.push({
              pageType: bp.type,
              path: moneyPath(s.slug, city, urlPattern),
              title: `${s.name} in ${city}`,
              priority: bp.priority,
              context: { service: s.slug, city },
              dependsOnPaths: [servicePath(s.slug), cityPath(city)],
            });
          }
        }
        break;
      }
    }
  }

  // Stable ordering: priority asc, then path.
  items.sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path));
  // Blog: a Blog Index + an initial batch of posts (cadence drives future runs).
  if (blog?.enabled) {
    const prefix = blog.urlPrefix || "/blog";
    items.push({
      pageType: "BLOG_INDEX" as PageType,
      path: prefix,
      title: `Blog`,
      priority: 90,
      context: {},
      dependsOnPaths: [homePath()],
    });
    const city = profile.cities[0] ?? profile.addressCity;
    const titles = initialPostTitles(blog.topics ?? [], profile.services ?? [], city, blog.initialPosts ?? 0);
    let pr = 91;
    for (const title of titles) {
      items.push({
        pageType: "BLOG_POST" as PageType,
        path: buildPostPath(blog.postPattern, prefix, title),
        title,
        priority: pr++,
        context: { city },
        dependsOnPaths: [prefix],
      });
    }
  }

  return items;
}

function singleTitle(type: PageType, pack: VerticalPackConfig): string {
  switch (type) {
    case "HOME": return "Home";
    case "CONTACT": return "Contact Us";
    case "FAQ": return "FAQ";
    case "ABOUT": return "About Us";
    case "PRIVACY": return "Privacy Policy";
    case "TERMS": return "Terms of Service";
    case "TCPA": return "TCPA Disclosure";
    default: return pack.name;
  }
}
