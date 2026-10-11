import { describe, expect, it } from "vitest"
import { rk4Integrate } from "../rk4"
import { rk45Integrate } from "../rk45"

describe("RK4", () => {
  it("keeps harmonic-oscillator energy within 1e-6 over 10 periods", () => {
    const f = (_t: number, y: readonly number[]) => [y[1], -y[0]]
    const periods = 10
    const t1 = periods * 2 * Math.PI
    const h = 0.01
    const { y } = rk4Integrate(f, [1, 0], 0, t1, h)
    const last = y[y.length - 1]
    const energy = 0.5 * (last[0] * last[0] + last[1] * last[1])
    expect(Math.abs(energy - 0.5)).toBeLessThan(1e-6)
  })

  it("integrates y' = y on [0, 1]", () => {
    const f = (_t: number, y: readonly number[]) => [y[0]]
    const { t, y } = rk4Integrate(f, [1], 0, 1, 0.01)
    expect(t[t.length - 1]).toBeCloseTo(1, 12)
    expect(y[y.length - 1][0]).toBeCloseTo(Math.E, 6)
  })
})

describe("RK45 Dormand–Prince", () => {
  it("keeps harmonic-oscillator energy within 1e-6 over 10 periods", () => {
    const f = (_t: number, y: readonly number[]) => [y[1], -y[0]]
    const t1 = 10 * 2 * Math.PI
    const { t, y } = rk45Integrate(f, [1, 0], 0, t1, { atol: 1e-9, rtol: 1e-8, h0: 0.05 })
    expect(t[t.length - 1]).toBeCloseTo(t1, 8)
    const last = y[y.length - 1]
    const energy = 0.5 * (last[0] * last[0] + last[1] * last[1])
    expect(Math.abs(energy - 0.5)).toBeLessThan(1e-6)
  })

  it("integrates y' = y on [0, 1]", () => {
    const f = (_t: number, y: readonly number[]) => [y[0]]
    const { y } = rk45Integrate(f, [1], 0, 1, { atol: 1e-10, rtol: 1e-8 })
    expect(y[y.length - 1][0]).toBeCloseTo(Math.E, 7)
  })
})
