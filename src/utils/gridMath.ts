import type { ProjectSpecs } from "../types/appTypes";

const EPS = 1e-9;

export function getGridOrigin(specs: ProjectSpecs): { ox: number; oy: number } {
  // compute centered origin so grid aligns in center of boundary
  const centerOx = (specs.boundaryWidthIn - Math.floor(specs.boundaryWidthIn / specs.gridSpacingIn) * specs.gridSpacingIn) / 2;
  const centerOy = (specs.boundaryHeightIn - Math.floor(specs.boundaryHeightIn / specs.gridSpacingIn) * specs.gridSpacingIn) / 2;
  return { ox: centerOx, oy: centerOy };
}

export function snapToGridIndex(xIn: number, yIn: number, specs: ProjectSpecs): { col: number; row: number } {
  const { ox, oy } = getGridOrigin(specs);
  const g = specs.gridSpacingIn;
  const colF = (xIn - ox) / g;
  const rowF = (yIn - oy) / g;
  // Use 1-based indices for consistency with stored project format
  const col = Math.round(colF + EPS) + 1;
  const row = Math.round(rowF + EPS) + 1;
  return { col, row };
}

export function gridIndexToWorld(col: number, row: number, specs: ProjectSpecs): { xIn: number; yIn: number } {
  const { ox, oy } = getGridOrigin(specs);
  const g = specs.gridSpacingIn;
  // Expect 1-based indices: convert to 0-based offset
  const xIn = ox + (col - 1) * g;
  const yIn = oy + (row - 1) * g;
  // clamp tiny floating error
  const xClamped = Math.abs(xIn) < EPS ? 0 : xIn;
  const yClamped = Math.abs(yIn) < EPS ? 0 : yIn;
  return { xIn: xClamped, yIn: yClamped };
}

export default {
  getGridOrigin,
  snapToGridIndex,
  gridIndexToWorld,
};
