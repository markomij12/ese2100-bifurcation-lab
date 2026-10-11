import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { groupCycleAmplitudes, sweepBranches, type CycleAmpSample } from "./math/bifurcation"
import { isAttracting } from "./math/classify"
import { continueFixedPoints, findFixedPoints, type FixedPoint } from "./math/fixedPoints"
import { periodicDistance } from "./math/geom"
import { integratePlanar, type IntegratorName } from "./math/integrate"
import { findStableAndUnstableCycles, type LimitCycle } from "./math/limitCycles"
import { computeManifolds } from "./math/manifolds"
import { computeNullclines, type Nullclines } from "./math/nullclines"
import type { Domain } from "./math/types"
import { PhasePlane } from "./engine/PhasePlane"
import { EMPTY_TOGGLES, type Seed, type ThemeName, type Toggles, type Trajectory } from "./engine/types"
import { RightPanel } from "./components/RightPanel"
import { Sidebar } from "./components/Sidebar"
import { useDebounced } from "./lib/useDebounced"
import { defaultParams, getSystem, type Preset } from "./systems"

type RawCycle = {
  p: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  stable: boolean
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [systemId, setSystemId] = useState("hoop")
  const system = getSystem(systemId)
  const [params, setParams] = useState(() => defaultParams(system))
  const [view, setView] = useState<Domain>(system.domain)
  const [toggles, setToggles] = useState<Toggles>(EMPTY_TOGGLES)
  const [method, setMethod] = useState<IntegratorName>("rk4")
  const [dt, setDt] = useState(system.time.dt)
  const [seeds, setSeeds] = useState<Seed[]>([])
  const [selected, setSelected] = useState<FixedPoint | null>(null)
  const [bifKey, setBifKey] = useState(system.bifurcation.param)
  const [plotVar, setPlotVar] = useState<"x" | "y" | "both">(system.bifurcation.variable)
  const seedId = useRef(1)
  const systemMark = useRef(system.id)

  const slowParams = useDebounced(params, 100)
  const nullParams = useDebounced(params, 40)
  const nullView = useDebounced(view, 40)
  const field = useCallback((x: number, y: number) => system.f(x, y, params), [system, params])

  const periodicX = !!system.periodic?.x
  const periodicY = !!system.periodic?.y

  const settled = useMemo(
    () =>
      findFixedPoints((x, y) => system.f(x, y, slowParams), system.domain, {
        grid: 12,
        periodicX,
        periodicY,
      }),
    [system, slowParams, periodicX, periodicY],
  )

  const livePoints = useMemo(
    () =>
      continueFixedPoints(settled, field, system.domain, {
        periodicX,
        periodicY,
      }),
    [settled, field, system, periodicX, periodicY],
  )

  const nullclines = useMemo<Nullclines | null>(() => {
    if (!toggles.nullclines) return null
    return computeNullclines((x, y) => system.f(x, y, nullParams), nullView, {
      cells: 100,
      periodicX,
    })
  }, [toggles.nullclines, nullParams, nullView, system, periodicX])

  const manifolds = useMemo(() => {
    if (!toggles.manifolds) return null
    return computeManifolds((x, y) => system.f(x, y, slowParams), settled, {
      method,
      dt,
      domain: system.domain,
      periodicX,
      periodicY,
      tMax: 28,
    })
  }, [toggles.manifolds, slowParams, settled, method, dt, system, periodicX, periodicY])

  const trajectories = useMemo<Trajectory[]>(
    () =>
      seeds.map((seed) => {
        const f = (x: number, y: number) => system.f(x, y, slowParams)
        const opt = {
          method,
          dt,
          tMax: system.time.horizon,
          domain: system.domain,
          periodicX,
          periodicY,
          stopAtEquilibrium: true,
        }
        return {
          id: seed.id,
          seed: { x: seed.x, y: seed.y },
          forward: integratePlanar(f, seed.x, seed.y, { ...opt, direction: 1 }),
          backward: integratePlanar(f, seed.x, seed.y, { ...opt, direction: -1 }),
        }
      }),
    [seeds, slowParams, system, method, dt, periodicX, periodicY],
  )

  const [cycles, setCycles] = useState<LimitCycle[]>([])
  const [cyclesReady, setCyclesReady] = useState(false)
  useEffect(() => {
    if (!toggles.cycles) {
      setCycles([])
      setCyclesReady(true)
      return
    }
    setCyclesReady(false)
    let cancel = false
    const id = window.setTimeout(() => {
      const found = findStableAndUnstableCycles((x, y) => system.f(x, y, slowParams), system.domain, settled, {
        method,
        dt: Math.max(dt, 0.012),
        tMax: 32,
        seeds: 4,
        periodicX,
        periodicY,
      })
      if (!cancel) {
        setCycles(found)
        setCyclesReady(true)
      }
    }, 40)
    return () => {
      cancel = true
      window.clearTimeout(id)
    }
  }, [toggles.cycles, slowParams, settled, method, dt, system, periodicX, periodicY])

  const bifParam = system.params.find((param) => param.key === bifKey) ?? system.params[0]
  const otherKey = system.params
    .filter((param) => param.key !== bifParam.key)
    .map((param) => `${param.key}:${slowParams[param.key]}`)
    .join("|")

  const branches = useMemo(
    () =>
      sweepBranches(
        (value) => (x, y) => system.f(x, y, { ...slowParams, [bifParam.key]: value }),
        bifParam.min,
        bifParam.max,
        200,
        system.domain,
        periodicX,
        periodicY,
      ),
    [otherKey, system, bifParam.key, bifParam.min, bifParam.max, periodicX, periodicY],
  )

  const [rawCycles, setRawCycles] = useState<RawCycle[]>([])
  const [diagramBusy, setDiagramBusy] = useState(false)
  useEffect(() => {
    if (!toggles.cycles) {
      setRawCycles([])
      setDiagramBusy(false)
      return
    }
    setDiagramBusy(true)
    let cancel = false
    const id = window.setTimeout(() => {
      const samples: RawCycle[] = []
      const count = 12
      const started = performance.now()
      for (let i = 0; i < count; i++) {
        if (cancel || performance.now() - started > 260) break
        const value = bifParam.min + ((bifParam.max - bifParam.min) * i) / (count - 1)
        const f = (x: number, y: number) => system.f(x, y, { ...slowParams, [bifParam.key]: value })
        const fps = findFixedPoints(f, system.domain, { grid: 7, periodicX, periodicY })
        const found = findStableAndUnstableCycles(f, system.domain, fps, {
          seeds: 3,
          dt: 0.03,
          tMax: 22,
          periodicX,
          periodicY,
        })
        for (const cycle of found) {
          samples.push({
            p: value,
            minX: cycle.minX,
            maxX: cycle.maxX,
            minY: cycle.minY,
            maxY: cycle.maxY,
            stable: cycle.stable,
          })
        }
      }
      if (!cancel) {
        setRawCycles(samples)
        setDiagramBusy(false)
      }
    }, 90)
    return () => {
      cancel = true
      window.clearTimeout(id)
    }
  }, [toggles.cycles, otherKey, system, bifParam.key, bifParam.min, bifParam.max, periodicX, periodicY])

  const cycleBranches = useMemo(() => {
    const variable = plotVar === "y" ? "y" : "x"
    const samples: CycleAmpSample[] = rawCycles.map((sample) => ({
      p: sample.p,
      stable: sample.stable,
      min: variable === "y" ? sample.minY : sample.minX,
      max: variable === "y" ? sample.maxY : sample.maxX,
    }))
    return groupCycleAmplitudes(samples)
  }, [rawCycles, plotVar])

  useEffect(() => {
    setSelected((prev) => {
      if (livePoints.length === 0) return null
      if (!prev || systemMark.current !== system.id) {
        systemMark.current = system.id
        return livePoints.find((fp) => isAttracting(fp.kind)) ?? livePoints[0]
      }
      let best = livePoints[0]
      let bestD = Infinity
      for (const fp of livePoints) {
        const d = periodicDistance(prev.x, prev.y, fp.x, fp.y, system.domain, periodicX, periodicY)
        if (d < bestD) {
          best = fp
          bestD = d
        }
      }
      if (bestD > 1.2) return livePoints.find((fp) => isAttracting(fp.kind)) ?? livePoints[0]
      if (
        prev.x === best.x &&
        prev.y === best.y &&
        prev.kind === best.kind &&
        prev.trace === best.trace &&
        prev.det === best.det
      ) {
        return prev
      }
      return best
    })
  }, [livePoints, system, periodicX, periodicY])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return
      const key = event.key.toLowerCase()
      if (key === "v") setToggles((t) => ({ ...t, vectorField: !t.vectorField }))
      if (key === "f") setToggles((t) => ({ ...t, flow: !t.flow }))
      if (key === "n") setToggles((t) => ({ ...t, nullclines: !t.nullclines }))
      if (key === "m") setToggles((t) => ({ ...t, manifolds: !t.manifolds }))
      if (key === "l") setToggles((t) => ({ ...t, cycles: !t.cycles }))
      if (key === "r") setView(system.domain)
      if (key === "c") setSeeds([])
      if (event.key === " ") {
        event.preventDefault()
        setToggles((t) => ({ ...t, flow: !t.flow }))
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [system])

  function selectSystem(id: string) {
    const next = getSystem(id)
    setSystemId(id)
    setParams(defaultParams(next))
    setView(next.domain)
    setSeeds([])
    setSelected(null)
    setBifKey(next.bifurcation.param)
    setPlotVar(next.bifurcation.variable)
    setDt(next.time.dt)
    setToggles((t) => ({ ...t, manifolds: false }))
    systemMark.current = ""
  }

  function shoot(x: number, y: number) {
    const seed: Seed = { id: seedId.current++, x, y }
    setSeeds((current) => [...current, seed].slice(-8))
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <div className="kicker">ESE 2100</div>
          <h1>PhasePlane</h1>
          <p className="lede">an interactive tour of 2-D flows and their bifurcations</p>
        </div>
        <div className="top-actions">
          <span className="byline">Marko</span>
          <button type="button" onClick={toggleTheme}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>
      <div className="workspace">
        <Sidebar
          system={system}
          params={params}
          toggles={toggles}
          method={method}
          dt={dt}
          onSystem={selectSystem}
          onParam={(key, value) => setParams((current) => ({ ...current, [key]: value }))}
          onPreset={(preset: Preset) => {
            setParams((current) => ({ ...current, ...preset.params }))
            if (preset.manifolds) setToggles((t) => ({ ...t, manifolds: true }))
          }}
          onToggle={(key, value) => setToggles((t) => ({ ...t, [key]: value }))}
          onMethod={setMethod}
          onDt={setDt}
          fixedCount={livePoints.length}
          cyclesReady={cyclesReady}
          cycleCount={cycles.length}
        />
        <main className="stage">
          <PhasePlane
            system={system}
            field={field}
            params={params}
            view={view}
            onView={setView}
            toggles={toggles}
            onMode={(mode) => setToggles((t) => ({ ...t, mode }))}
            fixedPoints={livePoints}
            nullclines={nullclines}
            manifolds={manifolds}
            cycles={cycles}
            trajectories={trajectories}
            onShoot={shoot}
            onClear={() => setSeeds([])}
            selected={selected}
            onSelect={setSelected}
            theme={theme}
          />
        </main>
        <RightPanel
          system={system}
          theme={theme}
          params={params}
          bifParam={bifParam}
          bifValue={params[bifParam.key] ?? bifParam.default}
          onBifValue={(value) => setParams((current) => ({ ...current, [bifParam.key]: value }))}
          onBifParam={(key) => {
            setBifKey(key)
            const spec = system.params.find((param) => param.key === key)
            if (spec) setPlotVar(key === system.bifurcation.param ? system.bifurcation.variable : "x")
          }}
          plotVar={plotVar}
          onPlotVar={setPlotVar}
          branches={branches}
          cycleBranches={cycleBranches}
          loadingCycles={diagramBusy}
          livePoints={livePoints}
          selected={selected}
          onSelect={setSelected}
          cycles={cycles}
          cyclesReady={cyclesReady}
          trajectory={trajectories[trajectories.length - 1] ?? null}
          domain={system.domain}
        />
      </div>
    </div>
  )
}

function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(() =>
    localStorage.getItem("phaseplane-theme") === "light" ? "light" : "dark",
  )
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme
  useEffect(() => {
    localStorage.setItem("phaseplane-theme", theme)
  }, [theme])
  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
  }
}
