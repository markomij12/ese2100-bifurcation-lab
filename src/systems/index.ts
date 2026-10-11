import { hoop } from "./hoop"
import { lotkaVolterra } from "./lotkaVolterra"
import type { System } from "./types"

export const systems: System[] = [hoop, lotkaVolterra]

export function getSystem(id: string): System {
  return systems.find((s) => s.id === id) ?? systems[0]
}

export { hoop, lotkaVolterra }
export type { System, ParamSpec, Preset } from "./types"
export { defaultParams } from "./types"
