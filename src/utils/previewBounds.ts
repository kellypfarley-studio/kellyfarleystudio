import type { Anchor, Cluster, CustomStrand, ProjectSpecs, Stack, Strand, Swoop } from "../types/appTypes";
import { computeCustomStrandPreview, computeStackPreview, computeStrandPreview, SPHERE_DIAMETER_IN, SPHERE_GAP_IN, SPHERE_PITCH_IN, SPHERE_RADIUS_IN } from "./previewGeometry";
import { projectPreview } from "./rotationProjection";

export type Pt = { x: number; y: number };

// Discrete relaxation used by preview bounds computation (copied from FrontPreviewPanel)
export function buildHangingPolyline(
  p0: Pt,
  p1: Pt,
  totalLength: number,
  pointCount: number,
  iterations: number = 90,
): { pts: Pt[]; cum: number[] } {
  const n = Math.max(2, Math.floor(pointCount));
  const L = Math.max(0, totalLength);
  const segLen = n > 1 ? L / (n - 1) : 0;

  const pts: Pt[] = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t + Math.sin(Math.PI * t) * 0.25 * segLen;
    pts[i] = { x, y };
  }
  pts[0].x = p0.x;
  pts[0].y = p0.y;
  pts[n - 1].x = p1.x;
  pts[n - 1].y = p1.y;

  if (segLen > 0) {
    const g = 0.35;
    const constraintPasses = 6;
    for (let iter = 0; iter < iterations; iter += 1) {
      for (let i = 1; i < n - 1; i += 1) {
        pts[i].y += g;
      }

      for (let pass = 0; pass < constraintPasses; pass += 1) {
        for (let i = 0; i < n - 1; i += 1) {
          const p = pts[i];
          const q = pts[i + 1];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const dist = Math.hypot(dx, dy) || 1e-9;
          const diff = (dist - segLen) / dist;

          const wP = i === 0 ? 0 : 0.5;
          const wQ = i + 1 === n - 1 ? 0 : 0.5;
          const wSum = wP + wQ;
          if (wSum <= 0) continue;

          const corrX = dx * diff;
          const corrY = dy * diff;
          if (wP > 0) {
            p.x += corrX * (wP / wSum);
            p.y += corrY * (wP / wSum);
          }
          if (wQ > 0) {
            q.x -= corrX * (wQ / wSum);
            q.y -= corrY * (wQ / wSum);
          }
        }

        pts[0].x = p0.x;
        pts[0].y = p0.y;
        pts[n - 1].x = p1.x;
        pts[n - 1].y = p1.y;
      }
    }
  }

  const cum: number[] = new Array(n);
  cum[0] = 0;
  for (let i = 1; i < n; i += 1) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  return { pts, cum };
}

export function computePreviewFitBounds(specs: ProjectSpecs, strands: Strand[], anchors: Anchor[], swoops: Swoop[] = [], stacks: Stack[] = [], customStrands: CustomStrand[] = [], clusters: Cluster[] = []) {
  const previews = strands.map((s) => {
    const a = anchors.find((x) => x.id === s.anchorId) ?? null;
    const pv = computeStrandPreview(specs, s.spec);
    return { strand: s, anchor: a, pv };
  });
  const stackPreviews = stacks.map((s) => {
    const a = anchors.find((x) => x.id === s.anchorId) ?? null;
    const pv = computeStackPreview(specs, s.spec, { sphereDiameterIn: specs.materials?.sphereDiameterIn });
    return { stack: s, anchor: a, pv };
  });
  const customPreviews = customStrands.map((s) => {
    const a = anchors.find((x) => x.id === s.anchorId) ?? null;
    const pv = computeCustomStrandPreview(specs, s.spec, { sphereDiameterIn: specs.materials?.sphereDiameterIn });
    return { custom: s, anchor: a, pv };
  });
  const clusterPreviews = clusters.map((c) => {
    const strands = c.spec?.strands ?? [];
    return { cluster: c, strands };
  });

  const r = SPHERE_RADIUS_IN;
  const padX = r + 2;
  const padTop = 2;
  const padBottom = 12;

  let maxDrop = specs.ceilingHeightIn;
  for (const p of previews) {
    maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
  }
  for (const p of stackPreviews) {
    maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
  }
  for (const p of customPreviews) {
    maxDrop = Math.max(maxDrop, p.pv.totalDropIn);
  }
  // estimate cluster drops
  for (const p of clusterPreviews) {
    for (const st of p.strands) {
      const total = Math.max(0, (st.sphereCount ?? 0) + (st.bottomSphereCount ?? 0));
      if (total === 0) continue;
      const sphereD = specs.materials?.sphereDiameterIn ?? SPHERE_DIAMETER_IN;
      const pitch = sphereD + SPHERE_GAP_IN;
      const drop = Math.max(0, st.topChainLengthIn || 0) + sphereD + (total - 1) * pitch;
      maxDrop = Math.max(maxDrop, drop);
    }
  }

  const pvView = specs.previewView ?? { rotationDeg: 0, rotationStrength: 1 };
  for (const s of swoops) {
    const a = anchors.find((x) => x.id === s.aHoleId) ?? null;
    const b = anchors.find((x) => x.id === s.bHoleId) ?? null;
    if (!a || !b) {
      const ctrlY = (s.spec.chainAIn + s.spec.chainBIn) / 2 + s.spec.sagIn;
      maxDrop = Math.max(maxDrop, ctrlY);
      continue;
    }

    const pa = projectPreview(specs, a, pvView.rotationDeg, pvView.rotationStrength);
    const pb = projectPreview(specs, b, pvView.rotationDeg, pvView.rotationStrength);
    const xA = pa.xIn;
    const xB = pb.xIn;
    const yA = Math.max(0, s.spec.chainAIn || 0);
    const yB = Math.max(0, s.spec.chainBIn || 0);

    const sphereR = SPHERE_RADIUS_IN;
    const sphereCount = Math.max(0, Math.floor(s.spec.sphereCount || 0));
    const baseLen = sphereCount <= 1 ? 0 : (sphereCount - 1) * SPHERE_PITCH_IN;
    const breathingRoom = 2 * sphereR;
    const slackIn = Math.max(0, s.spec.sagIn || 0);
    const desiredTotalLen = baseLen + breathingRoom + slackIn;

    const chord = Math.hypot(xB - xA, yB - yA);
    const totalLen = Math.max(chord, desiredTotalLen);
    const nSegments = Math.max(1, Math.ceil(totalLen / SPHERE_PITCH_IN));
    const pointCount = nSegments + 1;

    try {
      const hanging = buildHangingPolyline({ x: xA, y: yA }, { x: xB, y: yB }, totalLen, pointCount, 60);
      const deepest = hanging.pts.reduce((m, p) => Math.max(m, p.y), -Infinity);
      if (isFinite(deepest)) maxDrop = Math.max(maxDrop, deepest + sphereR);
    } catch (e) {
      const ctrlY = (s.spec.chainAIn + s.spec.chainBIn) / 2 + s.spec.sagIn;
      maxDrop = Math.max(maxDrop, ctrlY);
    }
  }

  const minX = -padX;
  const maxX = specs.boundaryWidthIn + padX;
  const minY = -padTop;
  const maxY = maxDrop + padBottom;
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

export default {
  buildHangingPolyline,
  computePreviewFitBounds,
};
