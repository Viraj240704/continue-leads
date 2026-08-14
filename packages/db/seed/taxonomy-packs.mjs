import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BLUEPRINTS = [
  { type: "HOME", pathTemplate: "/", priority: 10, scope: "single", dependsOn: [] },
  { type: "CONTACT", pathTemplate: "/contact", priority: 20, scope: "single", dependsOn: ["HOME"] },
  { type: "SERVICE", pathTemplate: "/services/{service}", priority: 30, scope: "perService", dependsOn: ["HOME"] },
  { type: "CITY", pathTemplate: "/areas/{city}", priority: 40, scope: "perCity", dependsOn: ["HOME"] },
  { type: "MONEY", pathTemplate: "/services/{service}/{city}", priority: 50, scope: "perServiceCity", dependsOn: ["SERVICE", "CITY"] },
  { type: "FAQ", pathTemplate: "/faq", priority: 60, scope: "single", dependsOn: ["HOME"] },
  { type: "ABOUT", pathTemplate: "/about", priority: 70, scope: "single", dependsOn: ["HOME"] },
  { type: "PRIVACY", pathTemplate: "/privacy", priority: 80, scope: "single", legal: true, dependsOn: [] },
  { type: "TERMS", pathTemplate: "/terms", priority: 81, scope: "single", legal: true, dependsOn: [] },
  { type: "TCPA", pathTemplate: "/tcpa-disclosure", priority: 82, scope: "single", legal: true, dependsOn: [] },
];

function titleCase(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function genericPack(category) {
  const craft = category.name.toLowerCase();
  return {
    key: category.slug,
    version: 1,
    name: category.name,
    vocabulary: {
      actor: `${category.name} specialists`,
      craft,
      unit: "project",
      verbs: ["inspect", "plan", "install", "repair", "finish"],
      materials: ["professional-grade materials", "manufacturer-approved products", "jobsite protection"],
      adjectives: ["reliable", "detail-focused", "code-conscious", "professional"],
    },
    services: [],
    pageBlueprints: DEFAULT_BLUEPRINTS,
    allowedClaims: [
      `Licensed and insured ${craft} contractor`,
      "Free written estimates",
      "Clear project scope and timeline",
      "Workmanship backed by documented process",
    ],
    prohibitedClaims: [
      "cheapest in {city}",
      "guaranteed #1 on Google",
      "lifetime free service",
      "government approved",
    ],
    requiredLocalFacts: ["service_area_cities", "years_in_business", "license_reference"],
    faq: [
      {
        q: `How do I know if I need ${craft} help?`,
        a: `Common signs include visible wear, performance issues, or unfinished work. We confirm scope with an on-site review in {city}.`,
      },
      {
        q: `Do you provide free ${craft} estimates?`,
        a: "Yes. We provide a written estimate after reviewing the project requirements and site conditions.",
      },
      {
        q: `What should I expect during a typical ${craft} project?`,
        a: `Most {service} projects in {city} begin with planning and material confirmation, followed by clear scheduling and cleanup expectations.`,
      },
    ],
    imagery: {
      heroThemes: [category.slug, `${category.slug}-crew`, `${category.slug}-detail`, `${category.slug}-finished-project`],
      categories: ["completed-project", "crew", "detail-work"],
    },
  };
}

function serviceHint(serviceName, categoryName) {
  return `${serviceName} for ${categoryName.toLowerCase()} projects`;
}

export function loadHomeImprovementTaxonomy() {
  return JSON.parse(readFileSync(join(__dirname, "home-improvement-taxonomy.json"), "utf8"));
}

export function buildTaxonomyPacks(existingPacksByKey = new Map()) {
  const taxonomy = loadHomeImprovementTaxonomy();
  const serviceByCode = new Map(taxonomy.services.map((service) => [service.code, service]));
  const questionsByServiceCode = new Map();
  for (const question of taxonomy.questions) {
    const list = questionsByServiceCode.get(question.serviceCode) ?? [];
    list.push({
      order: question.order,
      attributeKey: question.attributeKey,
      questionText: question.questionText,
      answers: question.answers,
      categories: question.categories,
    });
    questionsByServiceCode.set(question.serviceCode, list);
  }

  const mappingsByCategory = new Map();
  for (const mapping of taxonomy.mappings) {
    const list = mappingsByCategory.get(mapping.category) ?? [];
    list.push(mapping);
    mappingsByCategory.set(mapping.category, list);
  }

  return taxonomy.categories
    .map((category) => {
      const base = existingPacksByKey.get(category.slug) ? clone(existingPacksByKey.get(category.slug)) : genericPack(category);
      const mappings = mappingsByCategory.get(category.name) ?? [];
      const services = Array.from(
        new Map(
          mappings
            .map((mapping) => {
              const service = serviceByCode.get(mapping.serviceCode);
              if (!service) return null;
              return [
                service.slug,
                {
                  slug: service.slug,
                  name: service.name,
                  hint: serviceHint(service.name, category.name),
                },
              ];
            })
            .filter(Boolean)
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name));

      return {
        ...base,
        key: category.slug,
        version: 1,
        name: base.name || category.name,
        vocabulary: base.vocabulary || genericPack(category).vocabulary,
        services,
        pageBlueprints: base.pageBlueprints || DEFAULT_BLUEPRINTS,
        allowedClaims: base.allowedClaims || genericPack(category).allowedClaims,
        prohibitedClaims: base.prohibitedClaims || genericPack(category).prohibitedClaims,
        requiredLocalFacts: base.requiredLocalFacts || genericPack(category).requiredLocalFacts,
        faq: base.faq || genericPack(category).faq,
        imagery: base.imagery || genericPack(category).imagery,
        taxonomyCategory: {
          vertical: taxonomy.vertical,
          name: category.name,
          slug: category.slug,
          aliases: category.aliases ? category.aliases.split(",").map((value) => titleCase(value.trim())).filter(Boolean) : [],
          serviceCodes: mappings.map((mapping) => mapping.serviceCode),
          questionCountsByService: Object.fromEntries(
            mappings.map((mapping) => [mapping.serviceCode, (questionsByServiceCode.get(mapping.serviceCode) ?? []).length])
          ),
        },
      };
    })
    .filter((pack) => pack.services.length > 0);
}
