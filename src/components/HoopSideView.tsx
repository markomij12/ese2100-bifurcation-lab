import { useEffect, useRef, useState } from "react"
import type { Sample } from "../math/types"
import type { Trajectory } from "../engine/types"
import { cssVar } from "../engine/palette"
import { setupCanvas } from "../engine/viewport"

type Props = {
  gamma: number
  beta: number
  phi: number
  velocity: number
  trajectory: Trajectory | null
}

export function HoopSideView(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const state = {
      tau: 0,
      psi: 0.2,
      id: Number.NaN,
      trail: [] as { x: number; y: number }[],
    }
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = propsRef.current
      const samples = p.trajectory ? timeline(p.trajectory) : null
      if (p.trajectory && state.id !== p.trajectory.id) {
        state.id = p.trajectory.id
        state.tau = samples && samples.length ? samples[0].t : 0
        state.trail = []
      }
      if (!p.trajectory) state.id = Number.NaN
      const rate = 2.3
      if (!pausedRef.current) {
        state.psi += dt * rate * Math.sqrt(Math.max(p.gamma, 0))
        if (samples && samples.length > 1) {
          const t0 = samples[0].t
          const t1 = samples[samples.length - 1].t
          const span = Math.max(1e-3, t1 - t0)
          state.tau += dt * rate
          if (state.tau > t1) state.tau = t0 + ((state.tau - t0) % span)
        }
      }
      let phi = p.phi
      let velocity = p.velocity
      if (samples && samples.length) {
        const s = atTime(samples, state.tau)
        phi = s.x
        velocity = s.y
      }
      const ready = setupCanvas(canvas)
      if (ready) {
        const bead = drawHoop(ready.ctx, ready.width, ready.height, phi, state.psi, p.gamma, p.beta, velocity)
        state.trail.push(bead)
        if (state.trail.length > 48) state.trail.shift()
        const ctx = ready.ctx
        ctx.strokeStyle = cssVar("--brass", "#e6c35c")
        ctx.globalAlpha = 0.35
        ctx.lineWidth = 1.2
        ctx.beginPath()
        state.trail.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y)
          else ctx.lineTo(pt.x, pt.y)
        })
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.fillStyle = cssVar("--brass", "#e6c35c")
        ctx.beginPath()
        ctx.arc(bead.x, bead.y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = cssVar("--bg", "#0c0e12")
        ctx.stroke()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section className="card">
      <header className="card-head">
        <h2>Hoop</h2>
        <button type="button" onClick={() => setPaused((value) => !value)}>
          {paused ? "Play" : "Pause"}
        </button>
      </header>
      <div ref={wrapRef} className="hoop-wrap">
        <canvas ref={canvasRef} className="hoop" />
      </div>
      <p className="hint">
        {props.trajectory
          ? "Side view of the launched trajectory. The hoop’s spin is √γ in this time."
          : "Bead sitting at the selected equilibrium. Launch a curve to play φ(t)."}
      </p>
    </section>
  )
}

function timeline(traj: Trajectory): Sample[] {
  const back = traj.backward.slice().reverse()
  if (back.length === 0) return traj.forward
  return back.concat(traj.forward.slice(1))
}

function atTime(samples: Sample[], tau: number): Sample {
  if (tau <= samples[0].t) return samples[0]
  const last = samples[samples.length - 1]
  if (tau >= last.t) return last
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t < tau) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const u = b.t === a.t ? 0 : (tau - a.t) / (b.t - a.t)
  let dphi = b.x - a.x
  while (dphi > Math.PI) dphi -= 2 * Math.PI
  while (dphi < -Math.PI) dphi += 2 * Math.PI
  return { t: tau, x: a.x + u * dphi, y: a.y + u * (b.y - a.y) }
}

function drawHoop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phi: number,
  psi: number,
  gamma: number,
  beta: number,
  velocity: number,
): { x: number; y: number } {
  const bg = cssVar("--plane", "#10141a")
  const ink = cssVar("--text", "#efeae0")
  const muted = cssVar("--muted", "#9a9589")
  const brass = cssVar("--brass", "#e6c35c")
  const line = cssVar("--line", "#2a303a")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  const cx = w * 0.5
  const cy = h * 0.46
  const R = Math.min(w * 0.34, h * 0.36)
  ctx.strokeStyle = line
  ctx.lineWidth = 1
  ctx.setLineDash([3, 4])
  ctx.beginPath()
  ctx.moveTo(cx, cy - R - 16)
  ctx.lineTo(cx, cy + R + 18)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 0.35
  ctx.strokeStyle = muted
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
  const rx = Math.max(1.4, Math.abs(Math.cos(psi)) * R)
  ctx.strokeStyle = ink
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, R, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = muted
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - 18, cy + R + 22)
  ctx.lineTo(cx + 18, cy + R + 22)
  ctx.moveTo(cx, cy + R + 8)
  ctx.lineTo(cx, cy + R + 22)
  ctx.stroke()
  ctx.font = "11px 'IBM Plex Mono', monospace"
  ctx.fillStyle = muted
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillText(`γ ${gamma.toFixed(2)}   β ${beta.toFixed(2)}`, 10, 8)
  ctx.fillText(`φ ${phi.toFixed(2)}   v ${velocity.toFixed(2)}`, 10, 24)
  ctx.textAlign = "center"
  ctx.fillText("g", cx, cy + R + 26)
  const bx = cx + Math.sin(phi) * Math.cos(psi) * R
  const by = cy + Math.cos(phi) * R
  ctx.strokeStyle = brass
  ctx.globalAlpha = 0.45
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  return { x: bx, y: by }
}
