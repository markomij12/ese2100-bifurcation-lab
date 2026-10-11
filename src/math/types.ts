export type Vec2 = [number, number]

export type Field = (x: number, y: number) => Vec2

export type Domain = {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

export type Matrix2 = [[number, number], [number, number]]

export type Sample = {
  t: number
  x: number
  y: number
}
