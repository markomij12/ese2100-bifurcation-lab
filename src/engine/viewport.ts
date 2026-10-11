import type { Domain } from "../math/types"

export function worldToScreen(
  x: number,
  y: number,
  view: Domain,
  width: number,
  height: number,
): [number, number] {
  const sx = ((x - view.xmin) / (view.xmax - view.xmin)) * width
  const sy = (1 - (y - view.ymin) / (view.ymax - view.ymin)) * height
  return [sx, sy]
}

export function screenToWorld(
  sx: number,
  sy: number,
  view: Domain,
  width: number,
  height: number,
): [number, number] {
  const x = view.xmin + (sx / width) * (view.xmax - view.xmin)
  const y = view.ymin + (1 - sy / height) * (view.ymax - view.ymin)
  return [x, y]
}

export function panView(view: Domain, dx: number, dy: number, width: number, height: number): Domain {
  const wx = ((view.xmax - view.xmin) * dx) / width
  const wy = ((view.ymax - view.ymin) * dy) / height
  return {
    xmin: view.xmin - wx,
    xmax: view.xmax - wx,
    ymin: view.ymin + wy,
    ymax: view.ymax + wy,
  }
}

export function zoomView(
  view: Domain,
  sx: number,
  sy: number,
  width: number,
  height: number,
  factor: number,
): Domain {
  const [wx, wy] = screenToWorld(sx, sy, view, width, height)
  const spanX = (view.xmax - view.xmin) * factor
  const spanY = (view.ymax - view.ymin) * factor
  if (spanX < 1e-4 || spanY < 1e-4 || spanX > 80 || spanY > 80) return view
  const fx = (wx - view.xmin) / (view.xmax - view.xmin)
  const fy = (wy - view.ymin) / (view.ymax - view.ymin)
  return {
    xmin: wx - fx * spanX,
    xmax: wx + (1 - fx) * spanX,
    ymin: wy - fy * spanY,
    ymax: wy + (1 - fy) * spanY,
  }
}

export function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; width: number; height: number } | null {
  const rect = canvas.getBoundingClientRect()
  const width = rect.width
  const height = rect.height
  if (width < 2 || height < 2) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
  const bw = Math.max(1, Math.round(width * dpr))
  const bh = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw
    canvas.height = bh
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width, height }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function piLabel(value: number): string {
  const quarters = Math.round((value / Math.PI) * 4)
  if (Math.abs(value / Math.PI - quarters / 4) > 0.04) return trimNum(value)
  const g = gcd(Math.abs(quarters), 4) || 1
  const n = quarters / g
  const d = 4 / g
  if (n === 0) return "0"
  const sign = n < 0 ? "−" : ""
  const an = Math.abs(n)
  if (d === 1) return an === 1 ? `${sign}π` : `${sign}${an}π`
  return an === 1 ? `${sign}π/${d}` : `${sign}${an}π/${d}`
}

export function trimNum(value: number): string {
  const a = Math.abs(value)
  if (a < 1e-10) return "0"
  if (a >= 100) return value.toFixed(0)
  if (a >= 10) return value.toFixed(1).replace(/\.0$/, "")
  const s = value.toFixed(2)
  return s.replace(/\.?0+$/, "")
}

export function axisTicks(min: number, max: number, pi: boolean): { value: number; label: string }[] {
  const span = max - min
  if (!(span > 0)) return []
  if (pi) {
    let step = Math.PI / 2
    if (span > 10 * Math.PI) step = 2 * Math.PI
    else if (span > 5 * Math.PI) step = Math.PI
    else if (span < 1.1) step = Math.PI / 4
    const ticks: { value: number; label: string }[] = []
    const start = Math.ceil((min + span * 1e-6) / step)
    const end = Math.floor((max - span * 1e-6) / step)
    for (let k = start; k <= end; k++) {
      const value = k * step
      ticks.push({ value, label: piLabel(value) })
    }
    if (ticks.length >= 2) return ticks
  }
  const raw = span / 6
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const mult = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10
  const step = mult * pow
  const ticks: { value: number; label: string }[] = []
  const start = Math.ceil(min / step - 1e-9)
  const end = Math.floor(max / step + 1e-9)
  for (let k = start; k <= end; k++) {
    const value = k * step
    if (value < min + span * 0.02 || value > max - span * 0.02) continue
    ticks.push({ value, label: trimNum(value) })
  }
  return ticks
}
