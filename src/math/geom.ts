import type { Domain } from "./types"

export function wrap(x: number, min: number, max: number): number {
  const w = max - min
  if (!(w > 0) || !Number.isFinite(x)) return x
  let y = (x - min) % w
  if (y < 0) y += w
  return y + min
}

/** Signed difference folded into (-period/2, period/2]. */
export function wrapDelta(dx: number, period: number): number {
  if (!(period > 0)) return dx
  let d = dx % period
  if (d > period / 2) d -= period
  if (d <= -period / 2) d += period
  return d
}

export function periodicDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
): number {
  let dx = ax - bx
  let dy = ay - by
  if (periodicX) dx = wrapDelta(dx, domain.xmax - domain.xmin)
  if (periodicY) dy = wrapDelta(dy, domain.ymax - domain.ymin)
  return Math.hypot(dx, dy)
}

export function inClampBox(
  x: number,
  y: number,
  domain: Domain,
  multiple: number,
  periodicX: boolean,
  periodicY: boolean,
): boolean {
  const cx = (domain.xmin + domain.xmax) / 2
  const cy = (domain.ymin + domain.ymax) / 2
  const hx = ((domain.xmax - domain.xmin) * multiple) / 2
  const hy = ((domain.ymax - domain.ymin) * multiple) / 2
  if (!periodicX && Math.abs(x - cx) > hx) return false
  if (!periodicY && Math.abs(y - cy) > hy) return false
  return true
}

export function hypot2(x: number, y: number): number {
  return Math.hypot(x, y)
}
