import type { Field, Matrix2, Vec2 } from "./types"

/** Central-difference Jacobian of a planar field. */
export function jacobian(f: Field, x: number, y: number, eps = 1e-6): Matrix2 {
  const fxp = f(x + eps, y)
  const fxm = f(x - eps, y)
  const fyp = f(x, y + eps)
  const fym = f(x, y - eps)
  const d = 2 * eps
  return [
    [(fxp[0] - fxm[0]) / d, (fyp[0] - fym[0]) / d],
    [(fxp[1] - fxm[1]) / d, (fyp[1] - fym[1]) / d],
  ]
}

/**
 * A unit eigenvector for a real eigenvalue.
 * Returns null if the eigenvalue is not simple enough to read off a direction.
 */
export function eigenvector(J: Matrix2, lambda: number): Vec2 | null {
  const a = J[0][0]
  const b = J[0][1]
  const c = J[1][0]
  const d = J[1][1]
  const candidates: Vec2[] = [
    [-b, a - lambda],
    [d - lambda, -c],
    [a - lambda, c],
  ]
  let best: Vec2 | null = null
  let bestN = 0
  for (const v of candidates) {
    const n = Math.hypot(v[0], v[1])
    if (n > bestN) {
      bestN = n
      best = v
    }
  }
  if (!best || bestN < 1e-14) {
    if (Math.hypot(a - lambda, c) < 1e-10) return [1, 0]
    if (Math.hypot(b, d - lambda) < 1e-10) return [0, 1]
    return null
  }
  return [best[0] / bestN, best[1] / bestN]
}
