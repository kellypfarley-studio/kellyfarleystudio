import type { Anchor, ProjectSpecs, Strand } from "../../types/appTypes";
import { computeStrandPreview } from "../../utils/previewGeometry";

export type Layout3D = {
  unit: "in";
  unitScaleToMeters: number;
  canopy: {
    boundaryWidthIn: number;
    boundaryHeightIn: number;
    ceilingHeightIn: number;
    gridSpacingIn: number;
    // origin is canopy center on the ceiling plane
    origin: { xIn: number; yIn: number; zIn: number };
  };
  holes: Array<{
    id: string;
    xIn: number;
    yIn: number;
    holeType?: string;
    strandHoleDiameterIn?: number;
    fastenerHoleDiameterIn?: number;
  }>;
  strands: Array<{
    id: string;
    anchorId: string;
    colorId?: string;
    layer?: string;
    sphereCount: number;
    topChainLengthIn?: number;
    bottomChainLengthIn?: number;
    spheres: Array<{ index: number; xIn: number; yIn: number; zIn: number; diameterIn: number }>;
  }>;
};

/**
 * Build a 3D layout JSON object from the app state.
 * - origin is canopy center on the ceiling plane (x,y centered, z=0 at ceiling)
 * - units are inches; `unitScaleToMeters` is provided for convenience
 */
export function build3dLayoutJson(state: { projectSpecs: ProjectSpecs; anchors: Anchor[]; strands: Strand[] }): Layout3D {
  const { projectSpecs, anchors, strands } = state;

  const unitScaleToMeters = 0.0254;

  const canopyCenterX = projectSpecs.boundaryWidthIn / 2;
  const canopyCenterY = projectSpecs.boundaryHeightIn / 2;

  const canopy = {
    boundaryWidthIn: projectSpecs.boundaryWidthIn,
    boundaryHeightIn: projectSpecs.boundaryHeightIn,
    ceilingHeightIn: projectSpecs.ceilingHeightIn,
    gridSpacingIn: projectSpecs.gridSpacingIn,
    origin: { xIn: 0, yIn: 0, zIn: 0 },
  };

  const holes = anchors.map((a) => ({
    id: a.id,
    xIn: Number((a.xIn - canopyCenterX).toFixed(6)),
    yIn: Number((a.yIn - canopyCenterY).toFixed(6)),
    holeType: a.holeType,
    strandHoleDiameterIn: projectSpecs.strandHoleDiameterIn,
    fastenerHoleDiameterIn: projectSpecs.fastenerHoleDiameterIn,
  }));

  const strandsOut = strands.map((s) => {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const anchorX = anchor ? anchor.xIn - canopyCenterX : 0;
    const anchorY = anchor ? anchor.yIn - canopyCenterY : 0;

    // compute vertical centers from ceiling (z positive downwards)
    const pv = computeStrandPreview(projectSpecs, s.spec);

    const spheres = (pv.sphereCentersY || []).map((centerY, idx) => ({
      index: idx,
      xIn: Number(anchorX.toFixed(6)),
      yIn: Number(anchorY.toFixed(6)),
      zIn: Number(centerY.toFixed(6)),
      diameterIn: Number((projectSpecs.materials?.sphereDiameterIn ?? 0) || 0),
    }));

    return {
      id: s.id,
      anchorId: s.anchorId,
      colorId: s.spec?.colorId,
      layer: s.spec?.layer,
      sphereCount: s.spec?.sphereCount ?? 0,
      topChainLengthIn: s.spec?.topChainLengthIn,
      bottomChainLengthIn: s.spec?.bottomChainLengthIn,
      spheres,
    };
  });

  return {
    unit: "in",
    unitScaleToMeters,
    canopy,
    holes,
    strands: strandsOut,
  };
}

export default build3dLayoutJson;
