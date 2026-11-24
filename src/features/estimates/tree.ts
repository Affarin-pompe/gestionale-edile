import type {
  EstimateArrangement,
  EstimateChapter,
  EstimateItem,
  EstimateMeasurement,
  EstimateStructure,
} from './api'

/** A row of the estimate's tree: chapters hold items and sub-chapters, items hold measurements. */
export type TreeRow =
  | { type: 'chapter'; id: string; chapter: EstimateChapter; level: number; children: TreeRow[] }
  | { type: 'item'; id: string; item: EstimateItem; children: TreeRow[] }
  | { type: 'measurement'; id: string; measurement: EstimateMeasurement }

function groupBy<T>(values: T[], key: (value: T) => string | null) {
  const groups = new Map<string | null, T[]>()
  for (const value of values) {
    const group = groups.get(key(value))
    if (group) group.push(value)
    else groups.set(key(value), [value])
  }
  return groups
}

/**
 * The tree from the three flat lists of the structure, already sorted by position.
 * Inside a chapter its items come first, then its sub-chapters, as in the quote made from it.
 */
export function buildTree(structure: EstimateStructure): TreeRow[] {
  const chaptersOf = groupBy(structure.chapters, (chapter) => chapter.parent_id)
  const itemsOf = groupBy(structure.items, (item) => item.chapter_id)
  const measurementsOf = groupBy(structure.measurements, (line) => line.item_id)

  function chapters(parent: string | null, level: number): TreeRow[] {
    return (chaptersOf.get(parent) ?? []).map((chapter) => ({
      type: 'chapter',
      id: `c:${chapter.id}`,
      chapter,
      level,
      children: [
        ...(itemsOf.get(chapter.id) ?? []).map((item): TreeRow => ({
          type: 'item',
          id: `i:${item.id}`,
          item,
          children: (measurementsOf.get(item.id) ?? []).map((measurement) => ({
            type: 'measurement',
            id: `m:${measurement.id}`,
            measurement,
          })),
        })),
        ...chapters(chapter.id, level + 1),
      ],
    }))
  }
  return chapters(null, 1)
}

export function subRows(row: TreeRow) {
  return row.type === 'measurement' ? undefined : row.children
}

/** The rows that start out open: chapters and items, so the numbers show at once. */
export function expandedRows(rows: TreeRow[], into: Record<string, boolean> = {}) {
  for (const row of rows) {
    if (row.type === 'measurement') continue
    into[row.id] = true
    expandedRows(row.children, into)
  }
  return into
}

/** Siblings of a chapter (same parent) or of an item (same chapter), in their order. */
export function siblings(structure: EstimateStructure, row: TreeRow) {
  if (row.type === 'chapter') {
    return structure.chapters.filter((c) => c.parent_id === row.chapter.parent_id).map((c) => c.id)
  }
  if (row.type === 'item') {
    return structure.items.filter((i) => i.chapter_id === row.item.chapter_id).map((i) => i.id)
  }
  return []
}

/**
 * The whole arrangement of chapters and items with one of them moved by one place among its
 * siblings: what arrangeEstimateStructure wants (every chapter and item, the order of the
 * list giving the position inside each parent). Undefined when it cannot move that way.
 */
export function moved(
  structure: EstimateStructure,
  row: TreeRow,
  by: -1 | 1,
): EstimateArrangement | undefined {
  if (row.type === 'measurement') return undefined
  const swap = <T extends { id: string }>(
    list: T[],
    id: string,
    sameParent: (a: T, b: T) => boolean,
  ) => {
    const result = [...list]
    const index = result.findIndex((entry) => entry.id === id)
    const current = result[index]
    if (!current) return undefined
    // The neighbour is the next sibling in that direction, wherever it is in the flat list
    let other = index + by
    while (other >= 0 && other < result.length) {
      const candidate = result[other]
      if (candidate && sameParent(candidate, current)) break
      other += by
    }
    const neighbour = result[other]
    if (!neighbour) return undefined
    result[index] = neighbour
    result[other] = current
    return result
  }

  let chapters = structure.chapters
  let items = structure.items
  if (row.type === 'chapter') {
    const next = swap(chapters, row.chapter.id, (a, b) => a.parent_id === b.parent_id)
    if (!next) return undefined
    chapters = next
  } else {
    const next = swap(items, row.item.id, (a, b) => a.chapter_id === b.chapter_id)
    if (!next) return undefined
    items = next
  }
  return {
    chapters: chapters.map(({ id, parent_id }) => ({ id, parent_id })),
    items: items.map(({ id, chapter_id }) => ({ id, chapter_id })),
  }
}
