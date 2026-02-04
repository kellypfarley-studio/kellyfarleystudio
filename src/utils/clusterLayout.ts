import type { ClusterItem, ClusterSpec } from "../types/appTypes";

const GOLDEN_ANGLE = 2.399963229728653; // radians

export function computeClusterLayout(spec: ClusterSpec, countOverride?: number): ClusterItem[] {
  const count = Math.max(0, Math.floor(countOverride ?? spec.strands?.length ?? 0));
  if (count === 0) return [];

  const r = Math.max(0.1, spec.itemRadiusIn || 0.1);
  const maxR = Math.max(r * 2, spec.spreadIn || r * 4);

  const pts: { x: number; y: number }[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const a = i * GOLDEN_ANGLE;
    const rad = Math.min(maxR, r * 2 * Math.sqrt(i + 1));
    pts[i] = { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
  }

  const iterations = 40;
  for (let it = 0; it < iterations; it++) {
    // repel overlaps
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const minD = 2 * r;
        if (d < minD) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          pts[i].x -= nx * push;
          pts[i].y -= ny * push;
          pts[j].x += nx * push;
          pts[j].y += ny * push;
        }
      }
    }

    // mild attraction to origin + clamp
    for (let i = 0; i < count; i++) {
      pts[i].x *= 0.98;
      pts[i].y *= 0.98;
      const d = Math.hypot(pts[i].x, pts[i].y);
      if (d > maxR) {
        const s = maxR / d;
        pts[i].x *= s;
        pts[i].y *= s;
      }
    }
  }

  return pts.map((p) => ({ xIn: p.x, yIn: p.y }));
}

export default { computeClusterLayout };
