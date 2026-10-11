import { periodicDistance } from "./geom"
import { integratePlanar, type IntegratorName } from "./integrate"
import type { Domain, Field, Sample, Vec2 } from "./types"

export type LimitCycle = {
  points: Vec2[]
  period: number
  stable: boolean
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type Crossing = { t: number; coord: number; index: number }
type Section = { axis: "x" | "y"; value: number }

export type CycleSearchOptions = {
  method?: IntegratorName
  dt?: number
  tMax?: number
  /** Label attached to cycles that attract under the supplied field. */
  stable?: boolean
  seeds?: number
  periodicX?: boolean
  periodicY?: boolean
  /** Floquet-style contraction required to call the orbit isolated and attracting. */
  attract?: number
}

/**
 * Isolated attracting periodic orbits of a planar field, by a Poincaré section.
 * Integrate a grid of seeds, keep orbits whose returns to a transverse section
 * converge, then reject centers: a nearby seed must come back strictly closer
 * (return-map slope well below 1). Pass the time-reversed field to find
 * orbits that are unstable in forward time.
 */
export function findLimitCycles(
  f: Field,
  domain: Domain,
  fixedPoints: { x: number; y: number }[],
  options: CycleSearchOptions = {},
): LimitCycle[] {
  const method = options.method ?? "rk4"
  const dt = options.dt ?? 0.02
  const tMax = options.tMax ?? 42
  const stable = options.stable ?? true
  const nSeed = options.seeds ?? 4
  const periodicX = options.periodicX ?? false
  const periodicY = options.periodicY ?? false
  const attract = options.attract ?? 0.9
  const span = Math.min(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
  const minSize = 0.045 * span
  const found: LimitCycle[] = []

  for (let j = 0; j < nSeed; j++) {
    for (let i = 0; i < nSeed; i++) {
      const x = domain.xmin + ((i + 0.5) / nSeed) * (domain.xmax - domain.xmin)
      const y = domain.ymin + ((j + 0.5) / nSeed) * (domain.ymax - domain.ymin)
      if (fixedPoints.some((fp) => periodicDistance(x, y, fp.x, fp.y, domain, periodicX, periodicY) < 0.07 * span)) {
        continue
      }
      const samples = integratePlanar(f, x, y, {
        method,
        dt,
        tMax,
        direction: 1,
        domain,
        periodicX,
        periodicY,
        stopAtEquilibrium: true,
        maxSteps: Math.ceil(tMax / dt) + 20,
      })
      const cycle = detect(samples, f, domain, fixedPoints, {
        method,
        dt,
        periodicX,
        periodicY,
        attract,
        minSize,
        stable,
      })
      if (!cycle) continue
      if (found.some((c) => sameOrbit(c, cycle, span))) continue
      found.push(cycle)
      if (found.length >= 4) return found
    }
  }
  return found
}

export function findStableAndUnstableCycles(
  f: Field,
  domain: Domain,
  fixedPoints: { x: number; y: number }[],
  options: Omit<CycleSearchOptions, "stable"> = {},
): LimitCycle[] {
  const stable = findLimitCycles(f, domain, fixedPoints, { ...options, stable: true })
  const reversed: Field = (x, y) => {
    const v = f(x, y)
    return [-v[0], -v[1]]
  }
  const unstable = findLimitCycles(reversed, domain, fixedPoints, { ...options, stable: false })
  const out = stable.slice()
  for (const cycle of unstable) {
    if (out.some((c) => sameOrbit(c, cycle, Math.min(domain.xmax - domain.xmin, domain.ymax - domain.ymin)))) {
      continue
    }
    out.push(cycle)
  }
  return out
}

function sameOrbit(a: LimitCycle, b: LimitCycle, span: number): boolean {
  const ca = centroid(a.points)
  const cb = centroid(b.points)
  if (Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) > 0.18 * span) return false
  const ra = meanRadius(a.points, ca)
  const rb = meanRadius(b.points, cb)
  return Math.abs(ra - rb) < 0.15 * Math.max(ra, rb, 0.05 * span)
}

function centroid(points: Vec2[]): Vec2 {
  let x = 0
  let y = 0
  for (const p of points) {
    x += p[0]
    y += p[1]
  }
  const n = Math.max(1, points.length)
  return [x / n, y / n]
}

function meanRadius(points: Vec2[], c: Vec2): number {
  let s = 0
  for (const p of points) s += Math.hypot(p[0] - c[0], p[1] - c[1])
  return s / Math.max(1, points.length)
}

function detect(
  samples: Sample[],
  f: Field,
  domain: Domain,
  fixedPoints: { x: number; y: number }[],
  opt: {
    method: IntegratorName
    dt: number
    periodicX: boolean
    periodicY: boolean
    attract: number
    minSize: number
    stable: boolean
  },
): LimitCycle | null {
  if (samples.length < 40) return null
  const tail = samples.slice(Math.floor(samples.length * 0.45))
  const bb = bounds(tail)
  if (bb.maxX - bb.minX < opt.minSize && bb.maxY - bb.minY < opt.minSize) return null

  const sections: Section[] = []
  for (const frac of [0.32, 0.5, 0.68]) {
    sections.push({ axis: "y", value: bb.minY + frac * (bb.maxY - bb.minY) })
    sections.push({ axis: "x", value: bb.minX + frac * (bb.maxX - bb.minX) })
  }

  let best: {
    section: Section
    mean: number
    period: number
    loop: Sample[]
    score: number
  } | null = null

  for (const section of sections) {
    const crossings = collectCrossings(samples, section, domain, opt.periodicX, opt.periodicY)
    if (crossings.length < 5) continue
    const last = crossings.slice(-4)
    const vals = last.map((c) => c.coord)
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length
    const spread = Math.max(...vals) - Math.min(...vals)
    const scale = Math.max(opt.minSize, Math.abs(mean) * 0.25, (bb.maxX - bb.minX) * 0.25)
    if (spread > Math.max(0.04, 0.035 * scale)) continue
    const early = crossings[crossings.length - 5].coord
    if (Math.abs(early - mean) > Math.max(0.07, 0.08 * scale)) continue
    const periods: number[] = []
    for (let k = crossings.length - 3; k < crossings.length; k++) {
      periods.push(crossings[k].t - crossings[k - 1].t)
    }
    const period = periods.reduce((s, v) => s + v, 0) / periods.length
    if (!(period > opt.dt * 8)) continue
    const pSpread = Math.max(...periods) - Math.min(...periods)
    if (pSpread > 0.12 * period) continue
    const i0 = crossings[crossings.length - 2].index
    const i1 = crossings[crossings.length - 1].index
    const loop = samples.slice(i0, i1 + 1)
    if (loop.length < 8) continue
    const lb = bounds(loop)
    const wide = Math.max(lb.maxX - lb.minX, lb.maxY - lb.minY)
    const narrow = Math.min(lb.maxX - lb.minX, lb.maxY - lb.minY)
    if (wide < opt.minSize || narrow < opt.minSize * 0.12) continue
    if (passesThroughFixedPoint(loop, fixedPoints, domain, opt.periodicX, opt.periodicY, opt.minSize * 0.35)) {
      continue
    }
    const score = crossings.length * 2 - spread / Math.max(scale, 1e-6)
    if (!best || score > best.score) best = { section, mean, period, loop, score }
  }
  if (!best) return null

  const rho = returnSlope(f, best.section, best.mean, best.period, domain, opt)
  if (rho === null || rho > opt.attract) return null

  const points: Vec2[] = best.loop.map((s) => [s.x, s.y])
  const lb = bounds(best.loop)
  return {
    points,
    period: best.period,
    stable: opt.stable,
    minX: lb.minX,
    maxX: lb.maxX,
    minY: lb.minY,
    maxY: lb.maxY,
  }
}

function passesThroughFixedPoint(
  loop: Sample[],
  fixedPoints: { x: number; y: number }[],
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
  tol: number,
): boolean {
  if (fixedPoints.length === 0) return false
  let close = 0
  const step = Math.max(1, Math.floor(loop.length / 24))
  let seen = 0
  for (let i = 0; i < loop.length; i += step) {
    seen++
    const p = loop[i]
    if (fixedPoints.some((fp) => periodicDistance(p.x, p.y, fp.x, fp.y, domain, periodicX, periodicY) < tol)) {
      close++
    }
  }
  return close >= Math.max(2, seen * 0.5)
}

function returnSlope(
  f: Field,
  section: Section,
  mean: number,
  period: number,
  domain: Domain,
  opt: { method: IntegratorName; dt: number; periodicX: boolean; periodicY: boolean },
): number | null {
  const span = Math.min(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
  const delta = Math.max(0.012, Math.min(0.08 * span, 0.12))
  let best = Infinity
  let hits = 0
  for (const sign of [1, -1]) {
    const d = sign * delta
    const x0 = section.axis === "y" ? mean + d : section.value
    const y0 = section.axis === "y" ? section.value : mean + d
    const traj = integratePlanar(f, x0, y0, {
      method: opt.method,
      dt: opt.dt,
      tMax: period * 2.4,
      direction: 1,
      domain,
      periodicX: opt.periodicX,
      periodicY: opt.periodicY,
      stopAtEquilibrium: false,
      maxSteps: Math.ceil((period * 2.4) / opt.dt) + 10,
    })
    const crossings = collectCrossings(traj, section, domain, opt.periodicX, opt.periodicY)
    let chosen: Crossing | null = null
    for (const c of crossings) {
      if (c.t < period * 0.45) continue
      if (!chosen || Math.abs(c.t - period) < Math.abs(chosen.t - period)) chosen = c
    }
    if (!chosen || Math.abs(chosen.t - period) > period * 0.35) continue
    hits++
    best = Math.min(best, Math.abs(chosen.coord - mean) / delta)
  }
  return hits === 0 ? null : best
}

function collectCrossings(
  samples: Sample[],
  section: Section,
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
): Crossing[] {
  const out: Crossing[] = []
  const xPeriod = domain.xmax - domain.xmin
  const yPeriod = domain.ymax - domain.ymin
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (periodicX && Math.abs(b.x - a.x) > 0.5 * xPeriod) continue
    if (periodicY && Math.abs(b.y - a.y) > 0.5 * yPeriod) continue
    if (section.axis === "y") {
      if (a.y <= section.value && b.y > section.value) {
        const denom = b.y - a.y
        const u = denom === 0 ? 0 : (section.value - a.y) / denom
        out.push({
          t: a.t + u * (b.t - a.t),
          coord: a.x + u * (b.x - a.x),
          index: i,
        })
      }
    } else if (a.x <= section.value && b.x > section.value) {
      const denom = b.x - a.x
      const u = denom === 0 ? 0 : (section.value - a.x) / denom
      out.push({
        t: a.t + u * (b.t - a.t),
        coord: a.y + u * (b.y - a.y),
        index: i,
      })
    }
  }
  return out
}

function bounds(samples: Sample[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of samples) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.y < minY) minY = s.y
    if (s.y > maxY) maxY = s.y
  }
  return { minX, maxX, minY, maxY }
}
