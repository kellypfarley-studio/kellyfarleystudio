import type {
  Anchor,
  PricingDefaults,
  MaterialsDefaults,
  ProjectSpecs,
  ResourcesSummary,
  CostsSummary,
  CustomStrand,
  CustomStrandNode,
  Cluster,
  Pile,
  Stack,
  Strand,
  Swoop,
} from "../types/appTypes";

import { DEFAULT_PRICING, DEFAULT_MATERIALS, DEFAULT_QUOTE } from "../state/defaults";

type MinimalState = {
  strands: Strand[];
  stacks?: Stack[];
  piles?: Pile[];
  customStrands?: CustomStrand[];
  clusters?: Cluster[];
  anchors: Anchor[];
  swoops?: Swoop[];
  projectSpecs: ProjectSpecs;
};

export function calcResources(state: MinimalState): ResourcesSummary {
  const { strands, anchors } = state;
  const stacks = state.stacks ?? [];
  const piles = state.piles ?? [];
  const customStrands = state.customStrands ?? [];
  const clusters = state.clusters ?? [];

  // Strand breakdown for inventory-style readouts
  const strandsBySphereCount: Record<string, number> = {};
  for (const s of strands) {
    const key = String(s.spec?.sphereCount ?? 0);
    strandsBySphereCount[key] = (strandsBySphereCount[key] ?? 0) + 1;
  }
  const strandCount = strands.length;

  const stacksBySphereCount: Record<string, number> = {};
  for (const s of stacks) {
    const key = String(s.spec?.sphereCount ?? 0);
    stacksBySphereCount[key] = (stacksBySphereCount[key] ?? 0) + 1;
  }
  const stackCount = stacks.length;

  const strandSpheres = strands.reduce((acc, s) => acc + (s.spec?.sphereCount ?? 0), 0);
  const stackSpheres = stacks.reduce((acc, s) => acc + (s.spec?.sphereCount ?? 0), 0);
  const customSpheres = customStrands.reduce((acc, cs) => {
    const nodes = cs.spec?.nodes ?? [];
    return acc + nodes.reduce((sum, n) => sum + (n.type === "chain" ? 0 : (n.sphereCount ?? 0)), 0);
  }, 0);
  const clusterSpheres = clusters.reduce((acc, cl) => {
    const strands = cl.spec?.strands ?? [];
    return acc + strands.reduce((sum, st) => sum + (st.sphereCount ?? 0) + (st.bottomSphereCount ?? 0), 0);
  }, 0);
  const swoopSpheres = (state.swoops ?? []).reduce((acc, sw) => acc + (sw.spec?.sphereCount ?? 0), 0);
  const pileSpheres = piles.reduce((acc, p) => acc + ((p.spec?.spheres ?? []).length), 0);
  const spheres = strandSpheres + stackSpheres + customSpheres + clusterSpheres + swoopSpheres + pileSpheres;
  const hangingSpheres = Math.max(0, spheres - pileSpheres);

  // Clasps rule per spec: per strand with N spheres: (N-1) + 1(anchor clasp) + (bottomChainLengthIn>0 ? 1 : 0)
  // (N-1)+1 simplifies to N
  const strandClasps = strands.reduce((acc, s) => {
    const n = s.spec?.sphereCount ?? 0;
    const bottom = s.spec?.bottomChainLengthIn ?? 0;
    return acc + n + (bottom > 0 ? 1 : 0);
  }, 0);
  // Stacks have no clasps between spheres; count zero by default.
  const stackClasps = 0;
  const customClasps = customStrands.reduce((acc, cs) => {
    const nodes = cs.spec?.nodes ?? [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as CustomStrandNode;
      if (n.type === "chain") continue;
      const count = Math.max(0, n.sphereCount ?? 0);
      // clasps between spheres for strand segments only
      if (n.type === "strand") {
        acc += Math.max(0, count - 1);
      }
      // clasp at top/bottom when adjacent to chain segments
      const prev = nodes[i - 1];
      const next = nodes[i + 1];
      if (prev && prev.type === "chain") acc += 1;
      if (next && next.type === "chain") acc += 1;
    }
    return acc;
  }, 0);
  const clusterClasps = clusters.reduce((acc, cl) => {
    const strands = cl.spec?.strands ?? [];
    for (const st of strands) {
      const total = (st.sphereCount ?? 0) + (st.bottomSphereCount ?? 0);
      if (total > 0) {
        acc += Math.max(0, total - 1);
        if ((st.topChainLengthIn ?? 0) > 0) acc += 1;
      }
    }
    return acc;
  }, 0);
  // Swoop clasp rule: (N - 1) + 2  => simplifies to N + 1
  const swoopClasps = (state.swoops ?? []).reduce((acc, sw) => {
    const n = sw.spec?.sphereCount ?? 0;
    return acc + (n + 1);
  }, 0);
  const clasps = strandClasps + stackClasps + customClasps + clusterClasps + swoopClasps;

  const holes = spheres; // one hole per sphere (assumption)
  const hangingAnchors = anchors.filter((a) => a.type === "strand").length;
  const canopyFasteners = anchors.filter((a) => a.type === "canopy_fastener").length;

  const strandHoleCount = anchors.filter((a) => a.holeType === "strand" || a.type === "strand").length;
  const fastenerHoleCount = anchors.filter((a) => a.holeType === "fastener" || a.type === "canopy_fastener").length;

  // Chain: sum top + bottom chain lengths (inches) across strands + swoops (chainAIn + chainBIn)
  const totalStrandChainInches = strands.reduce((acc, s) => acc + (s.spec?.topChainLengthIn ?? 0) + (s.spec?.bottomChainLengthIn ?? 0), 0);
  const totalStackChainInches = stacks.reduce((acc, s) => acc + (s.spec?.topChainLengthIn ?? 0) + (s.spec?.bottomChainLengthIn ?? 0), 0);
  const totalCustomChainInches = customStrands.reduce((acc, cs) => {
    const nodes = cs.spec?.nodes ?? [];
    return acc + nodes.reduce((sum, n) => sum + (n.type === "chain" ? (n.lengthIn ?? 0) : 0), 0);
  }, 0);
  const totalClusterChainInches = clusters.reduce((acc, cl) => {
    const strands = cl.spec?.strands ?? [];
    return acc + strands.reduce((sum, st) => sum + (st.topChainLengthIn ?? 0), 0);
  }, 0);
  const totalSwoopChainInches = (state.swoops ?? []).reduce((acc, sw) => acc + (sw.spec?.chainAIn ?? 0) + (sw.spec?.chainBIn ?? 0), 0);
  // Include mound chain inches: allow numeric presets ("6", "12", etc.) or legacy named presets
  const moundMap: Record<string, number> = { small: 6, medium: 12, large: 24 };
  const totalMoundInches = [...strands, ...stacks].reduce((acc, s) => {
    const preset: any = s.spec?.moundPreset;
    if (!preset || preset === "none") return acc;
    // numeric string like "6" should map to that many inches
    const asNum = Number(preset);
    if (Number.isFinite(asNum) && asNum > 0) return acc + asNum;
    // fallback to named mapping
    return acc + (moundMap[String(preset)] ?? 0);
  }, 0);

  const totalChainInches = totalStrandChainInches + totalStackChainInches + totalCustomChainInches + totalClusterChainInches + totalSwoopChainInches + totalMoundInches;
  const chainFeet = totalChainInches / 12;

  // Decorative plates: assume one decorative plate per strand that uses a mound preset
  const decorativePlates = [...strands, ...stacks].reduce((acc, s) => acc + (s.spec?.moundPreset && s.spec.moundPreset !== "none" ? 1 : 0), 0);

  // Eye screws: use strand hole count
  const eyeScrews = strandHoleCount;

  // Weights: use material defaults from project specs if present, otherwise fallback to our defaults
  const materials: MaterialsDefaults = {
    ...DEFAULT_MATERIALS,
    ...(state.projectSpecs.materials ?? {}),
  };

  // Exclude floor-pile spheres from hanging weight.
  const sphereWeight = (materials.sphereWeightLb ?? 0) * hangingSpheres;
  const chainWeight = (materials.chainWeightLbPerFoot ?? 0) * chainFeet;
  const claspWeight = (materials.claspWeightLb ?? 0) * clasps;
  const eyeScrewWeight = (materials.eyeScrewWeightLb ?? 0) * eyeScrews;
  const plateWeight = (materials.plateWeightLb ?? 0) * decorativePlates;

  const totalWeightLb = sphereWeight + chainWeight + claspWeight + eyeScrewWeight + plateWeight;

  return {
    spheres,
    pileSpheres,
    hangingSpheres,
    clasps,
    holes,
    strandHoleCount,
    fastenerHoleCount,
    strands: strandCount,
    strandsBySphereCount,
    stacks: stackCount,
    stacksBySphereCount,
    customStrands: customStrands.length,
    clusters: clusters.length,
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
