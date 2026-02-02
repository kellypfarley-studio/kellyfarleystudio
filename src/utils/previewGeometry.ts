import type { ProjectSpecs, StrandSpec } from "../types/appTypes";

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
