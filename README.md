# PhasePlane — ESE 2100

An interactive tour of 2-D flows and their bifurcations. The phase plane is drawn on a canvas: a vector field colored by speed, an animated flow, nullclines, equilibria with their linear type, saddle manifolds, and isolated limit cycles. A bifurcation diagram tracks those equilibria as one parameter moves.

Phase 1 includes the bead on a rotating hoop (Strogatz §3.5) and Lotka–Volterra competition (Strogatz §6.4).

## Run locally

```bash
npm i
npm run dev
```

Then open the URL Vite prints. `npm test` runs the integrator, fixed-point, and classification tests. `npm run build` typechecks and writes a static `dist/`.

## Add a system

Each system is one file in `src/systems/` and is registered in `src/systems/index.ts`. The shape is:

```ts
{
  id, name,
  description,   // markdown, with $inline$ and $$display$$ KaTeX
  theory,        // same, shown in the Theory disclosure
  params: [{ key, label, min, max, step, default }],
  f: (x, y, p) => [dx, dy],
  domain: { xmin, xmax, ymin, ymax },
  periodic?: { x?: boolean, y?: boolean },
  axis: { x, y },
  nullclineLabels: { x, y },
  bifurcation: { param, variable: "x" | "y", annotations? },
  time: { dt, horizon },
  presets?: [{ name, params, manifolds? }]
}
```

`f` must be a pure function of the state and the parameter object. The engine finds equilibria by Newton with a finite-difference Jacobian, classifies them from the trace–determinant plane, and integrates trajectories with fixed-step RK4 or adaptive Dormand–Prince RK45. Set `periodic.x` for an angular coordinate such as the hoop’s φ. Set `time.dt` smaller, or switch the UI to RK45, if the field is stiff.

## Deploy

The site is a static Vite build. On Vercel, the framework preset can stay on Vite:

- Build command: `npm run build`
- Output directory: `dist`

`vercel.json` rewrites every path to `index.html`, so client routes such as `/gallery` survive a refresh.
