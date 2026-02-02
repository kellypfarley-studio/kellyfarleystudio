import type {
  Anchor,
  PricingDefaults,
  MaterialsDefaults,
  ProjectSpecs,
  ResourcesSummary,
  CostsSummary,
  Strand,
  Swoop,
} from "../types/appTypes";

import { DEFAULT_PRICING, DEFAULT_MATERIALS, DEFAULT_QUOTE } from "../state/defaults";

type MinimalState = {
  strands: Strand[];
  anchors: Anchor[];
  swoops?: Swoop[];
  projectSpecs: ProjectSpecs;
};

export function calcResources(state: MinimalState): ResourcesSummary {
  const { strands, anchors } = state;

  // Strand breakdown for inventory-style readouts
  const strandsBySphereCount: Record<string, number> = {};
  for (const s of strands) {
    const key = String(s.spec?.sphereCount ?? 0);
    strandsBySphereCount[key] = (strandsBySphereCount[key] ?? 0) + 1;
  }
  const strandCount = strands.length;

  const strandSpheres = strands.reduce((acc, s) => acc + (s.spec?.sphereCount ?? 0), 0);
  const swoopSpheres = (state.swoops ?? []).reduce((acc, sw) => acc + (sw.spec?.sphereCount ?? 0), 0);
  const spheres = strandSpheres + swoopSpheres;

  // Clasps rule per spec: per strand with N spheres: (N-1) + 1(anchor clasp) + (bottomChainLengthIn>0 ? 1 : 0)
  // (N-1)+1 simplifies to N
  const strandClasps = strands.reduce((acc, s) => {
    const n = s.spec?.sphereCount ?? 0;
    const bottom = s.spec?.bottomChainLengthIn ?? 0;
    return acc + n + (bottom > 0 ? 1 : 0);
  }, 0);
  // Swoop clasp rule: (N - 1) + 2  => simplifies to N + 1
  const swoopClasps = (state.swoops ?? []).reduce((acc, sw) => {
    const n = sw.spec?.sphereCount ?? 0;
    return acc + (n + 1);
  }, 0);
  const clasps = strandClasps + swoopClasps;

  const holes = spheres; // one hole per sphere (assumption)
  const hangingAnchors = anchors.filter((a) => a.type === "strand").length;
  const canopyFasteners = anchors.filter((a) => a.type === "canopy_fastener").length;

  const strandHoleCount = anchors.filter((a) => a.holeType === "strand" || a.type === "strand").length;
  const fastenerHoleCount = anchors.filter((a) => a.holeType === "fastener" || a.type === "canopy_fastener").length;

  // Chain: sum top + bottom chain lengths (inches) across strands + swoops (chainAIn + chainBIn)
  const totalStrandChainInches = strands.reduce((acc, s) => acc + (s.spec?.topChainLengthIn ?? 0) + (s.spec?.bottomChainLengthIn ?? 0), 0);
  const totalSwoopChainInches = (state.swoops ?? []).reduce((acc, sw) => acc + (sw.spec?.chainAIn ?? 0) + (sw.spec?.chainBIn ?? 0), 0);
  const totalChainInches = totalStrandChainInches + totalSwoopChainInches;
  const chainFeet = totalChainInches / 12;

  // Decorative plates: assume one decorative plate per strand that uses a mound preset
  const decorativePlates = strands.reduce((acc, s) => acc + (s.spec?.moundPreset && s.spec.moundPreset !== "none" ? 1 : 0), 0);

  // Eye screws: use strand hole count
  const eyeScrews = strandHoleCount;

  // Weights: use material defaults from project specs if present, otherwise fallback to our defaults
  const materials: MaterialsDefaults = {
    ...DEFAULT_MATERIALS,
    ...(state.projectSpecs.materials ?? {}),
  };

  const sphereWeight = (materials.sphereWeightLb ?? 0) * spheres;
  const chainWeight = (materials.chainWeightLbPerFoot ?? 0) * chainFeet;
  const claspWeight = (materials.claspWeightLb ?? 0) * clasps;
  const eyeScrewWeight = (materials.eyeScrewWeightLb ?? 0) * eyeScrews;
  const plateWeight = (materials.plateWeightLb ?? 0) * decorativePlates;

  const totalWeightLb = sphereWeight + chainWeight + claspWeight + eyeScrewWeight + plateWeight;

  return {
    spheres,
    clasps,
    holes,
    strandHoleCount,
    fastenerHoleCount,
    strands: strandCount,
    strandsBySphereCount,
    hangingAnchors,
    canopyFasteners,
    chainFeet,
    totalWeightLb,
  };
}

export function calcCosts(state: MinimalState, resources: ResourcesSummary): CostsSummary {
  const pricing: PricingDefaults = {
    ...DEFAULT_PRICING,
    ...(state.projectSpecs.pricing ?? {}),
  };

  const quote = {
    ...DEFAULT_QUOTE,
    ...(state.projectSpecs.quote ?? {}),
  };

  const lineTotals: { [key: string]: number } = {};

  lineTotals.spheres = (resources.spheres ?? 0) * (pricing.sphereUnitCost ?? 0);
  lineTotals.clasps = (resources.clasps ?? 0) * (pricing.claspUnitCost ?? 0);
  if (pricing.eyeScrewUnitCost) {
    lineTotals.eyeScrews = (resources.strandHoleCount ?? 0) * (pricing.eyeScrewUnitCost ?? 0);
  }
  if (pricing.fastenerUnitCost) {
    lineTotals.fasteners = (resources.fastenerHoleCount ?? 0) * (pricing.fastenerUnitCost ?? 0);
  }
  lineTotals.chain = (resources.chainFeet ?? 0) * (pricing.chainCostPerFoot ?? 0);
  // decorative plates: estimate from strands via resources (not directly available here)
  // Try to infer decorative plates as number of strands with mound presets via total holes vs spheres isn't reliable.
  // If pricing includes decorativePlateCost, caller can add this separately; we'll include 0 by default.
  lineTotals.decorativePlates = 0;

  const materialsSubtotal = Object.values(lineTotals).reduce((acc, v) => acc + (v ?? 0), 0);

  const laborSubtotal = pricing.laborCost ?? 0;

  const artistNet = materialsSubtotal + laborSubtotal;

  const showroomNet = artistNet * (quote.showroomMultiplier ?? 1);
  const designerNet = showroomNet * (quote.designerMultiplier ?? 1);

  const total = designerNet;

  return {
    lineTotals,
    materialsSubtotal,
    laborSubtotal,
    artistNet,
    showroomNet,
    designerNet,
    total,
  };
}

export default {
  calcResources,
  calcCosts,
};
