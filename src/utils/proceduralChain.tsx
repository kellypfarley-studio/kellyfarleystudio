import React from "react";
import { SPHERE_RADIUS_IN } from "./previewGeometry";

export type Pt = { x: number; y: number };

function buildCumulative(points: Pt[]) {
  const cum: number[] = new Array(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  return cum;
}

function sampleAt(points: Pt[], cum: number[], s: number): Pt {
  if (s <= 0) return points[0];
  const n = points.length;
  const total = cum[n - 1];
  if (s >= total) return points[n - 1];
  // find segment
  let i = 0;
  while (i < n - 1 && cum[i + 1] < s) i++;
  const segStart = cum[i];
  const segLen = cum[i + 1] - segStart;
  const t = segLen > 0 ? (s - segStart) / segLen : 0;
  const x = points[i].x + (points[i + 1].x - points[i].x) * t;
  const y = points[i].y + (points[i + 1].y - points[i].y) * t;
  return { x, y };
}

export function renderChainAlongPolyline(args: {
  keyPrefix: string;
  points: Pt[];
  linkHeightIn?: number;
  strokeIn?: number;
  linkWidthIn?: number;
  startPhase?: number;
  strokeColor?: string;
}): JSX.Element[] {
  const {
    keyPrefix,
    points,
    linkHeightIn = 1,
    strokeIn = 0.1875,
    linkWidthIn = 0.55,
    startPhase = 0,
    strokeColor = "#111",
  } = args;

  if (!points || points.length === 0) return [];
  if (points.length === 1) return [];

  const cum = buildCumulative(points);
  const total = cum[cum.length - 1];
  if (total <= 1e-6) return [];

  const step = linkHeightIn;
  const out: JSX.Element[] = [];
  let idx = 0;
  for (let s = 0; s <= total + 1e-9; s += step) {
    const p = sampleAt(points, cum, Math.min(s, total));
    // compute small forward/backward sample to estimate tangent
    const delta = Math.min(0.01 * total, 0.1);
    const s1 = Math.max(0, s - delta);
    const s2 = Math.min(total, s + delta);
    const p1 = sampleAt(points, cum, s1);
    const p2 = sampleAt(points, cum, s2);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const theta = (Math.atan2(dy, dx) * 180) / Math.PI;

    const isFront = ((startPhase + idx) % 2) === 0;
    const key = `${keyPrefix}-link-${idx}`;
    // rotate glyphs 90° so the link's top/bottom edge faces the other side
    const ang = theta + 90;
    const transform = `translate(${p.x} ${p.y}) rotate(${ang})`;

    if (isFront) {
      const rx = linkWidthIn / 2;
      const ry = linkHeightIn / 2;
      out.push(
        <g key={key} transform={transform}>
          <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={strokeColor} strokeWidth={strokeIn} />
        </g>
      );
    } else {
      out.push(
        <g key={key} transform={transform}>
          <line x1={0} y1={-linkHeightIn / 2} x2={0} y2={linkHeightIn / 2} stroke={strokeColor} strokeWidth={strokeIn} />
        </g>
      );
    }

    idx++;
  }

  return out;
}

export default renderChainAlongPolyline;


export function renderClaspBetweenPoints(args: {
  key: string;
  // Either supply `x` with `yTop`/`yBot` for legacy vertical clasps,
  // or supply full endpoint coordinates `xTop`,`yTop`,`xBot`,`yBot`.
  x?: number;
  xTop?: number;
  yTop: number; // top sphere center y (already shifted)
  xBot?: number;
  yBot: number; // bottom sphere center y (already shifted)
  strokeColor?: string;
  strokeIn?: number; // 0.1875
  chainHeightIn?: number; // 1.0
  chainWidthIn?: number; // 0.55
  eyeDiaIn?: number; // 0.75
  gapIn?: number; // 2.5
  rotationOffsetDeg?: number; // optional extra rotation applied to the ellipse
}): JSX.Element[] {
  const {
    key,
    x,
    yTop,
    yBot,
    strokeColor = "#111",
    strokeIn = 0.1875,
    chainHeightIn = 1.0,
    chainWidthIn = 0.55,
    eyeDiaIn = 0.75,
    gapIn = 2.5,
  } = args;

  const R = SPHERE_RADIUS_IN; // sphere radius (inches)

  // Determine endpoint coordinates (support legacy x + yTop/yBot)
  let xTopActual = args.xTop ?? args.x ?? 0;
  let xBotActual = args.xBot ?? args.x ?? 0;
  let yTopActual = args.yTop;
  let yBotActual = args.yBot;

  // If y ordering swapped, keep endpoints as provided (we'll compute vector)
  const dx = xBotActual - xTopActual;
  const dy = yBotActual - yTopActual;
  const dist = Math.hypot(dx, dy) || 1e-9;
  const ux = dx / dist;
  const uy = dy / dist;

  // Surface points on each sphere toward the other along the segment
  const topSurfaceX = xTopActual + ux * R;
  const topSurfaceY = yTopActual + uy * R;
  const bottomSurfaceX = xBotActual - ux * R;
  const bottomSurfaceY = yBotActual - uy * R;
  const gap = Math.hypot(bottomSurfaceX - topSurfaceX, bottomSurfaceY - topSurfaceY);
  const GAP_TOLERANCE = 0.25;
  // Warn only once per clasp key to avoid spamming the console on HMR updates
  const warnedClaspKeys: Set<string> = (globalThis as any).__WARNED_CLASP_KEYS__ || new Set<string>();
  (globalThis as any).__WARNED_CLASP_KEYS__ = warnedClaspKeys;
  if (Math.abs(gap - gapIn) > GAP_TOLERANCE) {
    if (!warnedClaspKeys.has(key)) {
      console.warn("Clasp gap mismatch", { key, gap, expected: gapIn });
      warnedClaspKeys.add(key);
    }
  }

  const elems: JSX.Element[] = [];

  // Top eye at top surface point
  elems.push(
    <circle
      key={`${key}-eye-top`}
      cx={topSurfaceX}
      cy={topSurfaceY}
      r={eyeDiaIn / 2}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeIn}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  );

  // Chain link (ellipse) centered between surface points and rotated to align with segment
  const centerX = (topSurfaceX + bottomSurfaceX) / 2;
  const centerY = (topSurfaceY + bottomSurfaceY) / 2;
  const baseAng = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const ang = baseAng + (args.rotationOffsetDeg ?? 0);
  elems.push(
    <g key={`${key}-chain`} transform={`translate(${centerX} ${centerY}) rotate(${ang})`}>
      <ellipse
        cx={0}
        cy={0}
        rx={chainWidthIn / 2}
        ry={chainHeightIn / 2}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeIn}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>,
  );

  // Bottom eye at bottom surface point
  elems.push(
    <circle
      key={`${key}-eye-bot`}
      cx={bottomSurfaceX}
      cy={bottomSurfaceY}
      r={eyeDiaIn / 2}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeIn}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  );

  return elems;
}
