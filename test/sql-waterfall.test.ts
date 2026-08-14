import { describe, expect, it } from 'vitest'
import { waterfallBars } from '../src/runtime/server/utils/sql-waterfall'

describe('waterfallBars', () => {
  it('places a sequential second query after the first ends', () => {
    const bars = waterfallBars([
      { id: 'a', durationMs: 10, timestamp: 1010 },
      { id: 'b', durationMs: 10, timestamp: 1020 },
    ])
    expect(bars).toHaveLength(2)
    expect(bars[0]?.leftPct).toBe(0)
    expect(bars[0]?.widthPct).toBe(50)
    expect(bars[1]?.leftPct).toBe(50)
    expect(bars[1]?.widthPct).toBe(50)
    expect(bars[1]!.leftPct).toBeGreaterThanOrEqual(bars[0]!.leftPct + bars[0]!.widthPct)
  })

  it('places overlapping queries at the same start', () => {
    const bars = waterfallBars([
      { id: 'a', durationMs: 10, timestamp: 1010 },
      { id: 'b', durationMs: 10, timestamp: 1010 },
    ])
    expect(bars[0]?.leftPct).toBe(0)
    expect(bars[1]?.leftPct).toBe(0)
    expect(bars[0]?.widthPct).toBe(100)
    expect(bars[1]?.widthPct).toBe(100)
  })

  it('uses a 1% sliver for zero-duration queries', () => {
    const bars = waterfallBars([{ id: 'a', durationMs: 0, timestamp: 1000 }])
    expect(bars[0]?.widthPct).toBe(1)
    expect(bars[0]?.leftPct).toBe(0)
  })
})
