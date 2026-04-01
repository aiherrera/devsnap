import type { Snapshot, DiffEntry } from '../types.js'

type LooseRecord = Record<string, unknown>

function diffArrays(
  before: LooseRecord[],
  after: LooseRecord[],
  idKey = 'name',
): DiffEntry[] {
  const entries: DiffEntry[] = []
  const beforeMap = new Map(before.map((i) => [String(i[idKey] ?? ''), i]))
  const afterMap = new Map(after.map((i) => [String(i[idKey] ?? ''), i]))

  for (const [key, bItem] of beforeMap) {
    if (!afterMap.has(key)) {
      entries.push({ key, type: 'removed', before: JSON.stringify(bItem) })
    } else {
      const aItem = afterMap.get(key)!
      if (JSON.stringify(bItem) !== JSON.stringify(aItem)) {
        const bVersion = String((bItem as LooseRecord)['version'] ?? JSON.stringify(bItem))
        const aVersion = String((aItem as LooseRecord)['version'] ?? JSON.stringify(aItem))
        if (bVersion !== aVersion) {
          entries.push({ key, type: 'changed', before: bVersion, after: aVersion })
        }
      }
    }
  }

  for (const [key, aItem] of afterMap) {
    if (!beforeMap.has(key)) {
      entries.push({ key, type: 'added', after: JSON.stringify(aItem) })
    }
  }

  return entries
}

/** Semantic diff between two devsnap snapshots (CLI + dashboard). */
export function diffSnapshots(before: Snapshot, after: Snapshot): Record<string, DiffEntry[]> {
  const categories: Record<string, DiffEntry[]> = {}

  const cast = (arr: unknown[]): LooseRecord[] => arr as LooseRecord[]

  if (before.brew.data && after.brew.data) {
    const d = diffArrays(cast(before.brew.data.formulae), cast(after.brew.data.formulae))
    if (d.length > 0) categories['Homebrew Formulae'] = d
  }

  if (before.brew.data && after.brew.data) {
    const d = diffArrays(cast(before.brew.data.casks), cast(after.brew.data.casks))
    if (d.length > 0) categories['Homebrew Casks'] = d
  }

  if (before.node.data && after.node.data) {
    const entries: DiffEntry[] = []
    const fields: Array<keyof typeof before.node.data> = ['nodeVersion', 'npmVersion', 'pnpmVersion', 'bunVersion']
    for (const field of fields) {
      const b = before.node.data[field]
      const a = after.node.data[field]
      if (b !== a) {
        entries.push({ key: String(field), type: 'changed', before: String(b ?? '—'), after: String(a ?? '—') })
      }
    }
    const d = diffArrays(cast(before.node.data.globalPackages), cast(after.node.data.globalPackages))
    entries.push(...d)
    if (entries.length > 0) categories['Node Ecosystem'] = entries
  }

  if (before.runtimes.data && after.runtimes.data) {
    const entries: DiffEntry[] = []
    const names = ['python', 'ruby', 'go', 'rust', 'java'] as const
    for (const name of names) {
      const b = before.runtimes.data[name]
      const a = after.runtimes.data[name]
      if (!b && a) entries.push({ key: name, type: 'added', after: a.version })
      else if (b && !a) entries.push({ key: name, type: 'removed', before: b.version })
      else if (b && a && b.version !== a.version) entries.push({ key: name, type: 'changed', before: b.version, after: a.version })
    }
    if (entries.length > 0) categories['Runtimes'] = entries
  }

  if (before.docker.data && after.docker.data) {
    const d = diffArrays(
      cast(before.docker.data.images.map((i) => ({ name: `${i.repository}:${i.tag}`, ...i }))),
      cast(after.docker.data.images.map((i) => ({ name: `${i.repository}:${i.tag}`, ...i }))),
    )
    if (d.length > 0) categories['Docker Images'] = d
  }

  if (before.cliTools.data && after.cliTools.data) {
    const d = diffArrays(cast(before.cliTools.data.tools), cast(after.cliTools.data.tools))
    if (d.length > 0) categories['CLI Tools'] = d
  }

  if (before.browsers.data && after.browsers.data) {
    const d = diffArrays(
      cast(before.browsers.data.browsers.filter((b) => b.installed)),
      cast(after.browsers.data.browsers.filter((b) => b.installed)),
    )
    if (d.length > 0) categories['Browsers'] = d
  }

  if (before.editors.data && after.editors.data) {
    const d = diffArrays(
      cast(before.editors.data.editors.filter((e) => e.installed)),
      cast(after.editors.data.editors.filter((e) => e.installed)),
    )
    if (d.length > 0) categories['Editors'] = d
  }

  return categories
}
