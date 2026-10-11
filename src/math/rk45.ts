/**
 * Dormand–Prince 5(4), the RK45 pair used by ode45.
 * Coefficients from Hairer, Nørsett & Wanner, Solving Ordinary
 * Differential Equations I (the FSAL 7-stage tableau).
 *
 * Fifth-order weights advance the solution; the fourth-order
 * weights are only used to estimate the local error.
 */

const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1]

const A: number[][] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
]

const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0]
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40]
const E = B5.map((b, i) => b - B4[i])

export type Rk45Options = {
  atol?: number
  rtol?: number
  h0?: number
  hMin?: number
  hMax?: number
  maxSteps?: number
}

export type Rk45Attempt = {
  yNext: number[]
  err: number
}

/** One embedded step of size `h` (h may be negative). Does not adapt. */
export function rk45Attempt(
  f: (t: number, y: readonly number[]) => number[],
  t: number,
  y: readonly number[],
  h: number,
  atol = 1e-7,
  rtol = 1e-6,
): Rk45Attempt {
  const n = y.length
  const k: number[][] = new Array(7)
  k[0] = f(t, y)
  for (let s = 1; s < 7; s++) {
    const ys = new Array<number>(n)
    for (let i = 0; i < n; i++) ys[i] = y[i]
    const row = A[s]
    for (let j = 0; j < s; j++) {
      const ak = h * row[j]
      const kj = k[j]
      for (let i = 0; i < n; i++) ys[i] += ak * kj[i]
    }
    k[s] = f(t + C[s] * h, ys)
  }
  const yNext = new Array<number>(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    let yi = y[i]
    let ei = 0
    for (let j = 0; j < 7; j++) {
      yi += h * B5[j] * k[j][i]
      ei += h * E[j] * k[j][i]
    }
    yNext[i] = yi
    const scale = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(yi))
    const r = ei / scale
    sum += r * r
  }
  return { yNext, err: Math.sqrt(sum / n) }
}

/** New step length after an attempt. `err` is the RMS scaled error. */
export function rk45NextStep(h: number, err: number, accepted: boolean): number {
  const safety = 0.9
  const grow = 5
  const shrink = 0.2
  let factor: number
  if (err === 0) factor = grow
  else if (accepted) factor = safety * err ** (-1 / 5)
  else factor = safety * err ** (-1 / 4)
  if (!Number.isFinite(factor)) factor = shrink
  factor = Math.min(grow, Math.max(shrink, factor))
  return h * factor
}

export function rk45Integrate(
  f: (t: number, y: readonly number[]) => number[],
  y0: readonly number[],
  t0: number,
  t1: number,
  options: Rk45Options = {},
): { t: number[]; y: number[][] } {
  const atol = options.atol ?? 1e-7
  const rtol = options.rtol ?? 1e-6
  const hMin = options.hMin ?? 1e-12
  const maxSteps = options.maxSteps ?? 100_000
  const dir = t1 >= t0 ? 1 : -1
  const span = Math.abs(t1 - t0)
  const hMax = options.hMax ?? Math.max(span / 8, 1e-3)
  let h = dir * Math.min(Math.abs(options.h0 ?? Math.min(1e-2, span / 50)), hMax)
  const t: number[] = [t0]
  const y: number[][] = [Array.from(y0)]
  let tn = t0
  let yn = y[0]
  let rejects = 0
  for (let step = 0; step < maxSteps && dir * (t1 - tn) > 1e-14; step++) {
    if (dir * (tn + h - t1) > 0) h = t1 - tn
    const { yNext, err } = rk45Attempt(f, tn, yn, h, atol, rtol)
    const finite = yNext.every(Number.isFinite)
    const ok = finite && err <= 1
    if (ok) {
      tn += h
      yn = yNext
      t.push(tn)
      y.push(yn)
      rejects = 0
      if (Math.abs(tn - t1) <= 1e-14) break
      h = dir * Math.min(Math.abs(rk45NextStep(h, err, true)), hMax)
    } else {
      rejects++
      const shrunk = rk45NextStep(h, finite ? Math.max(err, 1e-16) : 10, false)
      h = dir * Math.max(Math.min(Math.abs(shrunk), Math.abs(h) * 0.5), hMin)
      if (rejects > 12 && Math.abs(h) <= hMin * 1.01) break
    }
  }
  return { t, y }
}
