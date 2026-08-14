import type { PlanItem } from "./pageplan";

// Rough per-page generation cost estimate (content + a nominal image budget).
// Illustrative Claude-class rate; used for the wizard's cost preview (spec P1/P5).
const AVG_CONTENT_COST = 0.012; // ~ input+output tokens for one structured page
const AVG_IMAGE_COST = 0.02; // nominal asset assignment/optimization budget per page

export function estimatePlanCost(items: PlanItem[]) {
  const pages = items.length;
  const content = pages * AVG_CONTENT_COST;
  const images = pages * AVG_IMAGE_COST;
  const total = content + images;
  return {
    pages,
    contentUsd: round(content),
    imagesUsd: round(images),
    totalUsd: round(total),
  };
}

function round(n: number) { return Math.round(n * 100) / 100; }
