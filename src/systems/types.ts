import type { Domain, Vec2 } from "../math/types"

export type ParamSpec = {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
}

export type Preset = {
  name: string
  params: Record<string, number>
  /** Turn saddle manifolds on — the separatrix is the point of the picture. */
  manifolds?: boolean
}

export type System = {
  id: string
  name: string
  description: string
  theory: string
  params: ParamSpec[]
  f: (x: number, y: number, p: Record<string, number>) => Vec2
  domain: Domain
  periodic?: { x?: boolean; y?: boolean }
  axis: { x: string; y: string }
  piTicks?: { x?: boolean; y?: boolean }
  nullclineLabels: { x: string; y: string }
  presets?: Preset[]
  bifurcation: {
    param: string
    variable: "x" | "y"
    annotations?: { param: string; value: number; label: string }[]
  }
  time: { dt: number; horizon: number }
  sideView?: "hoop"
}

export function defaultParams(system: System): Record<string, number> {
  const params: Record<string, number> = {}
  for (const p of system.params) params[p.key] = p.default
  return params
}
