import type { ProjectSpecs } from "../types/appTypes";
import type { Anchor } from "../types/appTypes";

/**
 * projectPreview: rotates anchor around center by rotationDeg and returns xIn and depthKey.
 * rotationStrength in [0..1] interpolates between original x and rotated x.
 */
export function projectPreview(
  specs: ProjectSpecs,
  anchor: Anchor,
  rotationDeg: number,
  strength: number,
): { xIn: number; depthKey: number } {
  const cx = specs.boundaryWidthIn / 2;
  const cy = specs.boundaryHeightIn / 2;
  const dx = anchor.xIn - cx;
  const dy = anchor.yIn - cy;
  const theta = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const rotX = dx * c + dy * s;
  const rotDepth = -dx * s + dy * c;
  const xRot = cx + rotX;
  const xFinal = anchor.xIn + (xRot - anchor.xIn) * strength;
  return { xIn: xFinal, depthKey: rotDepth };
}

// Vertical raise constant (in inches)
const DEPTH_RAISE_IN = 0.8;

/**
 * computeYShift: given a depthKey (rotated depth), compute vertical raise in inches.
 * perspectiveFactor scales the effect (1 = default).
 */
export function computeYShift(specs: ProjectSpecs, depthKey: number, perspectiveSlider = 0): number {
  // perspectiveSlider ranges -1..1 with 0 in middle. Map to multiplier and sign:
  // - If slider >= 0: sign = +1, magnitude = 1 + slider (1..2)
  // - If slider <  0: sign = -1, magnitude = 1 + |slider| (1..2), which flips direction for bottom view
  const s = perspectiveSlider ?? 0;
  const sign = s >= 0 ? 1 : -1;
  const mag = 1 + Math.abs(s);

  const maxDist = Math.hypot(specs.boundaryWidthIn / 2, specs.boundaryHeightIn / 2) || 1;
  const normalized = depthKey / maxDist; // -1..1 roughly
  return normalized * DEPTH_RAISE_IN * mag * sign;
}

export default { projectPreview };
