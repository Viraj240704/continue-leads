import type { seeded } from "../rng";

type Rng = ReturnType<typeof seeded>;
export type Vars = Record<string, string>;

export function fill(t: string, v: Vars): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
}

// Pick n distinct, seed-ordered templates from a pool and fill them. Because each
// (brand, page) has its own seed, different pages draw different sentence skeletons —
// so shared word bigrams between pages stay low and the similarity gate can tell
// genuinely distinct pages apart from near-duplicates.
export function compose(rng: Rng, pool: readonly string[], v: Vars, n: number): string {
  return rng.shuffle(pool).slice(0, n).map((t) => fill(t, v)).join(" ");
}
export function composeList(rng: Rng, pool: readonly string[], v: Vars, n: number): string[] {
  return rng.shuffle(pool).slice(0, n).map((t) => fill(t, v));
}

// ---- Sentence pools (placeholders: brand, service, svc, city, actor, craft, adj, adj2, years) ----

export const OPENERS = [
  "When {city} homeowners want {svc} done right the first time, they call {brand}.",
  "{brand} delivers {adj} {svc} to homes and businesses throughout {city}.",
  "For {adj} {svc} in {city}, {brand} brings a crew that treats your property like its own.",
  "Looking for {svc} in {city}? {brand} pairs {adj} workmanship with pricing you can actually read.",
  "{brand} has spent {years} years perfecting {svc} for the {city} area.",
  "Your {city} home deserves {adj} {svc}, and that is exactly what {brand} was built to provide.",
  "From the first call to the final walkthrough, {brand} makes {svc} in {city} feel {adj}.",
  "{brand} is the {city} name behind {adj}, {adj2} {svc} that lasts.",
  "Great {svc} starts with listening, and that is where every {brand} project in {city} begins.",
  "{city} trusts {brand} for {svc} because the work speaks for itself.",
];

export const APPROACH = [
  "Every project begins with an on-site assessment so the scope, materials and timeline are agreed before anyone picks up a tool.",
  "We protect your floors and furnishings, keep the site tidy, and clean up completely when the {svc} is finished.",
  "Our crews are {adj}, background-checked and trained to a single standard so the result is consistent every time.",
  "You get one point of contact from estimate to sign-off, so nothing gets lost between the sales pitch and the actual work.",
  "We use the right materials for the {city} climate rather than whatever is cheapest that week.",
  "Prep is where {svc} is won or lost, so we never rush the parts you cannot see.",
  "We schedule around your life, work in {adj2} stages, and keep you updated at each milestone.",
  "If something is not right, we make it right before we call the job done.",
  "Written estimates spell out exactly what is included, so there are no surprises on the final invoice.",
  "We document the work with photos so you can see the difference, not just take our word for it.",
];

export const LOCAL = [
  "Being based near {city} means shorter response times and a crew that already knows the local housing stock.",
  "We understand the permits, materials and seasonal timing that {city} projects call for.",
  "Neighbors talk, and most of our {city} work comes from referrals we are proud of.",
  "From older homes to new builds, {city} properties each get a plan suited to their age and condition.",
  "We have completed {svc} across {city} and the surrounding communities for {years} years.",
  "Local knowledge is not a slogan for us; it is why our {city} results hold up season after season.",
];

export const OUTCOME = [
  "The result is {svc} that looks {adj} on day one and still holds up years later.",
  "You end up with a finish that raises curb appeal and protects the value of your {city} home.",
  "When we leave, the only trace is {adj2} work and a space that feels brand new.",
  "The goal is simple: {svc} you are glad you paid for and happy to recommend.",
  "Done properly, this is the kind of {svc} you only have to think about once.",
];

export const SERVICE_BODY = [
  "Handled with {adj} attention to detail across {city}.",
  "{svc} planned around your schedule and your budget.",
  "A {adj2} finish backed by a clear written scope.",
  "Local crews, honest timelines, and no surprises.",
  "The {adj} option {city} keeps coming back to.",
  "Prep, protection and cleanup included as standard.",
];

export const HEADLINES = {
  HOME: [
    "{adjCap} {craftCap} for {city} homeowners",
    "{city}'s {adj} choice for {craft}",
    "{craftCap} done right, {city}",
    "Trusted {craft} across {city}",
  ],
  SERVICE: [
    "{service} in {city}",
    "{adjCap} {svc} for {city} homes",
    "{city} {service}, done properly",
  ],
  CITY: [
    "{craftCap} services in {city}",
    "Your {city} {craft} crew",
    "{adjCap} {craft} for {city} neighborhoods",
  ],
  MONEY: [
    "{service} in {city} — free estimate",
    "{adjCap} {svc} for {city} properties",
    "{city} {service} you can count on",
  ],
} as const;
