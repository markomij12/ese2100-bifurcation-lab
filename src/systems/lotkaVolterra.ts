import type { System } from "./types"

/**
 * Two species competing for a shared resource. Strogatz §6.4.
 * The first quadrant is invariant. Nullcline intercepts decide
 * coexistence, exclusion, or bistability; there is no limit cycle.
 */
export const lotkaVolterra: System = {
  id: "lotka",
  name: "Lotka–Volterra competition",
  description: `Two species, each slowing the other's growth.

$$x' = x(r_1 - a_{11} x - a_{12} y), \\qquad y' = y(r_2 - a_{21} x - a_{22} y).$$

The presets are coexistence, competitive exclusion, and bistability. In the bistable case, turn on saddle manifolds: that curve is the separatrix.`,
  theory: `Each species grows logistically and is hindered by the other. The coordinate axes are invariant, so a missing species stays missing. When both growth rates are positive the origin is an unstable node. On the axes the single-species equilibria sit at the carrying capacities

$$x = \\frac{r_1}{a_{11}}, \\qquad y = \\frac{r_2}{a_{22}}.$$

An interior equilibrium exists when the nullclines cross in the open first quadrant. It is **stable** when each species inhibits itself more than it inhibits the other — the coexistence preset, where $a_{12}$ and $a_{21}$ are smaller than the self-limitation terms. It is a **saddle** when interspecific competition dominates. Then both axial equilibria are stable and the stable manifold of the saddle splits the quadrant into two basins: one species or the other wins, depending on the initial condition. That is bistability.

If the nullclines do not cross in the first quadrant, one axial equilibrium is stable and the other is a saddle. Almost every positive initial condition converges to the winner (competitive exclusion).

Competitive Lotka–Volterra has no limit cycle. Oscillations in a two-species model need a predator–prey sign pattern, not mutual inhibition.

Strogatz, *Nonlinear Dynamics and Chaos*, §6.4.`,
  params: [
    { key: "r1", label: "r₁", min: 0.1, max: 3, step: 0.01, default: 1 },
    { key: "r2", label: "r₂", min: 0.1, max: 3, step: 0.01, default: 1 },
    { key: "a11", label: "a₁₁", min: 0.1, max: 3, step: 0.01, default: 1 },
    { key: "a12", label: "a₁₂", min: 0.1, max: 3, step: 0.01, default: 0.5 },
    { key: "a21", label: "a₂₁", min: 0.1, max: 3, step: 0.01, default: 0.5 },
    { key: "a22", label: "a₂₂", min: 0.1, max: 3, step: 0.01, default: 1 },
  ],
  f: (x, y, p) => [
    x * (p.r1 - p.a11 * x - p.a12 * y),
    y * (p.r2 - p.a21 * x - p.a22 * y),
  ],
  domain: { xmin: 0, xmax: 3.2, ymin: 0, ymax: 3.2 },
  axis: { x: "x", y: "y" },
  nullclineLabels: { x: "x′ = 0", y: "y′ = 0" },
  presets: [
    {
      name: "coexistence",
      params: { r1: 1, r2: 1, a11: 1, a12: 0.5, a21: 0.5, a22: 1 },
    },
    {
      name: "competitive exclusion (x wins)",
      params: { r1: 1, r2: 1, a11: 1, a12: 0.4, a21: 1.2, a22: 1 },
    },
    {
      name: "bistability",
      params: { r1: 1, r2: 1, a11: 1, a12: 1.5, a21: 1.5, a22: 1 },
      manifolds: true,
    },
  ],
  bifurcation: {
    param: "a12",
    variable: "x",
  },
  time: { dt: 0.02, horizon: 28 },
}
