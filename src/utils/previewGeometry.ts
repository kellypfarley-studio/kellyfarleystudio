import type { CustomStrandNode, CustomStrandSpec, ProjectSpecs, StackSpec, StrandSpec } from "../types/appTypes";

export type StrandPreview = {
  sphereCentersY: number[];
  topChainY1: number;
  topChainY2: number;
  bottomChainY1: number;
  bottomChainY2: number;
  lastSphereBottomY: number;
  sphereSectionHeight: number;
  totalDropIn: number;
  overCeiling: boolean;
};

export type CustomStrandPreview = {
  segments: Array<
    | { type: "chain"; y1: number; y2: number }
    | { type: "strand"; centersY: number[]; colorId: string }
    | { type: "stack"; centersY: number[]; colorId: string }
  >;
  totalDropIn: number;
  overCeiling: boolean;
};

// Sphere geometry constants used by previews (in inches)
export const SPHERE_DIAMETER_IN = 4.5;
export const SPHERE_RADIUS_IN = SPHERE_DIAMETER_IN / 2;
// Gap between sphere surfaces when aligned in a straight strand.
export const SPHERE_GAP_IN = 2.5;
export const SPHERE_PITCH_IN = SPHERE_DIAMETER_IN + SPHERE_GAP_IN; // center-to-center distance

// Backwards-compatible defaults
export const DEFAULT_SPHERE_DIAMETER_IN = SPHERE_DIAMETER_IN;
export const DEFAULT_HARDWARE_SPACING_IN = SPHERE_GAP_IN;

export function spherePitchIn(sphereDiameterIn = DEFAULT_SPHERE_DIAMETER_IN, hardwareSpacingIn = DEFAULT_HARDWARE_SPACING_IN): number {
  return sphereDiameterIn + hardwareSpacingIn;
}

/**
 * Computes vertical geometry for a single strand, in inches, with y=0 at ceiling.
 * This is used only for preview rendering (not BOM math).
 */
export function computeStrandPreview(
  project: ProjectSpecs,
  spec: StrandSpec,
  opts?: { sphereDiameterIn?: number; hardwareSpacingIn?: number },
): StrandPreview {
  const sphereD = opts?.sphereDiameterIn ?? DEFAULT_SPHERE_DIAMETER_IN;
  const r = sphereD / 2;
  const pitch = spherePitchIn(sphereD, opts?.hardwareSpacingIn ?? DEFAULT_HARDWARE_SPACING_IN);

  const centers: number[] = [];
  for (let i = 0; i < spec.sphereCount; i++) {
    // Place spheres immediately after top chain, touching each other by pitch.
    centers.push(spec.topChainLengthIn + r + i * pitch);
  }

  const firstSphereTop = centers.length ? centers[0] - r : spec.topChainLengthIn;
  const lastSphereBottom = centers.length ? centers[centers.length - 1] + r : spec.topChainLengthIn;

  const sphereSectionHeight = spec.sphereCount === 0 ? 0 : sphereD + (spec.sphereCount - 1) * pitch;

  const topChainY1 = 0;
  const topChainY2 = firstSphereTop;

  const bottomChainY1 = lastSphereBottom;
  const bottomChainY2 = lastSphereBottom + spec.bottomChainLengthIn;

  const totalDropIn = bottomChainY2; // y at the end of bottom chain
  const overCeiling = totalDropIn > project.ceilingHeightIn;

  return {
    sphereCentersY: centers,
    sphereSectionHeight,
    topChainY1,
    topChainY2,
    bottomChainY1,
    bottomChainY2,
    lastSphereBottomY: lastSphereBottom,
    totalDropIn,
    overCeiling,
  };
}

/**
 * Computes vertical geometry for a stack (touching spheres, no clasp spacing).
 */
export function computeStackPreview(
  project: ProjectSpecs,
  spec: StackSpec,
  opts?: { sphereDiameterIn?: number },
): StrandPreview {
  return computeStrandPreview(project, spec as StrandSpec, {
    sphereDiameterIn: opts?.sphereDiameterIn,
    hardwareSpacingIn: 0,
  });
}

export function computeCustomStrandPreview(
  project: ProjectSpecs,
  spec: CustomStrandSpec,
  opts?: { sphereDiameterIn?: number; hardwareSpacingIn?: number },
): CustomStrandPreview {
  const sphereD = opts?.sphereDiameterIn ?? DEFAULT_SPHERE_DIAMETER_IN;
  const r = sphereD / 2;
  const gapStrand = opts?.hardwareSpacingIn ?? DEFAULT_HARDWARE_SPACING_IN;

  let y = 0;
  const segments: CustomStrandPreview["segments"] = [];

  const nodes: CustomStrandNode[] = spec.nodes ?? [];
  for (const node of nodes) {
    if (node.type === "chain") {
      const len = Math.max(0, node.lengthIn || 0);
      const y1 = y;
      const y2 = y + len;
      segments.push({ type: "chain", y1, y2 });
      y = y2;
    } else if (node.type === "strand") {
      const count = Math.max(0, Math.floor(node.sphereCount || 0));
      const pitch = sphereD + gapStrand;
      const centers: number[] = [];
      for (let i = 0; i < count; i++) {
        centers.push(y + r + i * pitch);
      }
      if (centers.length) {
        y = centers[centers.length - 1] + r;
      }
      segments.push({ type: "strand", centersY: centers, colorId: node.colorId });
    } else if (node.type === "stack") {
      const count = Math.max(0, Math.floor(node.sphereCount || 0));
      const pitch = sphereD;
      const centers: number[] = [];
      for (let i = 0; i < count; i++) {
        centers.push(y + r + i * pitch);
      }
      if (centers.length) {
        y = centers[centers.length - 1] + r;
      }
      segments.push({ type: "stack", centersY: centers, colorId: node.colorId });
    }
  }

  const totalDropIn = y;
  const overCeiling = totalDropIn > project.ceilingHeightIn;
  return { segments, totalDropIn, overCeiling };
}
