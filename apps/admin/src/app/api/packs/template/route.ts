import { getSession } from "@/lib/auth";

// Downloadable product-pack import template (CSV). One row per product × service.
export async function GET() {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const csv = [
    "product,service_name,hint",
    "Residential Painting,Interior Painting,walls ceilings trim cabinets inside the home",
    "Residential Painting,Exterior Painting,siding stucco trim weatherproofing",
    "HVAC,AC Repair,cooling system diagnosis and repair",
    "HVAC,Furnace Installation,new furnace supply and install",
  ].join("\n") + "\n";
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="product-pack-template.csv"' },
  });
}
