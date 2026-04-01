import chalk from 'chalk'
import { listSnapshots, loadSnapshot } from '../store/snapshots.js'
import type { Snapshot } from '../types.js'

interface SearchHit {
  category: string
  field: string
  value: string
}

function searchSnapshot(snapshot: Snapshot, query: string): SearchHit[] {
  const q = query.toLowerCase()
  const hits: SearchHit[] = []

  const check = (category: string, field: string, value: string | null | undefined) => {
    if (value && value.toLowerCase().includes(q)) {
      hits.push({ category, field, value })
    }
  }

  // Brew formulae
  if (snapshot.brew.data) {
    for (const f of snapshot.brew.data.formulae) {
      check('Homebrew', f.name, f.name)
      check('Homebrew', f.name, f.description)
    }
    for (const c of snapshot.brew.data.casks) {
      check('Homebrew Casks', c.name, c.name)
      check('Homebrew Casks', c.name, c.description)
    }
  }

  // Node packages
  if (snapshot.node.data) {
    for (const p of snapshot.node.data.globalPackages) {
      check('npm Global', p.name, p.name)
    }
    check('Node', 'version', snapshot.node.data.nodeVersion)
  }

  // Runtimes
  if (snapshot.runtimes.data) {
    const entries = [
      ['Python', snapshot.runtimes.data.python],
      ['Ruby', snapshot.runtimes.data.ruby],
      ['Go', snapshot.runtimes.data.go],
      ['Rust', snapshot.runtimes.data.rust],
      ['Java', snapshot.runtimes.data.java],
    ] as const
    for (const [name, entry] of entries) {
      if (entry) check('Runtimes', name, name)
    }
  }

  // Docker images
  if (snapshot.docker.data) {
    for (const img of snapshot.docker.data.images) {
      check('Docker Images', `${img.repository}:${img.tag}`, img.repository)
      check('Docker Images', `${img.repository}:${img.tag}`, img.tag)
    }
    for (const c of snapshot.docker.data.runningContainers) {
      check('Docker Containers', c.name, c.name)
      check('Docker Containers', c.name, c.image)
    }
  }

  // Browsers
  if (snapshot.browsers.data) {
    for (const b of snapshot.browsers.data.browsers.filter((b) => b.installed)) {
      check('Browsers', b.name, b.name)
    }
  }

  // Editors
  if (snapshot.editors.data) {
    for (const e of snapshot.editors.data.editors.filter((e) => e.installed)) {
      check('Editors', e.name, e.name)
    }
  }

  // LLMs
  if (snapshot.llms.data) {
    for (const m of snapshot.llms.data.ollama.models) {
      check('Ollama Models', m.name, m.name)
    }
  }

  // CLI tools
  if (snapshot.cliTools.data) {
    for (const t of snapshot.cliTools.data.tools.filter((t) => t.installed)) {
      check('CLI Tools', t.name, t.name)
      check('CLI Tools', t.name, t.path)
    }
  }

  // System
  if (snapshot.system.data) {
    check('System', 'chip', snapshot.system.data.chip)
    check('System', 'os', snapshot.system.data.macosVersion)
  }

  return hits
}

export async function runSearch(query: string, snapshotId?: string): Promise<void> {
  const snapshots = await listSnapshots()
  if (snapshots.length === 0) {
    console.error('No snapshots found. Run `devsnap scan` first.')
    process.exit(1)
  }

  const meta = snapshotId
    ? snapshots.find((s) => s.id === snapshotId)
    : snapshots[snapshots.length - 1]

  if (!meta) {
    console.error(`Snapshot not found: ${snapshotId}`)
    process.exit(1)
  }

  let snapshot
  try {
    snapshot = await loadSnapshot(meta.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(msg)
    process.exit(1)
  }
  const hits = searchSnapshot(snapshot, query)

  console.log(`\nSearch: ${chalk.cyan(query)}  ${chalk.dim(`in ${meta.id}`)}`)

  if (hits.length === 0) {
    console.log(chalk.dim(`  No results found.\n`))
    return
  }

  // Group by category
  const grouped = new Map<string, SearchHit[]>()
  for (const hit of hits) {
    const list = grouped.get(hit.category) ?? []
    list.push(hit)
    grouped.set(hit.category, list)
  }

  for (const [category, categoryHits] of grouped) {
    console.log(`\n  ${chalk.bold.cyan(category)}`)
    for (const hit of categoryHits) {
      const highlighted = hit.value.replace(
        new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        (m) => chalk.yellow.bold(m),
      )
      console.log(`    ${chalk.dim('·')} ${highlighted}`)
    }
  }
  console.log()
}
