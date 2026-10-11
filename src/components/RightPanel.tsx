import { classLabel, formatEigenvalues, isAttracting } from "../math/classify"
import type { BifBranch, CycleAmpBranch } from "../math/bifurcation"
import type { FixedPoint } from "../math/fixedPoints"
import type { LimitCycle } from "../math/limitCycles"
import type { Domain } from "../math/types"
import type { ParamSpec, System } from "../systems/types"
import type { ThemeName, Trajectory } from "../engine/types"
import { BifurcationPanel } from "./BifurcationPanel"
import { HoopSideView } from "./HoopSideView"
import { Markdown } from "./Markdown"
import { TraceDetPlane } from "./TraceDetPlane"

type Props = {
  system: System
  theme: ThemeName
  bifParam: ParamSpec
  bifValue: number
  onBifValue: (value: number) => void
  onBifParam: (key: string) => void
  plotVar: "x" | "y" | "both"
  onPlotVar: (variable: "x" | "y" | "both") => void
  branches: BifBranch[]
  cycleBranches: CycleAmpBranch[]
  loadingCycles: boolean
  livePoints: FixedPoint[]
  selected: FixedPoint | null
  onSelect: (fp: FixedPoint) => void
  cycles: LimitCycle[]
  cyclesReady: boolean
  trajectory: Trajectory | null
  params: Record<string, number>
  domain: Domain
}

export function RightPanel(props: Props) {
  const annotations = (props.system.bifurcation.annotations ?? [])
    .filter((note) => note.param === props.bifParam.key)
    .map((note) => ({ value: note.value, label: note.label }))

  return (
    <aside className="side right">
      <div className="right-scroll">
      <section className="card flat">
        <header className="card-head">
          <h2>Sweep</h2>
          <label className="quiet">
            parameter{" "}
            <select value={props.bifParam.key} onChange={(event) => props.onBifParam(event.target.value)}>
              {props.system.params.map((param) => (
                <option key={param.key} value={param.key}>
                  {param.label}
                </option>
              ))}
            </select>
          </label>
        </header>
      </section>
      <BifurcationPanel
        param={props.bifParam}
        value={props.bifValue}
        onChange={props.onBifValue}
        variable={props.plotVar}
        onVariable={props.onPlotVar}
        variableLabels={props.system.axis}
        domain={props.domain}
        branches={props.branches}
        cycleBranches={props.cycleBranches}
        livePoints={props.livePoints}
        annotations={annotations}
        theme={props.theme}
        loadingCycles={props.loadingCycles}
      />
      <TraceDetPlane points={props.livePoints} selected={props.selected} />
      <section className="card">
        <header className="card-head">
          <h2>Equilibria</h2>
        </header>
        {props.livePoints.length === 0 ? (
          <p className="hint">None in the domain.</p>
        ) : (
          <ul className="eqs">
            {props.livePoints.map((fp) => {
              const on = props.selected != null && props.selected.x === fp.x && props.selected.y === fp.y
              return (
                <li key={`${fp.x.toFixed(4)}-${fp.y.toFixed(4)}`}>
                  <button type="button" className={on ? "on" : ""} onClick={() => props.onSelect(fp)}>
                    <i className={`mark ${markClass(fp)}`} />
                    <span>
                      <b>{classLabel(fp.kind)}</b>
                      <small>
                        {props.system.axis.x} = {fmt(fp.x)}, {props.system.axis.y} = {fmt(fp.y)}
                        {" · "}λ {formatEigenvalues(fp.eigenvalues)}
                        {" · "}index {fp.index === null ? "—" : fp.index > 0 ? "+1" : "−1"}
                      </small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {props.cyclesReady && props.cycles.length > 0 && (
          <p className="hint">
            {props.cycles.map((cycle) => (
              <span key={`${cycle.stable}-${cycle.period.toFixed(3)}`}>
                {cycle.stable ? "Stable" : "Unstable"} cycle, period {cycle.period.toFixed(2)}, {props.system.axis.x} ∈ [
                {cycle.minX.toFixed(2)}, {cycle.maxX.toFixed(2)}].{" "}
              </span>
            ))}
          </p>
        )}
      </section>
      <details className="card theory">
        <summary>Theory</summary>
        <Markdown source={props.system.theory} />
      </details>
      </div>
      {props.system.sideView === "hoop" && (
        <div className="hoop-dock">
        <HoopSideView
          gamma={props.params.gamma ?? 0}
          beta={props.params.beta ?? 0}
          phi={props.selected?.x ?? 0}
          velocity={props.selected?.y ?? 0}
          trajectory={props.trajectory}
        />
        </div>
      )}
    </aside>
  )
}

function fmt(n: number): string {
  const v = Math.abs(n) < 5e-4 ? 0 : n
  return v.toFixed(3)
}

function markClass(fp: FixedPoint): string {
  if (fp.kind === "saddle") return "saddle"
  if (fp.kind === "center") return "center"
  if (fp.kind === "degenerate") return "degenerate"
  return isAttracting(fp.kind) ? "stable" : "unstable"
}
