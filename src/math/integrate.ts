import { inClampBox, wrap } from "./geom"
import { rk4Step } from "./rk4"
import { rk45Attempt, rk45NextStep } from "./rk45"
import type { Domain, Field, Sample } from "./types"

export type IntegratorName = "rk4" | "rk45"

export type IntegrateOptions = {
  method?: IntegratorName
  /** Fixed RK4 step, or the initial RK45 step. */
  dt?: number
  /** How far to integrate, in forward or backward time. */
  tMax?: number
  direction?: 1 | -1
  domain?: Domain
  periodicX?: boolean
  periodicY?: boolean
  /** Stop outside a box this many times the domain, centered on it. */
  clampMultiple?: number
  maxSteps?: number
  /** Stop after the orbit has settled on an equilibrium. */
  stopAtEquilibrium?: boolean
  atol?: number
  rtol?: number
}

function fieldAt(f: Field, x: number, y: number): [number, number] | null {
  const v = f(x, y)
  if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) return null
  return v
}

/**
 * Integrate a planar autonomous field. Trajectories that leave a 10× copy
 * of the domain box are cut off. Periodic coordinates wrap instead.
 */
export function integratePlanar(
  f: Field,
  x0: number,
  y0: number,
  options: IntegrateOptions = {},
): Sample[] {
  const method = options.method ?? "rk4"
  const dt = options.dt ?? 0.01
  const tMax = options.tMax ?? 40
  const dir = options.direction ?? 1
  const periodicX = options.periodicX ?? false
  const periodicY = options.periodicY ?? false
  const clampMultiple = options.clampMultiple ?? 10
  const maxSteps = options.maxSteps ?? 16_000
  const domain = options.domain
  const samples: Sample[] = [{ t: 0, x: x0, y: y0 }]
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return samples

  let t = 0
  let x = x0
  let y = y0
  let slow = 0
  let anchorX = x0
  let anchorY = y0
  const hSign = dir
  let h = Math.abs(dt)

  const commit = (xn: number, yn: number, hn: number): boolean => {
    if (!Number.isFinite(xn) || !Number.isFinite(yn)) return false
    if (
      domain &&
      !inClampBox(xn, yn, domain, clampMultiple, periodicX, periodicY)
    ) {
      return false
    }
    let px = xn
    let py = yn
    if (domain && periodicX) px = wrap(xn, domain.xmin, domain.xmax)
    if (domain && periodicY) py = wrap(yn, domain.ymin, domain.ymax)
    t += hSign * hn
    x = px
    y = py
    samples.push({ t, x, y })
    if (options.stopAtEquilibrium !== false) {
      const vel = fieldAt(f, x, y)
      const speed = vel ? Math.hypot(vel[0], vel[1]) : Infinity
      if (speed < 8e-4) {
        if (slow === 0) {
          anchorX = x
          anchorY = y
        }
        slow++
        if (slow > 40 && Math.hypot(x - anchorX, y - anchorY) < 0.025) return false
      } else {
        slow = 0
      }
    }
    return true
  }

  if (method === "rk45") {
    const atol = options.atol ?? 1e-6
    const rtol = options.rtol ?? 1e-5
    const hMin = 1e-8
    const hMax = Math.max(Math.abs(dt) * 8, 0.05)
    let step = Math.min(h, hMax)
    for (let k = 0; k < maxSteps && Math.abs(t) < tMax - 1e-12; k++) {
      let hk = step
      if (Math.abs(t) + hk > tMax) hk = tMax - Math.abs(t)
      const signed = hSign * hk
      const attempt = rk45Attempt((_tt, s) => {
        const v = fieldAt(f, s[0], s[1])
        return v ?? [Number.NaN, Number.NaN]
      }, t, [x, y], signed, atol, rtol)
      const jump = Math.hypot(attempt.yNext[0] - x, attempt.yNext[1] - y)
      const scale = domain
        ? Math.hypot(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
        : 10
      const ok = attempt.err <= 1 && jump < scale * 1.5
      if (!ok) {
        step = Math.max(hMin, Math.abs(rk45NextStep(hk, Math.max(attempt.err, 2), false)))
        if (step <= hMin * 1.01) break
        continue
      }
      if (!commit(attempt.yNext[0], attempt.yNext[1], hk)) break
      step = Math.min(hMax, Math.abs(rk45NextStep(hk, attempt.err, true)))
    }
    return samples
  }

  let guard = 0
  for (let k = 0; k < maxSteps && Math.abs(t) < tMax - 1e-12; k++) {
    let hk = h
    if (Math.abs(t) + hk > tMax) hk = tMax - Math.abs(t)
    const signed = hSign * hk
    const next = rk4Step((_tt, s) => {
      const v = fieldAt(f, s[0], s[1])
      return v ?? [Number.NaN, Number.NaN]
    }, t, [x, y], signed)
    const jump = Math.hypot(next[0] - x, next[1] - y)
    const scale = domain
      ? Math.hypot(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
      : 10
    if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || jump > scale) {
      guard++
      h = Math.max(1e-5, h * 0.5)
      if (guard > 8) break
      continue
    }
    guard = 0
    if (!commit(next[0], next[1], hk)) break
    h = Math.min(Math.abs(dt), h * 1.4)
  }
  return samples
}
