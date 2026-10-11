import type { IntegratorName } from "../math/integrate"
import { systems, type Preset, type System } from "../systems"
import { Markdown } from "./Markdown"
import type { Toggles } from "../engine/types"

type Props = {
  system: System
  params: Record<string, number>
  toggles: Toggles
  method: IntegratorName
  dt: number
  onSystem: (id: string) => void
  onParam: (key: string, value: number) => void
  onPreset: (preset: Preset) => void
  onToggle: (key: keyof Omit<Toggles, "mode">, value: boolean) => void
  onMethod: (method: IntegratorName) => void
  onDt: (dt: number) => void
  fixedCount: number
  cyclesReady: boolean
  cycleCount: number
}

const TOGGLE_ROWS: { key: keyof Omit<Toggles, "mode">; label: string; hint: string }[] = [
  { key: "vectorField", label: "Vector field", hint: "v" },
  { key: "flow", label: "Flow", hint: "f" },
  { key: "nullclines", label: "Nullclines", hint: "n" },
  { key: "manifolds", label: "Saddle manifolds", hint: "m" },
  { key: "cycles", label: "Limit cycles", hint: "l" },
]

export function Sidebar(props: Props) {
  return (
    <aside className="side">
      <section>
        <h2>System</h2>
        <div className="stack">
          {systems.map((system) => (
            <button
              key={system.id}
              type="button"
              className={`sys ${system.id === props.system.id ? "on" : ""}`}
              onClick={() => props.onSystem(system.id)}
            >
              {system.name}
            </button>
          ))}
        </div>
        <Markdown source={props.system.description} />
      </section>

      {props.system.presets && (
        <section>
          <h2>Presets</h2>
          <div className="stack">
            {props.system.presets.map((preset) => (
              <button key={preset.name} type="button" className="preset" onClick={() => props.onPreset(preset)}>
                {preset.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2>Parameters</h2>
        {props.system.params.map((param) => (
          <label key={param.key} className="slider">
            <span className="slider-top">
              <span>{param.label}</span>
              <input
                className="num"
                type="number"
                min={param.min}
                max={param.max}
                step={param.step}
                value={round(props.params[param.key], param.step)}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) props.onParam(param.key, clamp(next, param.min, param.max))
                }}
              />
            </span>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={props.params[param.key]}
              aria-label={param.label}
              onChange={(event) => props.onParam(param.key, Number(event.target.value))}
            />
          </label>
        ))}
      </section>

      <section>
        <h2>Display</h2>
        {TOGGLE_ROWS.map((row) => (
          <button
            key={row.key}
            type="button"
            className="check"
            aria-pressed={props.toggles[row.key]}
            onClick={() => props.onToggle(row.key, !props.toggles[row.key])}
          >
            <span className={`box ${props.toggles[row.key] ? "on" : ""}`} />
            <span>{row.label}</span>
            <kbd>{row.hint}</kbd>
          </button>
        ))}
        <p className="hint">
          {props.fixedCount} fixed point{props.fixedCount === 1 ? "" : "s"}
          {props.toggles.cycles
            ? props.cyclesReady
              ? props.cycleCount
                ? ` · ${props.cycleCount} limit cycle${props.cycleCount === 1 ? "" : "s"}`
                : " · no isolated limit cycle"
              : " · searching for cycles"
            : ""}
        </p>
      </section>

      <section>
        <h2>Integrator</h2>
        <div className="seg">
          <button type="button" className={props.method === "rk4" ? "on" : ""} onClick={() => props.onMethod("rk4")}>
            RK4
          </button>
          <button type="button" className={props.method === "rk45" ? "on" : ""} onClick={() => props.onMethod("rk45")}>
            RK45
          </button>
        </div>
        <label className="slider">
          <span className="slider-top">
            <span>{props.method === "rk4" ? "Δt" : "initial Δt"}</span>
            <span className="mono">{props.dt.toFixed(3)}</span>
          </span>
          <input
            type="range"
            min={0.002}
            max={0.05}
            step={0.001}
            value={props.dt}
            aria-label="step size"
            onChange={(event) => props.onDt(Number(event.target.value))}
          />
        </label>
        <p className="hint">
          {props.toggles.mode === "launch" ? "Click the plane to launch a curve." : "Drag to pan. Scroll to zoom."} Double-click resets the view.
        </p>
      </section>
    </aside>
  )
}

function round(value: number, step: number): number {
  const digits = decimals(step)
  return Number(value.toFixed(digits))
}

function decimals(step: number): number {
  const text = step.toString()
  const dot = text.indexOf(".")
  return dot < 0 ? 0 : text.length - dot - 1
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
