import { eigenvector } from "./jacobian"
import type { Matrix2, Vec2 } from "./types"

export type FixedPointClass =
  | "stable-node"
  | "unstable-node"
  | "saddle"
  | "stable-spiral"
  | "unstable-spiral"
  | "center"
  | "degenerate"

export type Eigenvalues =
  | { type: "real"; l1: number; l2: number }
  | { type: "complex"; real: number; imag: number }

export type Classification = {
  kind: FixedPointClass
  /** Poincaré index. Null when a zero eigenvalue makes the index nonlinear. */
  index: number | null
  trace: number
  det: number
  discriminant: number
  eigenvalues: Eigenvalues
}

const CLASS_LABEL: Record<FixedPointClass, string> = {
  "stable-node": "stable node",
  "unstable-node": "unstable node",
  saddle: "saddle",
  "stable-spiral": "stable spiral",
  "unstable-spiral": "unstable spiral",
  center: "center",
  degenerate: "degenerate",
}

export function classLabel(kind: FixedPointClass): string {
  return CLASS_LABEL[kind]
}

export function isAttracting(kind: FixedPointClass): boolean {
  return kind === "stable-node" || kind === "stable-spiral"
}

/**
 * Linear classification from the trace–determinant plane.
 * Δ < 0 saddle; Δ > 0 and τ² < 4Δ spiral; Δ > 0 and τ² ≥ 4Δ node
 * (the parabola τ² = 4Δ is a repeated-eigenvalue node, still index +1);
 * τ = 0 and Δ > 0 center; Δ = 0 is degenerate — a zero eigenvalue,
 * whose index is not fixed by the linearization.
 */
export function classifyJacobian(J: Matrix2): Classification {
  const a = J[0][0]
  const b = J[0][1]
  const c = J[1][0]
  const d = J[1][1]
  const trace = a + d
  const det = a * d - b * c
  const discriminant = trace * trace - 4 * det
  const scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d))
  const detTol = 1e-8 * scale * scale
  const traceTol = 1e-8 * scale
  const discTol = 1e-8 * scale * scale

  let eigenvalues: Eigenvalues
  if (discriminant < -discTol) {
    eigenvalues = {
      type: "complex",
      real: trace / 2,
      imag: Math.sqrt(-discriminant) / 2,
    }
  } else {
    const s = Math.sqrt(Math.max(0, discriminant))
    eigenvalues = { type: "real", l1: (trace + s) / 2, l2: (trace - s) / 2 }
  }

  const base = { trace, det, discriminant, eigenvalues }

  if (Math.abs(det) <= detTol) {
    return { ...base, kind: "degenerate", index: null }
  }
  if (det < 0) {
    return { ...base, kind: "saddle", index: -1 }
  }
  if (Math.abs(trace) <= traceTol) {
    return { ...base, kind: "center", index: 1 }
  }
  if (discriminant < -discTol) {
    return {
      ...base,
      kind: trace < 0 ? "stable-spiral" : "unstable-spiral",
      index: 1,
    }
  }
  return {
    ...base,
    kind: trace < 0 ? "stable-node" : "unstable-node",
    index: 1,
  }
}

export function realEigenpairs(J: Matrix2): { lambda: number; v: Vec2 }[] | null {
  const c = classifyJacobian(J)
  if (c.eigenvalues.type !== "real") return null
  const lambdas = [c.eigenvalues.l1, c.eigenvalues.l2]
  const pairs: { lambda: number; v: Vec2 }[] = []
  for (const lambda of lambdas) {
    const v = eigenvector(J, lambda)
    if (!v) return null
    pairs.push({ lambda, v })
  }
  return pairs
}

export function formatEigenvalues(ev: Eigenvalues): string {
  const n = (v: number) => {
    const a = Math.abs(v)
    if (a !== 0 && (a < 1e-3 || a >= 1e4)) return v.toExponential(2)
    const s = v.toFixed(3)
    return s.replace(/-0\.000/, "0.000")
  }
  if (ev.type === "complex") {
    const sign = ev.imag < 0 ? "−" : "+"
    return `${n(ev.real)} ${sign} ${n(Math.abs(ev.imag))}i`
  }
  return `${n(ev.l1)},  ${n(ev.l2)}`
}
