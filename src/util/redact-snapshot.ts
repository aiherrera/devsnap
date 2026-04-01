import type { Snapshot } from '../types.js'

/** Remove filesystem paths from CLI tool entries for safer cloud upload (optional). */
export function redactSnapshotPaths(snapshot: Snapshot): Snapshot {
  const clone = structuredClone(snapshot) as Snapshot
  if (clone.cliTools.data?.tools) {
    for (const t of clone.cliTools.data.tools) {
      t.path = t.path ? '[redacted]' : null
    }
  }
  return clone
}
