import type { Domain, Field } from "../math/types"
import { wrap } from "../math/geom"
import type { ThemeName } from "./palette"
import { logSpeed, speedPalette } from "./palette"
import { worldToScreen } from "./viewport"

export type Particles = {
  x: Float32Array
  y: Float32Array
  ox: Float32Array
  oy: Float32Array
  age: Float32Array
  life: Float32Array
  jump: Uint8Array
  bin: Uint8Array
  n: number
  sMax: number
}

export function createParticles(n: number, view: Domain): Particles {
  const p: Particles = {
    x: new Float32Array(n),
    y: new Float32Array(n),
    ox: new Float32Array(n),
    oy: new Float32Array(n),
    age: new Float32Array(n),
    life: new Float32Array(n),
    jump: new Uint8Array(n),
    bin: new Uint8Array(n),
    n,
    sMax: 1,
  }
  for (let i = 0; i < n; i++) respawn(p, i, view, true)
  return p
}

function respawn(p: Particles, i: number, view: Domain, randomAge: boolean) {
  p.x[i] = view.xmin + Math.random() * (view.xmax - view.xmin)
  p.y[i] = view.ymin + Math.random() * (view.ymax - view.ymin)
  p.ox[i] = p.x[i]
  p.oy[i] = p.y[i]
  p.age[i] = randomAge ? Math.random() * 80 : 0
  p.life[i] = 70 + Math.random() * 140
  p.jump[i] = 1
}

/** Visual advection. RK2 so spirals don't drift the way Euler would. */
export function stepParticles(
  p: Particles,
  f: Field,
  view: Domain,
  domain: Domain,
  dt: number,
  periodicX: boolean,
  periodicY: boolean,
) {
  const span = Math.hypot(view.xmax - view.xmin, view.ymax - view.ymin)
  const xPeriod = domain.xmax - domain.xmin
  const yPeriod = domain.ymax - domain.ymin
  let maxS = p.sMax * 0.985
  for (let i = 0; i < p.n; i++) {
    const x = p.x[i]
    const y = p.y[i]
    p.age[i]++
    const outside =
      x < view.xmin || x > view.xmax || y < view.ymin || y > view.ymax || p.age[i] > p.life[i]
    if (outside) {
      respawn(p, i, view, false)
      continue
    }
    const k1 = f(x, y)
    if (!Number.isFinite(k1[0]) || !Number.isFinite(k1[1])) {
      respawn(p, i, view, false)
      continue
    }
    const k2 = f(x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1])
    if (!Number.isFinite(k2[0]) || !Number.isFinite(k2[1])) {
      respawn(p, i, view, false)
      continue
    }
    const rawX = x + dt * k2[0]
    const rawY = y + dt * k2[1]
    const speed = Math.hypot(k2[0], k2[1])
    if (speed > maxS) maxS = speed
    if (Math.hypot(rawX - x, rawY - y) > span * 0.45) {
      respawn(p, i, view, false)
      continue
    }
    let nx = rawX
    let ny = rawY
    if (periodicX) nx = wrap(rawX, domain.xmin, domain.xmax)
    if (periodicY) ny = wrap(rawY, domain.ymin, domain.ymax)
    const jumped =
      (periodicX && Math.abs(nx - x) > 0.5 * xPeriod) || (periodicY && Math.abs(ny - y) > 0.5 * yPeriod)
    p.ox[i] = x
    p.oy[i] = y
    p.x[i] = nx
    p.y[i] = ny
    p.jump[i] = jumped ? 1 : 0
    p.bin[i] = Math.min(31, Math.floor(logSpeed(speed, maxS * 0.02, maxS) * 31))
  }
  p.sMax = Math.max(maxS, 1e-4)
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  p: Particles,
  view: Domain,
  width: number,
  height: number,
  theme: ThemeName,
) {
  const dpr = canvas.width / width
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = "destination-in"
  ctx.fillStyle = "rgba(0,0,0,0.9)"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = "source-over"
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineWidth = 1.35
  ctx.lineCap = "round"
  ctx.globalAlpha = theme === "dark" ? 0.8 : 0.72
  const colors = speedPalette(theme)
  for (let b = 0; b < colors.length; b++) {
    let any = false
    for (let i = 0; i < p.n; i++) {
      if (p.bin[i] !== b || p.jump[i]) continue
      const [x0, y0] = worldToScreen(p.ox[i], p.oy[i], view, width, height)
      const [x1, y1] = worldToScreen(p.x[i], p.y[i], view, width, height)
      if (!any) {
        ctx.beginPath()
        ctx.strokeStyle = colors[b]
        any = true
      }
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
    }
    if (any) ctx.stroke()
  }
  ctx.globalAlpha = 1
}
