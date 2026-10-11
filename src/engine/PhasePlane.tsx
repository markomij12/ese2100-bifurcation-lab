import { useEffect, useRef, useState } from "react"
import { classLabel, formatEigenvalues } from "../math/classify"
import type { FixedPoint } from "../math/fixedPoints"
import type { LimitCycle } from "../math/limitCycles"
import type { Nullclines } from "../math/nullclines"
import { periodicDistance } from "../math/geom"
import type { Domain, Field, Vec2 } from "../math/types"
import type { System } from "../systems/types"
import { drawScene } from "./draw"
import { createParticles, drawParticles, stepParticles, type Particles } from "./particles"
import type { ThemeName, Toggles, Trajectory } from "./types"
import { panView, screenToWorld, setupCanvas, worldToScreen, zoomView } from "./viewport"

type Props = {
  system: System
  field: Field
  params: Record<string, number>
  view: Domain
  onView: (view: Domain) => void
  toggles: Toggles
  onMode: (mode: Toggles["mode"]) => void
  fixedPoints: FixedPoint[]
  nullclines: Nullclines | null
  manifolds: { stable: Vec2[][]; unstable: Vec2[][] } | null
  cycles: LimitCycle[]
  trajectories: Trajectory[]
  onShoot: (x: number, y: number) => void
  onClear: () => void
  selected: FixedPoint | null
  onSelect: (fp: FixedPoint | null) => void
  theme: ThemeName
}

export function PhasePlane(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const staticRef = useRef<HTMLCanvasElement>(null)
  const flowRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLSpanElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const particlesRef = useRef<Particles | null>(null)
  const [hover, setHover] = useState<{ fp: FixedPoint; x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const drag = useRef<{ x: number; y: number; view: Domain; moved: boolean } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ width: r.width, height: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = staticRef.current
    if (!canvas || size.width < 2) return
    const ready = setupCanvas(canvas)
    if (!ready) return
    const p = propsRef.current
    drawScene(ready.ctx, {
      theme: p.theme,
      view: p.view,
      domain: p.system.domain,
      width: ready.width,
      height: ready.height,
      field: p.toggles.vectorField ? p.field : null,
      nullclines: p.toggles.nullclines ? p.nullclines : null,
      nullclineLabels: p.system.nullclineLabels,
      manifolds: p.toggles.manifolds ? p.manifolds : null,
      cycles: p.toggles.cycles ? p.cycles : [],
      trajectories: p.trajectories,
      fixedPoints: p.fixedPoints,
      selected: p.selected,
      hovered: hover?.fp ?? null,
      periodicX: !!p.system.periodic?.x,
      periodicY: !!p.system.periodic?.y,
      axis: p.system.axis,
      pi: { x: !!p.system.piTicks?.x, y: !!p.system.piTicks?.y },
      caption: p.system.params.map((param) => `${param.label} = ${p.params[param.key].toFixed(2)}`).join("    "),
    })
  }, [size, props.view, props.params, props.fixedPoints, props.nullclines, props.manifolds, props.cycles, props.trajectories, props.theme, props.toggles, props.selected, hover, props.field, props.system])

  useEffect(() => {
    const canvas = flowRef.current
    if (!canvas) return
    particlesRef.current = null
    let raf = 0
    let frames = 0
    let stamp = performance.now()
    let lastView = propsRef.current.view
    let lastTheme = propsRef.current.theme
    const loop = (now: number) => {
      const p = propsRef.current
      const ready = setupCanvas(canvas)
      if (ready && p.toggles.flow) {
        const viewChanged =
          lastView.xmin !== p.view.xmin ||
          lastView.xmax !== p.view.xmax ||
          lastView.ymin !== p.view.ymin ||
          lastView.ymax !== p.view.ymax
        if (p.theme !== lastTheme) {
          ready.ctx.clearRect(0, 0, ready.width, ready.height)
          lastTheme = p.theme
        }
        if (viewChanged || particlesRef.current === null || particlesRef.current.n !== 2000) {
          if (viewChanged) ready.ctx.clearRect(0, 0, ready.width, ready.height)
          if (particlesRef.current === null) particlesRef.current = createParticles(2000, p.view)
          lastView = p.view
        }
        const particles = particlesRef.current
        if (particles) {
          stepParticles(
            particles,
            p.field,
            p.view,
            p.system.domain,
            0.022,
            !!p.system.periodic?.x,
            !!p.system.periodic?.y,
          )
          drawParticles(ready.ctx, canvas, particles, p.view, ready.width, ready.height, p.theme)
        }
        frames++
        if (now - stamp > 500) {
          if (fpsRef.current) fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - stamp))} fps`
          frames = 0
          stamp = now
        }
      } else if (ready && !p.toggles.flow) {
        ready.ctx.setTransform(1, 0, 0, 1, 0, 0)
        ready.ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (fpsRef.current) fpsRef.current.textContent = ""
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [props.system.id])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(event.deltaY * 0.00115)
      propsRef.current.onView(
        zoomView(
          propsRef.current.view,
          event.clientX - rect.left,
          event.clientY - rect.top,
          rect.width,
          rect.height,
          factor,
        ),
      )
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  function localPoint(event: { clientX: number; clientY: number }) {
    const el = wrapRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      sx: event.clientX - rect.left,
      sy: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  function hitFixedPoint(sx: number, sy: number, width: number, height: number): FixedPoint | null {
    const p = propsRef.current
    let best: FixedPoint | null = null
    let bestD = 16
    for (const fp of p.fixedPoints) {
      const spots: Vec2[] = [[fp.x, fp.y]]
      if (p.system.periodic?.x) {
        const w = p.system.domain.xmax - p.system.domain.xmin
        spots.push([fp.x - w, fp.y], [fp.x + w, fp.y])
      }
      for (const spot of spots) {
        const [px, py] = worldToScreen(spot[0], spot[1], p.view, width, height)
        const d = Math.hypot(px - sx, py - sy)
        if (d < bestD) {
          bestD = d
          best = fp
        }
      }
    }
    return best
  }

  return (
    <div
      ref={wrapRef}
      className={`plane-wrap ${props.toggles.mode === "launch" ? "is-launch" : "is-pan"}`}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-ui]")) return
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, view: props.view, moved: false }
      }}
      onPointerMove={(event) => {
        const point = localPoint(event)
        if (!point) return
        const d = drag.current
        if (!d) {
          const fp = hitFixedPoint(point.sx, point.sy, point.width, point.height)
          setHover(fp ? { fp, x: point.sx, y: point.sy } : null)
          return
        }
        const dx = event.clientX - d.x
        const dy = event.clientY - d.y
        if (Math.hypot(dx, dy) > 4) d.moved = true
        if (props.toggles.mode === "pan" && d.moved) {
          props.onView(panView(d.view, dx, dy, point.width, point.height))
        }
      }}
      onPointerUp={(event) => {
        const d = drag.current
        drag.current = null
        if (!d || d.moved) return
        const point = localPoint(event)
        if (!point) return
        const fp = hitFixedPoint(point.sx, point.sy, point.width, point.height)
        if (fp) {
          props.onSelect(fp)
          return
        }
        if (props.toggles.mode === "launch") {
          const [x, y] = screenToWorld(point.sx, point.sy, props.view, point.width, point.height)
          props.onShoot(x, y)
        }
      }}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-ui]")) return
        props.onView(props.system.domain)
      }}
    >
      <canvas ref={staticRef} className="plane-canvas" />
      <canvas ref={flowRef} className="plane-canvas plane-flow" />
      <div className="plane-bar" data-ui>
        <div className="seg">
          <button
            type="button"
            className={props.toggles.mode === "pan" ? "on" : ""}
            onClick={() => props.onMode("pan")}
          >
            Pan
          </button>
          <button
            type="button"
            className={props.toggles.mode === "launch" ? "on" : ""}
            onClick={() => props.onMode("launch")}
          >
            Launch
          </button>
        </div>
        <button type="button" onClick={() => props.onView(props.system.domain)}>
          Reset view
        </button>
        <button type="button" onClick={props.onClear}>
          Clear curves
        </button>
        <span ref={fpsRef} className="fps" />
      </div>
      {hover && (
        <div className="tip" style={{ left: Math.min(hover.x + 14, size.width - 210), top: Math.max(8, hover.y - 78) }}>
          <strong>{classLabel(hover.fp.kind)}</strong>
          <span>λ = {formatEigenvalues(hover.fp.eigenvalues)}</span>
          <span>
            index {hover.fp.index === null ? "—" : hover.fp.index > 0 ? "+1" : "−1"}
            {"  "}τ = {hover.fp.trace.toFixed(3)}  Δ = {hover.fp.det.toFixed(3)}
          </span>
          <span className="quiet">
            {props.system.axis.x} = {fmt3(hover.fp.x)}, {props.system.axis.y} = {fmt3(hover.fp.y)}
          </span>
        </div>
      )}
    </div>
  )
}

export function nearestFixedPoint(
  x: number,
  y: number,
  points: FixedPoint[],
  system: System,
): FixedPoint | null {
  let best: FixedPoint | null = null
  let bestD = Infinity
  for (const fp of points) {
    const d = periodicDistance(x, y, fp.x, fp.y, system.domain, !!system.periodic?.x, !!system.periodic?.y)
    if (d < bestD) {
      bestD = d
      best = fp
    }
  }
  return best
}

function fmt3(n: number): string {
  const v = Math.abs(n) < 5e-4 ? 0 : n
  return v.toFixed(3)
}
