export type ThemeName = "dark" | "light"

export function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

const DARK_STOPS: [number, number, number][] = [
  [62, 78, 112],
  [46, 132, 176],
  [62, 184, 162],
  [214, 176, 86],
  [245, 238, 224],
]

const LIGHT_STOPS: [number, number, number][] = [
  [36, 52, 84],
  [18, 110, 132],
  [16, 128, 112],
  [166, 92, 36],
  [72, 42, 28],
]

export function rampColor(t: number, theme: ThemeName): string {
  const stops = theme === "dark" ? DARK_STOPS : LIGHT_STOPS
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const u = x - i
  const a = stops[i]
  const b = stops[i + 1]
  const r = Math.round(a[0] + (b[0] - a[0]) * u)
  const g = Math.round(a[1] + (b[1] - a[1]) * u)
  const bl = Math.round(a[2] + (b[2] - a[2]) * u)
  return `rgb(${r},${g},${bl})`
}

export function speedPalette(theme: ThemeName, n = 32): string[] {
  return Array.from({ length: n }, (_, i) => rampColor(i / (n - 1), theme))
}

export function logSpeed(speed: number, sMin: number, sMax: number): number {
  const a = Math.log(sMin + 1e-8)
  const b = Math.log(sMax + 1e-8)
  if (b - a < 1e-8) return 0.5
  return Math.min(1, Math.max(0, (Math.log(speed + 1e-8) - a) / (b - a)))
}
