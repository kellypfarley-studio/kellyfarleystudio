import type { ReactElement } from "react";
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
}): ReactElement[] {
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
  const out: ReactElement[] = [];
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


export function renderChainMound(args: {
  keyPrefix: string;
  center: Pt;
  count: number;
  linkHeightIn?: number;
  linkWidthIn?: number;
  strokeIn?: number;
  strokeColor?: string;
}): ReactElement[] {
  const {
    keyPrefix,
    center,
    count,
    linkHeightIn = 1,
    linkWidthIn = 0.55,
    strokeIn = 0.12,
    strokeColor = "#111",
  } = args;

  const out: ReactElement[] = [];
  if (!count || count <= 0) return out;

  // Simple deterministic packing: place links in a spiral with discrete tiers
  const spacing = linkWidthIn * 0.95;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const wide = count >= 12;
  const peaked = count >= 18;
  // Treat 24 as a design-focused shallow, spread-out pyramid; larger counts use 'pyramid' behavior
  const pyramid = count === 24;
  // adjust scales: wider piles spread out, peaked piles are narrower and taller
  let radialScale = wide ? 1.2 : 0.85;
  let tierYScale = wide ? 0.22 : 0.5;
  let verticalSpreadFactor = wide ? 0.08 : 0.14;
  let jitterBase = 0.06;
  if (peaked) {
    radialScale = 0.9; // narrower radius for peaked mound
    tierYScale = 0.6; // taller tiers
    verticalSpreadFactor = 0.28; // allow more vertical variation
    jitterBase = 0.04; // reduce jitter for tighter center
  }
  // For exactly 24 links, make a shallow, spread-out pyramid (design preference)
  if (pyramid) {
    radialScale = 1.2; // spread out
    tierYScale = 0.35; // shallow stacking
    verticalSpreadFactor = 0.12; // less vertical jitter
    jitterBase = 0.04;
  }
  // Special-case 36 to be a shallow, spread-out pyramid (design preference)
  if (count === 36) {
    radialScale = 1.3; // spread out
    tierYScale = 0.35; // shallow stacking
    verticalSpreadFactor = 0.12; // less vertical jitter
    jitterBase = 0.04;
  }

  // For very large piles (37+) make an even tighter, taller pyramid
  const mega = count >= 37;
  if (mega) {
    radialScale = 0.58;
    tierYScale = 1.15;
    verticalSpreadFactor = 0.48;
    jitterBase = 0.01;
  }
  // First compute max tier so we can invert stacking: outer tiers sit at the floor,
  // inner tiers stack upward (peak at center). We'll collect entries and then
  // sort by vertical position so lower links render first.
  const maxTier = Math.floor(Math.sqrt(count));
  type Item = {
    key: string;
    px: number;
    py: number;
    angDeg: number;
    isFront: boolean;
  };
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    const ring = Math.floor(Math.sqrt(i + 1));
    // radius grows with sqrt(i) but scaled for larger mounds
    const r = spacing * Math.sqrt(i + 1) * radialScale;
    const ang = (i * golden) % (Math.PI * 2);
    // slight deterministic jitter so pile looks natural but reproducible
    const jitter = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * jitterBase * spacing;
    const dx = (r + jitter) * Math.cos(ang);
    const dy = (r + jitter) * Math.sin(ang);

    // stack links so outer tiers are at the floor (yOffset = 0) and inner tiers
    // rise upward. This flips the previous behavior that produced an inverted pile.
    const tier = ring;
    const yOffset = (maxTier - tier) * (linkHeightIn * tierYScale);

    const px = center.x + dx;
    const py = center.y - yOffset + dy * verticalSpreadFactor;

    const isFront = i % 2 === 0;
    const angDeg = (ang * 180) / Math.PI + 90 + (i * 11) % 60; // rotation variation
    const key = `${keyPrefix}-mound-${i}`;

    items.push({ key, px, py, angDeg, isFront });
  }

  // Render lower (larger y) items first so upper tiers draw on top.
  items.sort((a, b) => b.py - a.py);
  for (const it of items) {
    const transform = `translate(${it.px} ${it.py}) rotate(${it.angDeg})`;
    if (it.isFront) {
      const rx = linkWidthIn / 2;
      const ry = linkHeightIn / 2;
      out.push(
        <g key={it.key} transform={transform}>
          <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={strokeColor} strokeWidth={strokeIn} />
        </g>
      );
    } else {
      out.push(
        <g key={it.key} transform={transform}>
          <line x1={0} y1={-linkHeightIn / 2} x2={0} y2={linkHeightIn / 2} stroke={strokeColor} strokeWidth={strokeIn} />
        </g>
      );
    }
  }

  return out;
}


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
}): ReactElement[] {
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
  const eyeR = eyeDiaIn / 2;

  // Determine endpoint coordinates (support legacy x + yTop/yBot)
  let xTopActual = args.xTop ?? x ?? 0;
  let xBotActual = args.xBot ?? x ?? 0;
  let yTopActual = yTop;
  let yBotActual = yBot;

  // If y ordering swapped, keep endpoints as provided (we'll compute vector)
  const dx = xBotActual - xTopActual;
  const dy = yBotActual - yTopActual;
  const dist = Math.hypot(dx, dy) || 1e-9;
  const ux = dx / dist;
  const uy = dy / dist;

  // Place eyes just outside the sphere surface so they read as connected hardware.
  const surfaceOffset = R + eyeR;
  const topEyeX = xTopActual + ux * surfaceOffset;
  const topEyeY = yTopActual + uy * surfaceOffset;
  const bottomEyeX = xBotActual - ux * surfaceOffset;
  const bottomEyeY = yBotActual - uy * surfaceOffset;
  const innerGap = Math.hypot(bottomEyeX - topEyeX, bottomEyeY - topEyeY) - eyeDiaIn;
  const GAP_TOLERANCE = 0.25;
  // Warn only once per clasp key to avoid spamming the console on HMR updates
  const warnedClaspKeys: Set<string> = (globalThis as any).__WARNED_CLASP_KEYS__ || new Set<string>();
  (globalThis as any).__WARNED_CLASP_KEYS__ = warnedClaspKeys;
  if (Math.abs(innerGap - gapIn) > GAP_TOLERANCE) {
    if (!warnedClaspKeys.has(key)) {
      console.warn("Clasp gap mismatch", { key, gap: innerGap, expected: gapIn });
      warnedClaspKeys.add(key);
    }
  }

  const elems: ReactElement[] = [];

  // Top eye at top surface point
  elems.push(
    <circle
      key={`${key}-eye-top`}
      cx={topEyeX}
      cy={topEyeY}
      r={eyeDiaIn / 2}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeIn}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
  );

  // Chain link (ellipse) centered between surface points and rotated to align with segment
  const centerX = (topEyeX + bottomEyeX) / 2;
  const centerY = (topEyeY + bottomEyeY) / 2;
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
      cx={bottomEyeX}
      cy={bottomEyeY}
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
