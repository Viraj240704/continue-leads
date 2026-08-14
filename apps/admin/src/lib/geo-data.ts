// Geography reference data: State -> City -> ZIP codes.
// NOTE: this is a representative STARTER SUBSET for the UI. Replace with a full
// US dataset (or load from the DB) for production — the structure stays the same.

export interface GeoState {
  code: string;
  name: string;
  cities: { name: string; zips: string[] }[];
}

export const GEO: GeoState[] = [
  {
    code: "CO", name: "Colorado", cities: [
      { name: "Denver", zips: ["80202", "80203", "80204", "80205", "80206"] },
      { name: "Aurora", zips: ["80010", "80011", "80012", "80013"] },
      { name: "Boulder", zips: ["80301", "80302", "80303"] },
      { name: "Fort Collins", zips: ["80521", "80524", "80525"] },
      { name: "Colorado Springs", zips: ["80903", "80905", "80907"] },
    ],
  },
  {
    code: "TX", name: "Texas", cities: [
      { name: "Austin", zips: ["78701", "78702", "78703", "78704"] },
      { name: "Round Rock", zips: ["78664", "78665", "78681"] },
      { name: "Dallas", zips: ["75201", "75202", "75204", "75206"] },
      { name: "Houston", zips: ["77002", "77004", "77006", "77007"] },
      { name: "San Antonio", zips: ["78205", "78209", "78215"] },
    ],
  },
  {
    code: "CA", name: "California", cities: [
      { name: "Sacramento", zips: ["95814", "95816", "95818"] },
      { name: "San Diego", zips: ["92101", "92103", "92104"] },
      { name: "San Jose", zips: ["95110", "95112", "95113"] },
      { name: "Fresno", zips: ["93701", "93704", "93710"] },
    ],
  },
  {
    code: "FL", name: "Florida", cities: [
      { name: "Miami", zips: ["33125", "33127", "33130"] },
      { name: "Orlando", zips: ["32801", "32803", "32804"] },
      { name: "Tampa", zips: ["33602", "33604", "33606"] },
      { name: "Jacksonville", zips: ["32202", "32204", "32207"] },
    ],
  },
  {
    code: "AZ", name: "Arizona", cities: [
      { name: "Phoenix", zips: ["85003", "85004", "85006"] },
      { name: "Tucson", zips: ["85701", "85705", "85710"] },
      { name: "Mesa", zips: ["85201", "85203", "85205"] },
    ],
  },
  {
    code: "IL", name: "Illinois", cities: [
      { name: "Chicago", zips: ["60601", "60602", "60605", "60607"] },
      { name: "Naperville", zips: ["60540", "60563", "60564"] },
      { name: "Springfield", zips: ["62701", "62702", "62704"] },
    ],
  },
];

export const GEO_BY_STATE = Object.fromEntries(GEO.map((s) => [s.code, s]));

// Flatten "STATE|City" -> zips for validation / template parsing.
export function findCity(stateCode: string, city: string) {
  const st = GEO_BY_STATE[stateCode.toUpperCase()];
  if (!st) return null;
  return st.cities.find((c) => c.name.toLowerCase() === city.toLowerCase()) ?? null;
}
