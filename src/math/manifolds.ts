import { realEigenpairs } from "./classify"
import { integratePlanar, type IntegrateOptions } from "./integrate"
import type { FixedPoint } from "./fixedPoints"
import type { Field, Vec2 } from "./types"

export type Manifolds = {
  stable: Vec2[][]
  unstable: Vec2[][]
}

/**
 * Stable and unstable manifolds of each saddle.
 * The unstable manifold is integrated forward along the positive-eigenvalue
 * direction; the stable manifold is integrated backward along the
 * negative-eigenvalue direction. Both orientations of each eigenvector
 * are followed.
 */
export function computeManifolds(
  f: Field,
  points: FixedPoint[],
  options: IntegrateOptions & { epsilon?: number } = {},
): Manifolds {
  const stable: Vec2[][] = []
  const unstable: Vec2[][] = []
  const domain = options.domain
  const span = domain
    ? Math.min(domain.xmax - domain.xmin, domain.ymax - domain.ymin)
    : 1
  const eps = options.epsilon ?? Math.max(1e-3, 0.012 * span)

  for (const fp of points) {
    if (fp.kind !== "saddle") continue
    const pairs = realEigenpairs(fp.J)
    if (!pairs) continue
    for (const { lambda, v } of pairs) {
      if (Math.abs(lambda) < 1e-8) continue
      const bucket = lambda > 0 ? unstable : stable
      const direction = lambda > 0 ? 1 : -1
      for (const sign of [1, -1] as const) {
        const x0 = fp.x + sign * eps * v[0]
        const y0 = fp.y + sign * eps * v[1]
        const samples = integratePlanar(f, x0, y0, {
          ...options,
          direction,
          tMax: options.tMax ?? 32,
          stopAtEquilibrium: true,
        })
        if (samples.length >= 2) {
          bucket.push(samples.map((s) => [s.x, s.y]))
        }
      }
    }
  }
  return { stable, unstable }
}
