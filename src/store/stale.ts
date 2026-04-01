import type { Snapshot } from '../types.js'

export interface StaleEntry {
  category: string
  name: string
  installedOn: string
  daysAgo: number
}

const STALE_DAYS = 180

export function detectStaleTools(snapshot: Snapshot): StaleEntry[] {
  const now = Date.now()
  const stale: StaleEntry[] = []

  const daysAgo = (dateStr: string) =>
    Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))

  // Brew formulae with known install dates
  if (snapshot.brew.data) {
    for (const f of snapshot.brew.data.formulae) {
      if (f.installedOn) {
        const days = daysAgo(f.installedOn)
        if (days > STALE_DAYS) {
          stale.push({ category: 'Homebrew', name: f.name, installedOn: f.installedOn, daysAgo: days })
        }
      }
    }
  }

  return stale
}
