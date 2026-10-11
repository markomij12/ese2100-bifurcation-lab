import type { Sample } from "../math/types"
import type { ThemeName } from "./palette"

export type { ThemeName }

export type Mode = "pan" | "launch"

export type Toggles = {
  vectorField: boolean
  flow: boolean
  nullclines: boolean
  manifolds: boolean
  cycles: boolean
  mode: Mode
}

export type Seed = { id: number; x: number; y: number }

export type Trajectory = {
  id: number
  seed: { x: number; y: number }
  forward: Sample[]
  backward: Sample[]
}

export const EMPTY_TOGGLES: Toggles = {
  vectorField: true,
  flow: true,
  nullclines: true,
  manifolds: false,
  cycles: true,
  mode: "launch",
}
