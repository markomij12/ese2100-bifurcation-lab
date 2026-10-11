import { isAttracting } from "./classify"
import { periodicDistance, wrapDelta } from "./geom"
import { continueFixedPoints, findFixedPoints, type FixedPoint } from "./fixedPoints"
import type { FixedPointClass } from "./classify"
import type { Domain, Field } from "./types"

export type BifSample = {
  p: number
  x: number
  y: number
  kind: FixedPointClass
  trace: number
  det: number
  attracting: boolean
}

export type BifBranch = {
  samples: BifSample[]
}

function spray(fp: { x: number; y: number }): { x: number; y: number }[] {
  const seeds: { x: number; y: number }[] = []
  for (const dx of [0.1, -0.1, 0.22, -0.22, 0.45, -0.45, 0.8, -0.8]) {
    seeds.push({ x: fp.x + dx, y: fp.y })
    seeds.push({ x: fp.x, y: fp.y + dx * 0.65 })
  }
  return seeds
}

/**
 * Equilibrium branches against one parameter.
 * Most steps are Newton continuation from the previous slice. A full
 * re-seed, plus a local spray whenever a determinant is near zero,
 * picks up branches born at a bifurcation.
 */
export function sweepBranches(
  fieldAt: (p: number) => Field,
  pMin: number,
  pMax: number,
  count: number,
  domain: Domain,
  periodicX = false,
  periodicY = false,
): BifBranch[] {
  const n = Math.max(2, count)
  const ps = Array.from({ length: n }, (_, i) => pMin + ((pMax - pMin) * i) / (n - 1))
  const branches: BifBranch[] = []
  let prev: FixedPoint[] = []
  let prevP = Number.NaN
  const periodX = domain.xmax - domain.xmin
  const maxMatch = Math.max(0.28, 0.1 * Math.min(periodX, domain.ymax - domain.ymin))

  const sampleOf = (p: number, fp: FixedPoint, nearX?: number, nearY?: number): BifSample => {
    let x = fp.x
    let y = fp.y
    if (nearX !== undefined && periodicX) {
      const target = nearX
      let best = x
      let bestD = Math.abs(wrapDelta(x - target, periodX))
      for (const shift of [-periodX, 0, periodX]) {
        const d = Math.abs(x + shift - target)
        if (d < bestD) {
          bestD = d
          best = x + shift
        }
      }
      x = best
    }
    if (nearY !== undefined && periodicY) {
      const periodY = domain.ymax - domain.ymin
      let best = y
      let bestD = Math.abs(wrapDelta(y - nearY, periodY))
      for (const shift of [-periodY, 0, periodY]) {
        const d = Math.abs(y + shift - nearY)
        if (d < bestD) {
          bestD = d
          best = y + shift
        }
      }
      y = best
    }
    return {
      p,
      x,
      y,
      kind: fp.kind,
      trace: fp.trace,
      det: fp.det,
      attracting: isAttracting(fp.kind),
    }
  }

  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]
    const f = fieldAt(p)
    const full = i === 0 || i === ps.length - 1 || i % 7 === 0
    let fps = full
      ? findFixedPoints(f, domain, { grid: 9, periodicX, periodicY })
      : continueFixedPoints(prev, f, domain, { periodicX, periodicY })
    if (!full) {
      for (const old of prev) {
        if (Math.abs(old.det) < 0.35) {
          const extra = continueFixedPoints(spray(old), f, domain, { periodicX, periodicY })
          fps = dedupMerge(fps, extra, domain, periodicX, periodicY)
        }
      }
    }

    const activeIdx: number[] = []
    for (let b = 0; b < branches.length; b++) {
      const last = branches[b].samples[branches[b].samples.length - 1]
      if (last && last.p === prevP) activeIdx.push(b)
    }
    const pairs: { b: number; f: number; d: number }[] = []
    for (const b of activeIdx) {
      const last = branches[b].samples[branches[b].samples.length - 1]
      for (let fi = 0; fi < fps.length; fi++) {
        const d = periodicDistance(last.x, last.y, fps[fi].x, fps[fi].y, domain, periodicX, periodicY)
        pairs.push({ b, f: fi, d })
      }
    }
    pairs.sort((a, b) => a.d - b.d)
    const usedB = new Set<number>()
    const usedF = new Set<number>()
    for (const pair of pairs) {
      if (pair.d > maxMatch) break
      if (usedB.has(pair.b) || usedF.has(pair.f)) continue
      usedB.add(pair.b)
      usedF.add(pair.f)
      const last = branches[pair.b].samples[branches[pair.b].samples.length - 1]
      branches[pair.b].samples.push(sampleOf(p, fps[pair.f], last.x, last.y))
    }
    for (let fi = 0; fi < fps.length; fi++) {
      if (!usedF.has(fi)) branches.push({ samples: [sampleOf(p, fps[fi])] })
    }
    prev = fps
    prevP = p
  }

  return branches.filter((b) => b.samples.length >= 2)
}

function dedupMerge(
  a: FixedPoint[],
  b: FixedPoint[],
  domain: Domain,
  periodicX: boolean,
  periodicY: boolean,
): FixedPoint[] {
  const out = a.slice()
  for (const p of b) {
    const clash = out.some(
      (q) => periodicDistance(p.x, p.y, q.x, q.y, domain, periodicX, periodicY) < 2e-3,
    )
    if (!clash) out.push(p)
  }
  return out
}

export type CycleAmpSample = {
  p: number
  min: number
  max: number
  stable: boolean
}

export type CycleAmpBranch = {
  stable: boolean
  edge: "min" | "max"
  samples: { p: number; value: number }[]
}

/** Group per-parameter cycle amplitudes into drawable min/max branches. */
export function groupCycleAmplitudes(samples: CycleAmpSample[]): CycleAmpBranch[] {
  const branches: { stable: boolean; min: { p: number; value: number }[]; max: { p: number; value: number }[] }[] = []
  const sorted = samples.slice().sort((a, b) => a.p - b.p)
  for (const s of sorted) {
    let best = -1
    let bestD = 0.35
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i]
      if (b.stable !== s.stable) continue
      const last = b.max[b.max.length - 1]
      if (!last) continue
      const dp = s.p - last.p
      if (dp <= 0 || dp > 0.25 * Math.max(1, Math.abs(s.p))) continue
      const d = Math.abs(last.value - s.max)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      branches[best].min.push({ p: s.p, value: s.min })
      branches[best].max.push({ p: s.p, value: s.max })
    } else {
      branches.push({
        stable: s.stable,
        min: [{ p: s.p, value: s.min }],
        max: [{ p: s.p, value: s.max }],
      })
    }
  }
  const out: CycleAmpBranch[] = []
  for (const b of branches) {
    if (b.max.length < 2) continue
    out.push({ stable: b.stable, edge: "max", samples: b.max })
    out.push({ stable: b.stable, edge: "min", samples: b.min })
  }
  return out
}
