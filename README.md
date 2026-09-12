# ESE 2100 · Simulation 3 — Bifurcation Lab

Interactive 1-D visualization for continuous-time systems \(\dot x = f(x,\mu)\). Four bifurcations: saddle-node, transcritical, supercritical pitchfork, and subcritical pitchfork.

**Live page:** [markomij12.github.io/ese2100-bifurcation-lab](https://markomij12.github.io/ese2100-bifurcation-lab/)

Repo: [github.com/markomij12/ese2100-bifurcation-lab](https://github.com/markomij12/ese2100-bifurcation-lab). Or open `index.html` locally — no install.

## What this is

A single-parameter family of scalar ODEs. The phase space is a line, so the only generic bifurcations of equilibria are these four. Hopf needs a 2-D phase plane; this lab stays in one dimension on purpose.

| System | Equation | What happens |
|---|---|---|
| Saddle-node | \(\dot x = \mu - x^2\) | A stable and an unstable equilibrium collide and vanish |
| Transcritical | \(\dot x = \mu x - x^2\) | Two branches cross and **exchange** stability |
| Supercritical pitchfork | \(\dot x = \mu x - x^3\) | One well splits into two continuously |
| Subcritical pitchfork | \(\dot x = \mu x + x^3 - x^5\) | Jump off the origin, plus hysteresis |

The engine finds equilibria by Newton on a grid, classifies them by \(\mathrm{sign}(f_x)\), and integrates a particle with RK4.

## How to use it

1. Pick a system in the top row.
2. Drag **μ**. The gold line is the slice you are on.
3. Click the vector-field plot (or the diagram) to drop a particle.
4. **Sweep μ →** walks the parameter; **Hysteresis loop** is the one to press on the subcritical pitchfork.
5. On **Supercritical**, drag **ε** off zero. The perfect pitchfork breaks into a smooth branch plus a saddle-node — the usual laboratory picture.

Keyboard: ← → nudge μ, space toggles the sweep.

## What to look for

![Saddle-node fold](docs/sn.png)

**Saddle-node.** Start at μ < 0: no equilibria, the ball runs off the cubic landscape. Cross μ = 0 and a well appears from nothing. That is how equilibria are born in 1-D.

![Transcritical exchange](docs/tc.png)

**Transcritical.** Watch the two branches actually pass through each other. Extinction \(x=0\) and the carrying capacity \(x=\mu\) swap who is stable. This is the awkward one to build with magnets and springs: the rest points have to collide and keep going rather than glance off as a fold.

![Supercritical pitchfork](docs/pf.png)

**Supercritical pitchfork.** At ε = 0 the hoop (or a perfect column) is symmetric: one well splits into two. Nudge ε and the diagram *breaks* — one side is preferred all the way through μ = 0, the other is born in a saddle-node.

![Subcritical hysteresis](docs/sub.png)

**Subcritical pitchfork.** Sit near the origin, sweep μ up through 0: jump. Sweep back: you do not return until μ = −1/4. History matters. Press **Hysteresis loop**.

## Files

- `index.html` — the lab (HTML + CSS + canvas). Fonts from Google; everything else is local.
- `docs/` — screenshots of each system.
