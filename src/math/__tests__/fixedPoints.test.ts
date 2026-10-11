import { describe, expect, it } from "vitest"
import { sweepBranches } from "../bifurcation"
import { findFixedPoints } from "../fixedPoints"
import { hoop } from "../../systems/hoop"
import { lotkaVolterra } from "../../systems/lotkaVolterra"

function ang(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

describe("fixed-point finder", () => {
  it("finds the only root of a linear sink and classifies it", () => {
    const points = findFixedPoints((x, y) => [-x, -2 * y], {
      xmin: -2,
      xmax: 2,
      ymin: -2,
      ymax: 2,
    })
    expect(points).toHaveLength(1)
    expect(points[0].x).toBeCloseTo(0, 6)
    expect(points[0].y).toBeCloseTo(0, 6)
    expect(points[0].kind).toBe("stable-node")
    expect(points[0].index).toBe(1)
  })

  it("finds the hoop pitchfork equilibria at γ = 2", () => {
    const points = findFixedPoints((phi, v) => hoop.f(phi, v, { gamma: 2, beta: 0.2 }), hoop.domain, {
      periodicX: true,
      grid: 12,
    })
    expect(points).toHaveLength(4)

    const bottom = points.find((p) => ang(p.x, 0) < 0.05 && Math.abs(p.y) < 1e-4)
    const top = points.find((p) => ang(p.x, Math.PI) < 0.05 && Math.abs(p.y) < 1e-4)
    const right = points.find((p) => ang(p.x, Math.PI / 3) < 0.05)
    const left = points.find((p) => ang(p.x, -Math.PI / 3) < 0.05)
    expect(bottom?.kind).toBe("saddle")
    expect(bottom?.index).toBe(-1)
    expect(top?.kind).toBe("saddle")
    expect(right?.kind).toBe("stable-spiral")
    expect(left?.kind).toBe("stable-spiral")
    expect(right && Math.cos(right.x)).toBeCloseTo(0.5, 3)
    expect(left && Math.cos(left.x)).toBeCloseTo(0.5, 3)
    expect(right?.y).toBeCloseTo(0, 4)
  })

  it("has no off-center hoop equilibria when γ < 1", () => {
    const points = findFixedPoints((phi, v) => hoop.f(phi, v, { gamma: 0.5, beta: 0.2 }), hoop.domain, {
      periodicX: true,
    })
    expect(points).toHaveLength(2)
    const bottom = points.find((p) => ang(p.x, 0) < 0.05)
    expect(bottom?.kind).toBe("stable-spiral")
    expect(points.some((p) => ang(p.x, Math.PI) < 0.05 && p.kind === "saddle")).toBe(true)
  })

  it("finds coexistence equilibria of competitive Lotka–Volterra", () => {
    const p = { r1: 1, r2: 1, a11: 1, a12: 0.5, a21: 0.5, a22: 1 }
    const points = findFixedPoints((x, y) => lotkaVolterra.f(x, y, p), lotkaVolterra.domain)
    expect(points).toHaveLength(4)
    const origin = points.find((q) => Math.hypot(q.x, q.y) < 1e-3)
    const xOnly = points.find((q) => Math.abs(q.x - 1) < 1e-3 && Math.abs(q.y) < 1e-3)
    const yOnly = points.find((q) => Math.abs(q.y - 1) < 1e-3 && Math.abs(q.x) < 1e-3)
    const both = points.find((q) => Math.abs(q.x - 2 / 3) < 1e-3 && Math.abs(q.y - 2 / 3) < 1e-3)
    expect(origin?.kind).toBe("unstable-node")
    expect(xOnly?.kind).toBe("saddle")
    expect(yOnly?.kind).toBe("saddle")
    expect(both?.kind).toBe("stable-node")
    expect(both?.index).toBe(1)
  })

  it("tracks the supercritical pitchfork in γ", () => {
    const branches = sweepBranches(
      (gamma) => (phi, v) => hoop.f(phi, v, { gamma, beta: 0.2 }),
      0.25,
      2.4,
      70,
      hoop.domain,
      true,
      false,
    )
    const near = (gamma: number, phi: number) => {
      let best: { kind: string; d: number } | null = null
      for (const branch of branches) {
        for (const s of branch.samples) {
          if (Math.abs(s.p - gamma) > 0.06) continue
          const d = ang(s.x, phi)
          if (!best || d < best.d) best = { kind: s.kind, d }
        }
      }
      return best
    }
    const low = near(0.4, 0)
    expect(low && low.d).toBeLessThan(0.05)
    expect(low?.kind === "stable-spiral" || low?.kind === "stable-node").toBe(true)

    const bottom = near(2, 0)
    expect(bottom && bottom.d).toBeLessThan(0.05)
    expect(bottom?.kind).toBe("saddle")

    const right = near(2, Math.PI / 3)
    expect(right && right.d).toBeLessThan(0.08)
    expect(right?.kind).toBe("stable-spiral")

    const left = near(2, -Math.PI / 3)
    expect(left && left.d).toBeLessThan(0.08)
    expect(left?.kind).toBe("stable-spiral")
  })
})
