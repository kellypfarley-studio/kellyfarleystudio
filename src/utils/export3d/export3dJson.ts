import type { Anchor, CustomStrand, ProjectSpecs, Stack, Strand } from "../../types/appTypes";
import { computeCustomStrandPreview, computeStackPreview, computeStrandPreview } from "../../utils/previewGeometry";

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
  stacks: Array<{
    id: string;
    anchorId: string;
    colorId?: string;
    layer?: string;
    sphereCount: number;
    topChainLengthIn?: number;
    bottomChainLengthIn?: number;
    spheres: Array<{ index: number; xIn: number; yIn: number; zIn: number; diameterIn: number }>;
  }>;
  customStrands: Array<{
    id: string;
    anchorId: string;
    layer?: string;
    nodes?: unknown[];
    spheres: Array<{ index: number; xIn: number; yIn: number; zIn: number; diameterIn: number; kind: "strand" | "stack" }>;
    chains: Array<{ index: number; xIn: number; yIn: number; z1In: number; z2In: number }>;
  }>;
};

/**
 * Build a 3D layout JSON object from the app state.
 * - origin is canopy center on the ceiling plane (x,y centered, z=0 at ceiling)
 * - units are inches; `unitScaleToMeters` is provided for convenience
 */
export function build3dLayoutJson(state: { projectSpecs: ProjectSpecs; anchors: Anchor[]; strands: Strand[]; stacks: Stack[]; customStrands: CustomStrand[] }): Layout3D {
  const { projectSpecs, anchors, strands, stacks, customStrands } = state;

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

  const stacksOut = stacks.map((s) => {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const anchorX = anchor ? anchor.xIn - canopyCenterX : 0;
    const anchorY = anchor ? anchor.yIn - canopyCenterY : 0;

    const sphereD = projectSpecs.materials?.sphereDiameterIn;
    const pv = computeStackPreview(projectSpecs, s.spec, { sphereDiameterIn: sphereD });

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

  const customOut = customStrands.map((s) => {
    const anchor = anchors.find((a) => a.id === s.anchorId) ?? null;
    const anchorX = anchor ? anchor.xIn - canopyCenterX : 0;
    const anchorY = anchor ? anchor.yIn - canopyCenterY : 0;

    const sphereD = projectSpecs.materials?.sphereDiameterIn;
    const pv = computeCustomStrandPreview(projectSpecs, s.spec, { sphereDiameterIn: sphereD });

    const spheres: Array<{ index: number; xIn: number; yIn: number; zIn: number; diameterIn: number; kind: "strand" | "stack" }> = [];
    const chains: Array<{ index: number; xIn: number; yIn: number; z1In: number; z2In: number }> = [];
    let sphereIdx = 0;
    let chainIdx = 0;

    pv.segments.forEach((seg) => {
      if (seg.type === "chain") {
        chains.push({
          index: chainIdx++,
          xIn: Number(anchorX.toFixed(6)),
          yIn: Number(anchorY.toFixed(6)),
          z1In: Number(seg.y1.toFixed(6)),
          z2In: Number(seg.y2.toFixed(6)),
        });
      } else if (seg.type === "strand" || seg.type === "stack") {
        (seg.centersY || []).forEach((centerY) => {
          spheres.push({
            index: sphereIdx++,
            xIn: Number(anchorX.toFixed(6)),
            yIn: Number(anchorY.toFixed(6)),
            zIn: Number(centerY.toFixed(6)),
            diameterIn: Number((projectSpecs.materials?.sphereDiameterIn ?? 0) || 0),
            kind: seg.type,
          });
        });
      }
    });

    return {
      id: s.id,
      anchorId: s.anchorId,
      layer: s.spec?.layer,
      nodes: s.spec?.nodes ?? [],
      spheres,
      chains,
    };
  });

  return {
    unit: "in",
    unitScaleToMeters,
    canopy,
    holes,
    strands: strandsOut,
    stacks: stacksOut,
    customStrands: customOut,
  };
}

export default build3dLayoutJson;
