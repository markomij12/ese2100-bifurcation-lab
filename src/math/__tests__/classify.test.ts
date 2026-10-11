import { describe, expect, it } from "vitest"
import { classifyJacobian, type Classification } from "../classify"
import { eigenvector } from "../jacobian"
import { jacobian } from "../jacobian"
import type { Matrix2 } from "../types"

function kind(J: Matrix2): Classification {
  return classifyJacobian(J)
}

describe("Jacobian eigenvalue classification", () => {
  it("reads a linear field's Jacobian by central differences", () => {
    const J = jacobian((x, y) => [2 * x + y, 3 * x + 4 * y], 0.3, -0.7)
    expect(J[0][0]).toBeCloseTo(2, 8)
    expect(J[0][1]).toBeCloseTo(1, 8)
    expect(J[1][0]).toBeCloseTo(3, 8)
    expect(J[1][1]).toBeCloseTo(4, 8)
  })

  it("classifies nodes, spirals, saddles, centers, and degenerate points", () => {
    const stableNode = kind([
      [-2, 0],
      [0, -3],
    ])
    expect(stableNode.kind).toBe("stable-node")
    expect(stableNode.index).toBe(1)
    expect(stableNode.trace).toBeCloseTo(-5)
    expect(stableNode.det).toBeCloseTo(6)
    expect(stableNode.eigenvalues).toEqual({ type: "real", l1: -2, l2: -3 })

    const unstableNode = kind([
      [1, 0],
      [0, 4],
    ])
    expect(unstableNode.kind).toBe("unstable-node")
    expect(unstableNode.index).toBe(1)

    const saddle = kind([
      [1, 0],
      [0, -2],
    ])
    expect(saddle.kind).toBe("saddle")
    expect(saddle.index).toBe(-1)
    expect(saddle.det).toBeLessThan(0)

    const stableSpiral = kind([
      [-0.2, -1],
      [1, -0.2],
    ])
    expect(stableSpiral.kind).toBe("stable-spiral")
    expect(stableSpiral.index).toBe(1)
    expect(stableSpiral.eigenvalues.type).toBe("complex")
    if (stableSpiral.eigenvalues.type === "complex") {
      expect(stableSpiral.eigenvalues.real).toBeCloseTo(-0.2)
      expect(stableSpiral.eigenvalues.imag).toBeCloseTo(1)
    }

    const unstableSpiral = kind([
      [0.2, -1],
      [1, 0.2],
    ])
    expect(unstableSpiral.kind).toBe("unstable-spiral")
    expect(unstableSpiral.index).toBe(1)

    const center = kind([
      [0, -2],
      [2, 0],
    ])
    expect(center.kind).toBe("center")
    expect(center.index).toBe(1)
    expect(center.trace).toBeCloseTo(0)
    if (center.eigenvalues.type === "complex") {
      expect(center.eigenvalues.imag).toBeCloseTo(2)
    }

    const zeroEigen = kind([
      [0, 1],
      [0, 0],
    ])
    expect(zeroEigen.kind).toBe("degenerate")
    expect(zeroEigen.index).toBeNull()

    const repeated = kind([
      [-1, 0],
      [0, -1],
    ])
    expect(repeated.kind).toBe("stable-node")
    expect(repeated.index).toBe(1)
    expect(repeated.discriminant).toBeCloseTo(0, 8)
  })

  it("returns the coordinate axes as eigenvectors of a diagonal saddle", () => {
    const J: Matrix2 = [
      [1, 0],
      [0, -2],
    ]
    const vPlus = eigenvector(J, 1)
    const vMinus = eigenvector(J, -2)
    expect(vPlus).not.toBeNull()
    expect(vMinus).not.toBeNull()
    expect(Math.abs(vPlus![0])).toBeCloseTo(1, 6)
    expect(vPlus![1]).toBeCloseTo(0, 6)
    expect(vMinus![0]).toBeCloseTo(0, 6)
    expect(Math.abs(vMinus![1])).toBeCloseTo(1, 6)
  })
})
