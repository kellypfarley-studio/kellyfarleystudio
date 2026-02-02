export type CatenaryParams = {
  a: number;
  b: number;
  c: number;
  u0: number;      // (x0 - b)/a
  length: number;  // arc length from x0 to x1
};

export function solveCatenaryByLength(
  x0: number, y0: number,
  x1: number, y1: number,
  L: number
): CatenaryParams | null {
  const dxRaw = x1 - x0;
  const dyRaw = y1 - y0;
  const chord = Math.hypot(dxRaw, dyRaw);

  if (!Number.isFinite(L) || L <= chord + 1e-6) return null;
  if (Math.abs(dxRaw) < 1e-6) return null; // vertical-ish: unstable in y(x) form
  if (Math.abs(dyRaw) >= L) return null;

  // Ensure x0 < x1 for stability
  let flip = false;
  if (x1 < x0) {
    flip = true;
    [x0, x1] = [x1, x0];
    [y0, y1] = [y1, y0];
  }

  const dx = x1 - x0;
  const dy = y1 - y0;

  const m = Math.atanh(dy / L);
  const denom = Math.sqrt(Math.max(1e-12, L * L - dy * dy));
  const R = dx / denom; // in (0,1)

  const f = (d: number) => d / Math.sinh(d) - R;

  let lo = 1e-9;
  let hi = 1.0;
  while (f(hi) > 0 && hi < 60) hi *= 2;
  if (f(hi) > 0) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const d = (lo + hi) / 2;

  const u0 = m - d;
  const u1 = m + d;

  const a = dx / (u1 - u0); // = dx/(2d)
  const b = x0 - a * u0;
  const c = y0 - a * Math.cosh(u0);

  // flip doesn’t change the curve itself; caller samples by arc length anyway
  void flip;
  return { a, b, c, u0, length: L };
}

export function pointAtArcLength(p: CatenaryParams, s: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(p.length, s));
  const a = p.a;

  // s = a (sinh(u) - sinh(u0))
  const targetSinh = clamped / a + Math.sinh(p.u0);
  const u = Math.asinh(targetSinh);

  const x = a * u + p.b;
  const y = a * Math.cosh(u) + p.c;
  return { x, y };
}

// Critical note: this solver assumes math coords (y-up) with y = a*cosh(...) + c.
// When using with SVG (y-down), negate sampled y as needed by callers.
