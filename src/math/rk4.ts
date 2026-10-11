/**
 * Fixed-step classical RK4.
 * The derivative may depend on time; autonomous fields ignore `t`.
 */
export function rk4Step(
  f: (t: number, y: readonly number[]) => number[],
  t: number,
  y: readonly number[],
  h: number,
): number[] {
  const n = y.length
  const k1 = f(t, y)
  const y2 = new Array<number>(n)
  for (let i = 0; i < n; i++) y2[i] = y[i] + 0.5 * h * k1[i]
  const k2 = f(t + 0.5 * h, y2)
  const y3 = new Array<number>(n)
  for (let i = 0; i < n; i++) y3[i] = y[i] + 0.5 * h * k2[i]
  const k3 = f(t + 0.5 * h, y3)
  const y4 = new Array<number>(n)
  for (let i = 0; i < n; i++) y4[i] = y[i] + h * k3[i]
  const k4 = f(t + h, y4)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    out[i] = y[i] + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  }
  return out
}

export function rk4Integrate(
  f: (t: number, y: readonly number[]) => number[],
  y0: readonly number[],
  t0: number,
  t1: number,
  h: number,
): { t: number[]; y: number[][] } {
  if (!(h > 0)) throw new Error("rk4 step must be positive")
  const dir = t1 >= t0 ? 1 : -1
  const step = dir * h
  const t: number[] = [t0]
  const y: number[][] = [Array.from(y0)]
  let tn = t0
  let yn = y[0]
  const guard = Math.ceil(Math.abs(t1 - t0) / h) + 2
  for (let k = 0; k < guard && dir * (t1 - tn) > 1e-12; k++) {
    let hk = step
    if (dir * (tn + hk - t1) > 0) hk = t1 - tn
    yn = rk4Step(f, tn, yn, hk)
    tn += hk
    t.push(tn)
    y.push(yn)
  }
  return { t, y }
}
