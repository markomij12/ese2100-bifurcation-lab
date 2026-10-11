import type { FixedPoint } from "../math/fixedPoints"
import type { LimitCycle } from "../math/limitCycles"
import type { Nullclines, Segment } from "../math/nullclines"
import type { Domain, Field, Vec2 } from "../math/types"
import { classLabel } from "../math/classify"
import { cssVar, logSpeed, rampColor, type ThemeName } from "./palette"
import type { Trajectory } from "./types"
import { axisTicks, worldToScreen } from "./viewport"

export type Scene = {
  theme: ThemeName
  view: Domain
  domain: Domain
  width: number
  height: number
  field: Field | null
  nullclines: Nullclines | null
  nullclineLabels: { x: string; y: string }
  manifolds: { stable: Vec2[][]; unstable: Vec2[][] } | null
  cycles: LimitCycle[]
  trajectories: Trajectory[]
  fixedPoints: FixedPoint[]
  selected: FixedPoint | null
  hovered: FixedPoint | null
  periodicX: boolean
  periodicY: boolean
  axis: { x: string; y: string }
  pi: { x: boolean; y: boolean }
  caption: string
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { width: w, height: h, view } = scene
  const plane = cssVar("--plane", "#10141a")
  const grid = cssVar("--grid", "rgba(232,220,196,0.08)")
  const axis = cssVar("--axis", "rgba(232,220,196,0.28)")
  const text = cssVar("--text", "#efeae0")
  const muted = cssVar("--muted", "#9a9589")
  const stable = cssVar("--stable", "#4ec9b0")
  const unstable = cssVar("--unstable", "#e07a5f")
  const brass = cssVar("--brass", "#e6c35c")
  const nullX = cssVar("--null-x", "#e07a5f")
  const nullY = cssVar("--null-y", "#4ec9b0")
  const manS = cssVar("--manifold-s", "#8eb6f0")
  const manU = cssVar("--manifold-u", "#e6c35c")
  const cycle = cssVar("--cycle", "#c9a6ef")

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = plane
  ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.72)
  glow.addColorStop(0, scene.theme === "dark" ? "rgba(230,195,92,0.045)" : "rgba(138,90,18,0.05)")
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  drawGrid(ctx, scene, grid, axis, muted)
  if (scene.field) drawField(ctx, scene)
  if (scene.nullclines) {
    strokeSegments(ctx, scene.nullclines.x, view, w, h, nullX, 1.7)
    strokeSegments(ctx, scene.nullclines.y, view, w, h, nullY, 1.7)
  }
  if (scene.manifolds) {
    for (const line of scene.manifolds.stable) strokeWorld(ctx, line, scene, manS, 1.6, [], false)
    for (const line of scene.manifolds.unstable) strokeWorld(ctx, line, scene, manU, 1.6, [], false)
  }
  for (const c of scene.cycles) {
    strokeWorld(ctx, c.points, scene, cycle, 2.2, c.stable ? [] : [6, 5], false)
  }
  scene.trajectories.forEach((traj, index) => {
    const latest = index === scene.trajectories.length - 1
    const color = TRAJ_COLORS[scene.theme][index % TRAJ_COLORS[scene.theme].length]
    ctx.globalAlpha = latest ? 0.95 : 0.42
    const forward = traj.forward.map((s) => [s.x, s.y] as Vec2)
    const backward = traj.backward.map((s) => [s.x, s.y] as Vec2).reverse()
    strokeWorld(ctx, backward, scene, color, latest ? 1.8 : 1.3, [], true)
    strokeWorld(ctx, forward, scene, color, latest ? 1.8 : 1.3, [], true)
    const [sx, sy] = worldToScreen(traj.seed.x, traj.seed.y, view, w, h)
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(sx, sy, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  })
  ctx.globalAlpha = 1

  for (const fp of scene.fixedPoints) {
    for (const [x, y] of copies(fp.x, fp.y, scene)) {
      const [sx, sy] = worldToScreen(x, y, view, w, h)
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) continue
      const on = scene.selected && samePoint(scene.selected, fp)
      const hot = scene.hovered && samePoint(scene.hovered, fp)
      drawMarker(ctx, sx, sy, fp, plane, stable, unstable, brass, muted, !!on, !!hot)
    }
  }

  ctx.font = "12px 'IBM Plex Sans', sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "top"
  ctx.fillStyle = muted
  ctx.fillText(scene.axis.y, 10, 8)
  ctx.textAlign = "right"
  ctx.textBaseline = "bottom"
  ctx.fillText(scene.axis.x, w - 10, h - 8)

  ctx.font = "12px 'IBM Plex Mono', monospace"
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = text
  ctx.globalAlpha = 0.9
  ctx.fillText(scene.caption, 12, h - 14)
  ctx.globalAlpha = 1

  if (scene.nullclines) {
    drawLegend(ctx, scene, nullX, nullY, muted)
  }
}

const TRAJ_COLORS: Record<ThemeName, string[]> = {
  dark: ["#f3ead7", "#e6c35c", "#f0a070", "#8fd0c4", "#d7c4f2"],
  light: ["#3a342c", "#8a5a12", "#b4532a", "#0f6e68", "#5b3f86"],
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  nullX: string,
  nullY: string,
  muted: string,
) {
  const x = 12
  let y = 16
  ctx.font = "11px 'IBM Plex Sans', sans-serif"
  ctx.textAlign = "left"
  ctx.textBaseline = "middle"
  const rows: [string, string][] = [
    [nullX, scene.nullclineLabels.x],
    [nullY, scene.nullclineLabels.y],
  ]
  for (const [color, label] of rows) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 16, y)
    ctx.stroke()
    ctx.fillStyle = muted
    ctx.fillText(label, x + 22, y)
    y += 16
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  grid: string,
  axis: string,
  muted: string,
) {
  const { view, width: w, height: h } = scene
  const xt = axisTicks(view.xmin, view.xmax, scene.pi.x)
  const yt = axisTicks(view.ymin, view.ymax, scene.pi.y)
  ctx.lineWidth = 1
  ctx.strokeStyle = grid
  ctx.beginPath()
  for (const tick of xt) {
    const [sx] = worldToScreen(tick.value, view.ymin, view, w, h)
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, h)
  }
  for (const tick of yt) {
    const [, sy] = worldToScreen(view.xmin, tick.value, view, w, h)
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
  }
  ctx.stroke()

  ctx.strokeStyle = axis
  ctx.beginPath()
  if (view.ymin < 0 && view.ymax > 0) {
    const [, sy] = worldToScreen(0, 0, view, w, h)
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
  }
  if (view.xmin < 0 && view.xmax > 0) {
    const [sx] = worldToScreen(0, 0, view, w, h)
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, h)
  }
  ctx.stroke()

  ctx.font = "11px 'IBM Plex Mono', monospace"
  ctx.fillStyle = muted
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  for (const tick of xt) {
    const [sx, sy] = worldToScreen(tick.value, Math.min(Math.max(0, view.ymin), view.ymax), view, w, h)
    const y = Math.min(h - 18, Math.max(6, sy + 4))
    halo(ctx, tick.label, sx, y)
  }
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (const tick of yt) {
    const [sx, sy] = worldToScreen(Math.min(Math.max(0, view.xmin), view.xmax), tick.value, view, w, h)
    const x = Math.min(w - 6, Math.max(28, sx - 6))
    halo(ctx, tick.label, x, sy)
  }
}

function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.strokeStyle = cssVar("--plane", "#10141a")
  ctx.lineWidth = 3
  ctx.strokeText(text, x, y)
  ctx.fillText(text, x, y)
}

function drawField(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { view, width: w, height: h, field } = scene
  if (!field) return
  const nx = 28
  const ny = 22
  const samples: { x: number; y: number; dx: number; dy: number; s: number }[] = []
  let sMin = Infinity
  let sMax = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = view.xmin + ((i + 0.5) / nx) * (view.xmax - view.xmin)
      const y = view.ymin + ((j + 0.5) / ny) * (view.ymax - view.ymin)
      const v = field(x, y)
      if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) continue
      const s = Math.hypot(v[0], v[1])
      if (s < 1e-6) continue
      samples.push({ x, y, dx: v[0], dy: v[1], s })
      if (s < sMin) sMin = s
      if (s > sMax) sMax = s
    }
  }
  const cell = Math.min(w / nx, h / ny) * 0.62
  ctx.lineWidth = 1.15
  for (const s of samples) {
    const [sx, sy] = worldToScreen(s.x, s.y, view, w, h)
    const [tx, ty] = worldToScreen(s.x + s.dx, s.y + s.dy, view, w, h)
    const dx = tx - sx
    const dy = ty - sy
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const ux = dx / len
    const uy = dy / len
    const tipX = sx + ux * cell
    const tipY = sy + uy * cell
    const color = rampColor(logSpeed(s.s, sMin, sMax), scene.theme)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = 0.88
    ctx.beginPath()
    ctx.moveTo(sx - ux * cell * 0.15, sy - uy * cell * 0.15)
    ctx.lineTo(tipX, tipY)
    ctx.stroke()
    arrowHead(ctx, tipX, tipY, Math.atan2(uy, ux), 3.4)
  }
  ctx.globalAlpha = 1
}

function strokeSegments(
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  view: Domain,
  w: number,
  h: number,
  color: string,
  width: number,
) {
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = "round"
  for (const seg of segments) {
    const [x0, y0] = worldToScreen(seg.a[0], seg.a[1], view, w, h)
    const [x1, y1] = worldToScreen(seg.b[0], seg.b[1], view, w, h)
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
  }
  ctx.stroke()
}

function strokeWorld(
  ctx: CanvasRenderingContext2D,
  points: Vec2[],
  scene: Scene,
  color: string,
  width: number,
  dash: number[],
  arrows: boolean,
) {
  if (points.length < 2) return
  eachRun(points, scene, (run) => {
    const screen = run.map((p) => worldToScreen(p[0], p[1], scene.view, scene.width, scene.height))
    ctx.beginPath()
    ctx.moveTo(screen[0][0], screen[0][1])
    for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i][0], screen[i][1])
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.setLineDash(dash)
    ctx.stroke()
    ctx.setLineDash([])
    if (!arrows) return
    let acc = 40
    for (let i = 1; i < screen.length; i++) {
      const dx = screen[i][0] - screen[i - 1][0]
      const dy = screen[i][1] - screen[i - 1][1]
      const len = Math.hypot(dx, dy)
      if (len < 0.4) continue
      acc += len
      const last = i === screen.length - 1
      if (acc > 84 || last) {
        acc = 0
        ctx.fillStyle = color
        arrowHead(ctx, screen[i][0], screen[i][1], Math.atan2(dy, dx), last ? 7 : 5.5)
      }
    }
  })
}

function eachRun(points: Vec2[], scene: Scene, draw: (run: Vec2[]) => void) {
  const xw = scene.domain.xmax - scene.domain.xmin
  const yw = scene.domain.ymax - scene.domain.ymin
  let cur: Vec2[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const jumpX = scene.periodicX && Math.abs(points[i][0] - points[i - 1][0]) > 0.5 * xw
    const jumpY = scene.periodicY && Math.abs(points[i][1] - points[i - 1][1]) > 0.5 * yw
    if (jumpX || jumpY) {
      if (cur.length >= 2) draw(cur)
      cur = [points[i]]
    } else {
      cur.push(points[i])
    }
  }
  if (cur.length >= 2) draw(cur)
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(size, 0)
  ctx.lineTo(-size * 0.75, size * 0.48)
  ctx.lineTo(-size * 0.75, -size * 0.48)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  fp: FixedPoint,
  plane: string,
  stable: string,
  unstable: string,
  brass: string,
  muted: string,
  selected: boolean,
  hovered: boolean,
) {
  const r = selected || hovered ? 7.5 : 5.6
  const attracting = fp.kind === "stable-node" || fp.kind === "stable-spiral"
  const color =
    fp.kind === "saddle" || fp.kind === "center"
      ? brass
      : fp.kind === "degenerate"
        ? muted
        : attracting
          ? stable
          : unstable
  ctx.lineWidth = selected ? 2.4 : 1.7
  ctx.strokeStyle = color
  ctx.fillStyle = color
  if (fp.kind === "saddle") {
    const a = r + 1
    ctx.beginPath()
    ctx.moveTo(sx - a, sy - a)
    ctx.lineTo(sx + a, sy + a)
    ctx.moveTo(sx + a, sy - a)
    ctx.lineTo(sx - a, sy + a)
    ctx.stroke()
  } else if (fp.kind === "degenerate") {
    ctx.beginPath()
    ctx.moveTo(sx, sy - r)
    ctx.lineTo(sx + r, sy)
    ctx.lineTo(sx, sy + r)
    ctx.lineTo(sx - r, sy)
    ctx.closePath()
    ctx.stroke()
  } else if (fp.kind === "center") {
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sx, sy, 2.2, 0, Math.PI * 2)
    ctx.fill()
  } else if (attracting) {
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.lineWidth = 1.8
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sx, sy, r - 2.3, 0, Math.PI * 2)
    ctx.fillStyle = plane
    ctx.fill()
  }
  if (selected) {
    ctx.beginPath()
    ctx.arc(sx, sy, r + 5, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (hovered) {
    ctx.font = "11px 'IBM Plex Sans', sans-serif"
    ctx.textAlign = "left"
    ctx.textBaseline = "bottom"
    ctx.fillStyle = color
    ctx.fillText(classLabel(fp.kind), sx + r + 6, sy - 2)
  }
}

function copies(x: number, y: number, scene: Scene): Vec2[] {
  const pts: Vec2[] = [[x, y]]
  if (scene.periodicX) {
    const w = scene.domain.xmax - scene.domain.xmin
    pts.push([x - w, y], [x + w, y])
  }
  if (scene.periodicY) {
    const h = scene.domain.ymax - scene.domain.ymin
    const more = pts.flatMap(([px, py]) => [
      [px, py - h] as Vec2,
      [px, py + h] as Vec2,
    ])
    pts.push(...more)
  }
  const padX = (scene.view.xmax - scene.view.xmin) * 0.02
  const padY = (scene.view.ymax - scene.view.ymin) * 0.02
  return pts.filter(
    (p) =>
      p[0] >= scene.view.xmin - padX &&
      p[0] <= scene.view.xmax + padX &&
      p[1] >= scene.view.ymin - padY &&
      p[1] <= scene.view.ymax + padY,
  )
}

function samePoint(a: FixedPoint, b: FixedPoint): boolean {
  return a.x === b.x && a.y === b.y
}
