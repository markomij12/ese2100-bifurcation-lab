import type { Domain, Field, Vec2 } from "./types"

export type Segment = { a: Vec2; b: Vec2 }

export type Nullclines = {
  /** Where the first component vanishes (ẋ = 0). */
  x: Segment[]
  /** Where the second component vanishes (ẏ = 0). */
  y: Segment[]
}

/**
 * Zero contours of a scalar grid function by marching squares.
 * Ambiguous saddles (two diagonal corners of one sign) are split by the
 * sign of the cell average, which is the standard center-sample rule.
 */
export function marchingSquares(
  value: (x: number, y: number) => number,
  domain: Domain,
  cellsX: number,
  cellsY: number,
  periodicX = false,
): Segment[] {
  const cols = periodicX ? cellsX : cellsX + 1
  const rows = cellsY + 1
  const grid = new Float64Array(cols * rows)
  const xOf = (i: number) => domain.xmin + (i / cellsX) * (domain.xmax - domain.xmin)
  const yOf = (j: number) => domain.ymin + (j / cellsY) * (domain.ymax - domain.ymin)
  const at = (i: number, j: number) => {
    const ii = periodicX ? ((i % cellsX) + cellsX) % cellsX : i
    return grid[j * cols + ii]
  }

  for (let j = 0; j < rows; j++) {
    const y = yOf(j)
    for (let i = 0; i < cols; i++) {
      let v = value(xOf(i), y)
      if (!Number.isFinite(v)) v = 1e-12
      if (v === 0) v = 1e-14
      grid[j * cols + i] = v
    }
  }

  const segments: Segment[] = []
  const edgePoint = (i0: number, j0: number, i1: number, j1: number): Vec2 => {
    const v0 = at(i0, j0)
    const v1 = at(i1, j1)
    const denom = v0 - v1
    const t = denom === 0 ? 0.5 : Math.min(1, Math.max(0, v0 / denom))
    return [xOf(i0) + t * (xOf(i1) - xOf(i0)), yOf(j0) + t * (yOf(j1) - yOf(j0))]
  }

  for (let j = 0; j < cellsY; j++) {
    for (let i = 0; i < cellsX; i++) {
      const i1 = i + 1
      const bl = at(i, j) > 0
      const br = at(i1, j) > 0
      const tr = at(i1, j + 1) > 0
      const tl = at(i, j + 1) > 0
      const mask = (bl ? 1 : 0) | (br ? 2 : 0) | (tr ? 4 : 0) | (tl ? 8 : 0)
      if (mask === 0 || mask === 15) continue
      let pairs: number[][]
      if (mask === 5 || mask === 10) {
        const center = (at(i, j) + at(i1, j) + at(i1, j + 1) + at(i, j + 1)) / 4
        if (mask === 5) {
          pairs = center > 0 ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]
        } else {
          pairs = center > 0 ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]]
        }
      } else {
        pairs = PAIRS[mask]
      }
      const corners: [number, number][] = [
        [i, j],
        [i1, j],
        [i1, j + 1],
        [i, j + 1],
      ]
      const edgeEnds: [number, number][] = [
        [0, 1],
        [1, 2],
        [3, 2],
        [0, 3],
      ]
      for (const [e0, e1] of pairs) {
        const [c0, c1] = edgeEnds[e0]
        const [d0, d1] = edgeEnds[e1]
        segments.push({
          a: edgePoint(corners[c0][0], corners[c0][1], corners[c1][0], corners[c1][1]),
          b: edgePoint(corners[d0][0], corners[d0][1], corners[d1][0], corners[d1][1]),
        })
      }
    }
  }
  return segments
}

const PAIRS: number[][][] = [
  [],
  [[0, 3]],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [],
  [[0, 2]],
  [[2, 3]],
  [[2, 3]],
  [[0, 2]],
  [],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[0, 3]],
  [],
]

export function computeNullclines(
  f: Field,
  domain: Domain,
  options: { cells?: number; periodicX?: boolean } = {},
): Nullclines {
  const cells = options.cells ?? 120
  const width = domain.xmax - domain.xmin
  const height = domain.ymax - domain.ymin
  const aspect = width / Math.max(height, 1e-9)
  const cellsX = Math.max(24, Math.round(cells * Math.sqrt(aspect)))
  const cellsY = Math.max(24, Math.round(cells / Math.sqrt(aspect)))
  return {
    x: marchingSquares((x, y) => f(x, y)[0], domain, cellsX, cellsY, options.periodicX ?? false),
    y: marchingSquares((x, y) => f(x, y)[1], domain, cellsX, cellsY, options.periodicX ?? false),
  }
}
