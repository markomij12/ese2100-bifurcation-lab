import type { System } from "./types"

/**
 * Bead on a hoop spinning about its vertical diameter.
 * φ is measured from the bottom. Time is scaled by √(r/g), and
 * γ = r ω² / g. Strogatz §3.5.
 *
 * Equilibria: v = 0 and either sin φ = 0 or cos φ = 1/γ.
 * The bottom φ = 0 changes from attractor to saddle at γ = 1
 * (supercritical pitchfork). The new branches sit at φ = ±arccos(1/γ).
 */
export const hoop: System = {
  id: "hoop",
  name: "Bead on a rotating hoop",
  description: `A bead slides on a hoop that spins about its vertical axis. In dimensionless time,

$$\\varphi' = v, \\qquad v' = -\\beta v + \\sin\\varphi\\,(\\gamma\\cos\\varphi - 1), \\qquad \\gamma = \\dfrac{r\\omega^2}{g}.$$

Drag $\\gamma$ through $1$: the bottom goes unstable and two new equilibria appear off center.`,
  theory: `The hoop has radius $r$ and spins at constant angular speed $\\omega$. Measuring $\\varphi$ upward from the **bottom** and scaling time by $\\sqrt{r/g}$ removes every parameter except the spin

$$\\gamma = \\frac{r\\omega^2}{g}$$

and a dimensionless damping $\\beta$. The phase plane is a cylinder: $\\varphi$ and $\\varphi+2\\pi$ are the same place.

Equilibria lie on $v=0$. Either $\\sin\\varphi=0$, so the bead is at the bottom ($\\varphi=0$) or the top ($\\varphi=\\pm\\pi$), or

$$\\cos\\varphi = \\frac{1}{\\gamma}$$

which is only possible for $\\gamma \\ge 1$. Linearization at the bottom has determinant $1-\\gamma$. For $\\gamma<1$ that equilibrium is attracting (a spiral when $\\beta>0$, a center when $\\beta=0$). At $\\gamma=1$ the determinant vanishes: a **supercritical pitchfork**. For $\\gamma>1$ the bottom is a saddle and a symmetric pair

$$\\varphi = \\pm\\arccos(1/\\gamma)$$

is attracting. As the hoop spins faster the bead climbs toward the equator. The top is a saddle for every $\\gamma$.

With $\\beta>0$ this is a damped mechanical system — energy decreases, so there is no isolated limit cycle. With $\\beta=0$ it is conservative and the bottom is a center surrounded by a family of periodic orbits, not a single cycle. The separatrix leaving the bottom saddle is the unstable manifold; turn it on to see which well a trajectory falls into.

Strogatz, *Nonlinear Dynamics and Chaos*, §3.5.`,
  params: [
    { key: "gamma", label: "γ", min: 0, max: 3, step: 0.01, default: 1.8 },
    { key: "beta", label: "β", min: 0, max: 2, step: 0.01, default: 0.12 },
  ],
  f: (phi, v, p) => [
    v,
    -p.beta * v + Math.sin(phi) * (p.gamma * Math.cos(phi) - 1),
  ],
  domain: { xmin: -Math.PI, xmax: Math.PI, ymin: -3, ymax: 3 },
  periodic: { x: true },
  axis: { x: "φ", y: "v" },
  piTicks: { x: true },
  nullclineLabels: { x: "φ̇ = 0", y: "v̇ = 0" },
  bifurcation: {
    param: "gamma",
    variable: "x",
    annotations: [{ param: "gamma", value: 1, label: "pitchfork" }],
  },
  time: { dt: 0.01, horizon: 46 },
  sideView: "hoop",
}
