import { useEffect, useRef } from "react"
import type { BifBranch } from "../math/bifurcation"
import type { CycleAmpBranch } from "../math/bifurcation"
import { isAttracting } from "../math/classify"
import type { FixedPoint } from "../math/fixedPoints"
import type { Domain } from "../math/types"
import type { ParamSpec } from "../systems/types"
import { cssVar } from "../engine/palette"
import type { ThemeName } from "../engine/palette"
import { setupCanvas } from "../engine/viewport"

type Props = {
  param: ParamSpec
  value: number
  onChange: (value: number) => void
  variable: "x" | "y" | "both"
  onVariable: (variable: "x" | "y" | "both") => void
  variableLabels: { x: string; y: string }
  domain: Domain
  branches: BifBranch[]
  cycleBranches: CycleAmpBranch[]
  livePoints: FixedPoint[]
  annotations: { value: number; label: string }[]
  theme: ThemeName
  loadingCycles: boolean
}

const PAD = { l: 44, r: 12, t: 22, b: 32 }

export function BifurcationPanel(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const draw = () => {
      const ready = setupCanvas(canvas)
      if (!ready) return
      paint(ready.ctx, ready.width, ready.height, props)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [props])

  function pointerValue(event: React.PointerEvent) {
    const canvas = ref.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const span = rect.width - PAD.l - PAD.r
    const t = (x - PAD.l) / span
    const value = props.param.min + t * (props.param.max - props.param.min)
    props.onChange(Math.min(props.param.max, Math.max(props.param.min, value)))
  }

  return (
    <section className="card">
      <header className="card-head">
        <h2>Bifurcation</h2>
        <div className="seg">
          {(["x", "y", "both"] as const).map((variable) => (
            <button
              key={variable}
              type="button"
              className={props.variable === variable ? "on" : ""}
              onClick={() => props.onVariable(variable)}
            >
              {variable === "both" ? "both" : props.variableLabels[variable]}
            </button>
          ))}
        </div>
      </header>
      <div ref={wrapRef} className="diagram-wrap">
        <canvas ref={ref} className="diagram" onPointerDown={pointerValue} />
      </div>
      <p className="hint">
        {props.variableLabels[props.variable === "y" ? "y" : "x"]} against {props.param.label}. Solid is attracting, dashed is not.
        {props.loadingCycles ? " Looking for cycles…" : ""}
      </p>
    </section>
  )
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, props: Props) {
  const plane = cssVar("--plane", "#10141a")
  const muted = cssVar("--muted", "#9a9589")
  const text = cssVar("--text", "#efeae0")
  const stable = cssVar("--stable", "#4ec9b0")
  const unstable = cssVar("--unstable", "#e07a5f")
  const brass = cssVar("--brass", "#e6c35c")
  const grid = cssVar("--grid", "rgba(232,220,196,0.08)")
  const cycle = cssVar("--cycle", "#c9a6ef")
  const yStable = cssVar("--manifold-s", "#8eb6f0")
  ctx.fillStyle = plane
  ctx.fillRect(0, 0, w, h)

  const yMin0 = props.variable === "y" ? props.domain.ymin : props.domain.xmin
  const yMax0 = props.variable === "y" ? props.domain.ymax : props.domain.xmax
  const yMin = props.variable === "both" ? Math.min(props.domain.ymin, props.domain.xmin) : yMin0
  const yMax = props.variable === "both" ? Math.max(props.domain.ymax, props.domain.xmax) : yMax0
  const padY = (yMax - yMin) * 0.06 || 0.2
  const y0 = yMin - padY
  const y1 = yMax + padY
  const X = (p: number) => PAD.l + ((p - props.param.min) / (props.param.max - props.param.min)) * (w - PAD.l - PAD.r)
  const Y = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (h - PAD.t - PAD.b)

  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const yTicks = 5
  for (let i = 0; i <= yTicks; i++) {
    const v = y0 + ((y1 - y0) * i) / yTicks
    ctx.moveTo(PAD.l, Y(v))
    ctx.lineTo(w - PAD.r, Y(v))
  }
  ctx.stroke()

  const vars: ("x" | "y")[] = props.variable === "both" ? ["x", "y"] : [props.variable]
  for (const variable of vars) {
    const palette = variable === "y" ? { stable: yStable, unstable: "#d08a62" } : { stable, unstable }
    for (const branch of props.branches) {
      let run: { p: number; v: number; dash: number[]; color: string }[] = []
      const flush = () => {
        if (run.length < 2) {
          run = []
          return
        }
        ctx.beginPath()
        ctx.strokeStyle = run[0].color
        ctx.lineWidth = 1.8
        ctx.setLineDash(run[0].dash)
        run.forEach((pt, i) => {
          const x = X(pt.p)
          const y = Y(pt.v)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
        ctx.setLineDash([])
        run = []
      }
      for (let i = 0; i < branch.samples.length; i++) {
        const s = branch.samples[i]
        const prev = branch.samples[i - 1]
        const v = variable === "x" ? s.x : s.y
        const style = strokeFor(s.kind, s.attracting, palette, brass, cssVar("--muted", "#9a9589"))
        const gap = prev && s.p - prev.p > ((props.param.max - props.param.min) / 40)
        if (run.length && (gap || style.color !== run[0].color || style.dash.join() !== run[0].dash.join())) flush()
        run.push({ p: s.p, v, ...style })
      }
      flush()
    }
  }

  for (const branch of props.cycleBranches) {
    ctx.beginPath()
    ctx.strokeStyle = cycle
    ctx.lineWidth = 1.6
    ctx.setLineDash(branch.stable ? [] : [5, 4])
    branch.samples.forEach((s, i) => {
      const x = X(s.p)
      const y = Y(s.value)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.setLineDash([])
  }

  const xLine = X(props.value)
  ctx.strokeStyle = brass
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(xLine, PAD.t)
  ctx.lineTo(xLine, h - PAD.b)
  ctx.stroke()

  for (const fp of props.livePoints) {
    const coords = vars.map((variable) => (variable === "x" ? fp.x : fp.y))
    coords.forEach((v) => {
      ctx.beginPath()
      ctx.fillStyle = isAttracting(fp.kind) ? stable : fp.kind === "center" ? brass : unstable
      ctx.arc(xLine, Y(v), 3.4, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  ctx.font = "11px 'IBM Plex Sans', sans-serif"
  ctx.fillStyle = brass
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  for (const note of props.annotations) {
    ctx.fillText(note.label, X(note.value) + 4, PAD.t - 16)
  }

  ctx.fillStyle = muted
  ctx.font = "11px 'IBM Plex Mono', monospace"
  ctx.textAlign = "center"
  ctx.textBaseline = "bottom"
  ctx.fillText(props.param.label, (PAD.l + w - PAD.r) / 2, h - 4)
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  const stateLabel = props.variable === "both" ? `${props.variableLabels.x}, ${props.variableLabels.y}` : props.variableLabels[props.variable]
  ctx.save()
  ctx.translate(12, (PAD.t + h - PAD.b) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = "center"
  ctx.fillText(stateLabel, 0, 0)
  ctx.restore()

  ctx.fillStyle = text
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText(`${props.param.label} = ${props.value.toFixed(2)}`, PAD.l, 4)
}

function strokeFor(
  kind: string,
  attracting: boolean,
  palette: { stable: string; unstable: string },
  brass: string,
  muted: string,
): { color: string; dash: number[] } {
  if (kind === "center") return { color: brass, dash: [1.2, 3] }
  if (kind === "degenerate") return { color: muted, dash: [3, 3] }
  if (attracting) return { color: palette.stable, dash: [] }
  return { color: palette.unstable, dash: [5, 4] }
}
