export type WaterfallQuery = {
  id: string
  durationMs: number
  timestamp: number
}

export type WaterfallBar = {
  id: string
  index: number
  leftPct: number
  widthPct: number
}

/** Layout bars from inferred start (`timestamp - durationMs`) to finish (`timestamp`). */
export function waterfallBars(queries: WaterfallQuery[]): WaterfallBar[] {
  if (!queries.length) return []

  const spans = queries.map((q) => {
    const end = q.timestamp
    const start = end - q.durationMs
    return { id: q.id, start, end, duration: q.durationMs }
  })

  let t0 = spans[0]!.start
  let t1 = spans[0]!.end
  for (const s of spans) {
    if (s.start < t0) t0 = s.start
    if (s.end > t1) t1 = s.end
  }
  const span = Math.max(t1 - t0, 1)

  return spans.map((s, index) => ({
    id: s.id,
    index,
    leftPct: ((s.start - t0) / span) * 100,
    widthPct: Math.max((s.duration / span) * 100, 1),
  }))
}
