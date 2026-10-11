import { useEffect, useRef } from "react"
import { classLabel, isAttracting } from "../math/classify"
import type { FixedPoint } from "../math/fixedPoints"
import { cssVar } from "../engine/palette"
import { setupCanvas } from "../engine/viewport"

export function TraceDetPlane({ points, selected }: { points: FixedPoint[]; selected: FixedPoint | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const draw = () => {
      const ready = setupCanvas(canvas)
      if (!ready) return
      paint(ready.ctx, ready.width, ready.height, points, selected)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [points, selected])

  return (
    <section className="card">
      <header className="card-head">
        <h2>Trace–determinant</h2>
        <span className="quiet">τ² = 4Δ</span>
      </header>
      <div ref={wrapRef} className="td-wrap">
        <canvas ref={ref} className="td" />
      </div>
      {selected ? (
        <p className="eq-read">
          <strong>{classLabel(selected.kind)}</strong>
          <span>
            τ = {selected.trace.toFixed(3)} · Δ = {selected.det.toFixed(3)} · index{" "}
            {selected.index === null ? "—" : selected.index > 0 ? "+1" : "−1"}
          </span>
        </p>
      ) : (
        <p className="hint">Click a fixed point.</p>
      )}
    </section>
  )
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  points: FixedPoint[],
  selected: FixedPoint | null,
) {
  const plane = cssVar("--plane", "#10141a")
  const muted = cssVar("--muted", "#9a9589")
  const stable = cssVar("--stable", "#4ec9b0")
  const unstable = cssVar("--unstable", "#e07a5f")
  const brass = cssVar("--brass", "#e6c35c")
  const grid = cssVar("--grid", "rgba(232,220,196,0.14)")
  ctx.fillStyle = plane
  ctx.fillRect(0, 0, w, h)

  let t0 = -2
  let t1 = 2
  let d0 = -1.5
  let d1 = 2.4
  for (const fp of points) {
    t0 = Math.min(t0, fp.trace)
    t1 = Math.max(t1, fp.trace)
    d0 = Math.min(d0, fp.det)
    d1 = Math.max(d1, fp.det)
  }
  const padT = (t1 - t0) * 0.22 || 0.4
  const padD = (d1 - d0) * 0.22 || 0.4
  t0 -= padT
  t1 += padT
  d0 -= padD
  d1 += padD
  const para = Math.max(t0 * t0, t1 * t1) / 4
  if (para < d1 * 3) d1 = Math.max(d1, para * 0.55)

  const pad = { l: 36, r: 12, t: 12, b: 28 }
  const X = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (w - pad.l - pad.r)
  const Y = (d: number) => pad.t + (1 - (d - d0) / (d1 - d0)) * (h - pad.t - pad.b)

  ctx.fillStyle = "rgba(224,122,95,0.08)"
  ctx.fillRect(pad.l, Y(0), w - pad.l - pad.r, Y(d0) - Y(0))

  ctx.beginPath()
  ctx.moveTo(X(t0), Y(t0 * t0 / 4))
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    ctx.lineTo(X(t), Y((t * t) / 4))
  }
  ctx.lineTo(X(t1), Y(d1))
  ctx.lineTo(X(t0), Y(d1))
  ctx.closePath()
  ctx.fillStyle = "rgba(78,201,176,0.07)"
  ctx.fill()

  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(X(t0), Y(0))
  ctx.lineTo(X(t1), Y(0))
  ctx.moveTo(X(0), Y(d0))
  ctx.lineTo(X(0), Y(d1))
  ctx.stroke()

  ctx.strokeStyle = brass
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps
    const x = X(t)
    const y = Y((t * t) / 4)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  for (const fp of points) {
    const on = selected != null && selected.x === fp.x && selected.y === fp.y
    const color = fp.kind === "saddle" || fp.kind === "center" ? brass : isAttracting(fp.kind) ? stable : unstable
    ctx.beginPath()
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.arc(X(fp.trace), Y(fp.det), on ? 6 : 4, 0, Math.PI * 2)
    if (fp.kind === "saddle" || !isAttracting(fp.kind)) {
      ctx.lineWidth = on ? 2 : 1.5
      ctx.stroke()
    } else {
      ctx.fill()
    }
    if (on) {
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.arc(X(fp.trace), Y(fp.det), 10, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  ctx.fillStyle = muted
  ctx.font = "11px 'IBM Plex Mono', monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.fillText("τ", (pad.l + w - pad.r) / 2, h - 2)
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText("Δ", pad.l + 4, 2)
  ctx.font = "10px 'IBM Plex Sans', sans-serif"
  ctx.fillText("spirals", X(t0) + 6, Y(d1) + 4)
  if (Y(0) > pad.t + 28) ctx.fillText("nodes", X(Math.max(t0, -0.2)) + 8, Y(Math.max(0, d0) * 0.35 + 0.15))
}
