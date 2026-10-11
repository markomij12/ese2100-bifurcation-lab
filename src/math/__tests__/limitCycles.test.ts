import { describe, expect, it } from "vitest"
import { findFixedPoints } from "../fixedPoints"
import { findStableAndUnstableCycles } from "../limitCycles"
import { hoop } from "../../systems/hoop"
import type { Field } from "../types"

/** Supercritical Hopf normal form, ω = 1. Stable cycle at r = √μ. */
function hopf(mu: number): Field {
  return (x, y) => {
    const r2 = x * x + y * y
    return [mu * x - r2 * x - y, mu * y - r2 * y + x]
  }
}

describe("limit cycles", () => {
  it("finds the attracting Hopf cycle and not an unstable twin", () => {
    const mu = 0.8
    const domain = { xmin: -2.4, xmax: 2.4, ymin: -2.4, ymax: 2.4 }
    const f = hopf(mu)
    const fps = findFixedPoints(f, domain, { grid: 7 })
    const cycles = findStableAndUnstableCycles(f, domain, fps, {
      dt: 0.03,
      tMax: 36,
      seeds: 4,
    })
    const stable = cycles.filter((c) => c.stable)
    const unstable = cycles.filter((c) => !c.stable)
    expect(stable.length).toBeGreaterThanOrEqual(1)
    expect(unstable).toHaveLength(0)
    const radius = Math.sqrt(mu)
    const cycle = stable[0]
    expect((cycle.maxX - cycle.minX) / 2).toBeCloseTo(radius, 1)
    expect((cycle.maxY - cycle.minY) / 2).toBeCloseTo(radius, 1)
    expect(cycle.period).toBeGreaterThan(4)
    expect(cycle.period).toBeLessThan(9)
  })

  it("does not invent a limit cycle for the damped spinning hoop", () => {
    const f: Field = (phi, v) => hoop.f(phi, v, { gamma: 1.8, beta: 0.15 })
    const fps = findFixedPoints(f, hoop.domain, { periodicX: true, grid: 10 })
    const cycles = findStableAndUnstableCycles(f, hoop.domain, fps, {
      dt: 0.03,
      tMax: 28,
      seeds: 3,
      periodicX: true,
    })
    expect(cycles).toHaveLength(0)
  })
})
