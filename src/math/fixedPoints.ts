import { classifyJacobian, type Classification } from "./classify"
import { periodicDistance, wrap } from "./geom"
import { jacobian } from "./jacobian"
import type { Domain, Field, Matrix2, Vec2 } from "./types"

export type FixedPoint = Classification & {
  x: number
  y: number
  J: Matrix2
}

export type FindOptions = {
  grid?: number
  tol?: number
  dedup?: number
  periodicX?: boolean
  periodicY?: boolean
  maxIter?: number
}

function solve(J: Matrix2, rx: number, ry: number): Vec2 | null {
  const a = J[0][0]
  const b = J[0][1]
  const c = J[1][0]
  const d = J[1][1]
  const det = a * d - b * c
  if (Number.isFinite(det) && Math.abs(det) > 1e-14) {
    return [(rx * d - b * ry) / det, (a * ry - c * rx) / det]
  }
  const lam = 1e-6
  const A00 = a * a + c * c + lam
  const A01 = a * b + c * d
  const A11 = b * b + d * d + lam
  const detA = A00 * A11 - A01 * A01
  if (!Number.isFinite(detA) || Math.abs(detA) < 1e-18) return null
  const bx = a * rx + c * ry
  const by = b * rx + d * ry
  return [(bx * A11 - A01 * by) / detA, (A00 * by - A01 * bx) / detA]
}

function place(
  x: number,
  y: number,
  domain: Domain | undefined,
  periodicX: boolean,
  periodicY: boolean,
): Vec2 {
  let xx = x
  let yy = y
  if (domain && periodicX) xx = wrap(x, domain.xmin, domain.xmax)
  if (domain && periodicY) yy = wrap(y, domain.ymin, domain.ymax)
  return [xx, yy]
}

function inside(
  x: number,
  y: number,
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
): boolean {
  const mx = (domain.xmax - domain.xmin) * 0.04
  const my = (domain.ymax - domain.ymin) * 0.04
  if (!periodicX && (x < domain.xmin - mx || x > domain.xmax + mx)) return false
  if (!periodicY && (y < domain.ymin - my || y > domain.ymax + my)) return false
  return Number.isFinite(x) && Number.isFinite(y)
}

/** Damped Newton with a finite-difference Jacobian. */
export function newton2d(
  f: Field,
  x0: number,
  y0: number,
  domain?: Domain,
  options: FindOptions = {},
): { x: number; y: number; J: Matrix2 } | null {
  const maxIter = options.maxIter ?? 18
  const tol = options.tol ?? 1e-10
  const periodicX = options.periodicX ?? false
  const periodicY = options.periodicY ?? false
  let x = x0
  let y = y0
  let J = jacobian(f, x, y)
  for (let k = 0; k < maxIter; k++) {
    ;[x, y] = place(x, y, domain, periodicX, periodicY)
    const F = f(x, y)
    if (!Number.isFinite(F[0]) || !Number.isFinite(F[1])) return null
    const res = Math.hypot(F[0], F[1])
    J = jacobian(f, x, y)
    if (!J.flat().every(Number.isFinite)) return null
    if (res < tol) return { x, y, J }
    const step = solve(J, -F[0], -F[1])
    if (!step || !Number.isFinite(step[0]) || !Number.isFinite(step[1])) return null
    let dx = step[0]
    let dy = step[1]
    const mag = Math.hypot(dx, dy)
    const cap = domain
      ? 0.45 * Math.max(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
      : 2
    if (mag > cap && mag > 0) {
      dx *= cap / mag
      dy *= cap / mag
    }
    const trial = f(x + dx, y + dy)
    const tres = Math.hypot(trial[0], trial[1])
    if (Number.isFinite(tres) && tres > res && res < 1) {
      dx *= 0.5
      dy *= 0.5
    }
    x += dx
    y += dy
  }
  ;[x, y] = place(x, y, domain, periodicX, periodicY)
  const F = f(x, y)
  if (!Number.isFinite(F[0]) || Math.hypot(F[0], F[1]) > 1e-7) return null
  J = jacobian(f, x, y)
  return { x, y, J }
}

function toFixedPoint(x: number, y: number, J: Matrix2): FixedPoint {
  return { x, y, J, ...classifyJacobian(J) }
}

export function dedupFixedPoints(
  points: FixedPoint[],
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
  dedup: number,
): FixedPoint[] {
  const kept: FixedPoint[] = []
  for (const p of points) {
    const clash = kept.some(
      (q) => periodicDistance(p.x, p.y, q.x, q.y, domain, periodicX, periodicY) < dedup,
    )
    if (!clash) kept.push(p)
  }
  return kept
}

/**
 * Seed Newton on a grid (plus the axes, which carry many textbook equilibria)
 * and merge duplicates. Periodic coordinates are identified.
 */
export function findFixedPoints(f: Field, domain: Domain, options: FindOptions = {}): FixedPoint[] {
  const grid = options.grid ?? 12
  const dedup = options.dedup ?? 2e-3
  const periodicX = options.periodicX ?? false
  const periodicY = options.periodicY ?? false
  const found: FixedPoint[] = []

  const accept = (x0: number, y0: number) => {
    const hit = newton2d(f, x0, y0, domain, options)
    if (!hit) return
    const [x, y] = place(hit.x, hit.y, domain, periodicX, periodicY)
    if (!inside(x, y, domain, periodicX, periodicY)) return
    const F = f(x, y)
    if (Math.hypot(F[0], F[1]) > 5e-7) return
    const J = jacobian(f, x, y)
    found.push(toFixedPoint(x, y, J))
  }

  const width = domain.xmax - domain.xmin
  const height = domain.ymax - domain.ymin
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      accept(domain.xmin + ((i + 0.5) * width) / grid, domain.ymin + ((j + 0.5) * height) / grid)
    }
  }
  if (domain.ymin <= 0 && domain.ymax >= 0) {
    for (let i = 0; i < grid; i++) accept(domain.xmin + ((i + 0.5) * width) / grid, 0)
  }
  if (domain.xmin <= 0 && domain.xmax >= 0) {
    for (let j = 0; j < grid; j++) accept(0, domain.ymin + ((j + 0.5) * height) / grid)
  }
  accept(domain.xmin, domain.ymin)
  accept(domain.xmax, domain.ymin)
  accept(domain.xmin, domain.ymax)
  accept(domain.xmax, domain.ymax)

  return dedupFixedPoints(found, domain, periodicX, periodicY, dedup).sort((p, q) =>
    p.x === q.x ? p.y - q.y : p.x - q.x,
  )
}

/** Polish known roots after a parameter change. Cheap enough to run live. */
export function continueFixedPoints(
  seeds: { x: number; y: number }[],
  f: Field,
  domain: Domain,
  options: FindOptions = {},
): FixedPoint[] {
  const periodicX = options.periodicX ?? false
  const periodicY = options.periodicY ?? false
  const found: FixedPoint[] = []
  for (const s of seeds) {
    const hit = newton2d(f, s.x, s.y, domain, { ...options, maxIter: options.maxIter ?? 10 })
    if (!hit) continue
    const [x, y] = place(hit.x, hit.y, domain, periodicX, periodicY)
    if (!inside(x, y, domain, periodicX, periodicY)) continue
    const F = f(x, y)
    if (Math.hypot(F[0], F[1]) > 1e-6) continue
    found.push(toFixedPoint(x, y, hit.J))
  }
  return dedupFixedPoints(found, domain, periodicX, periodicY, options.dedup ?? 2e-3)
}
