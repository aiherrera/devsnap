import chalk from 'chalk'
import Table from 'cli-table3'
import type { Snapshot, AnnotationsStore } from '../types.js'
import { detectStaleTools } from '../store/stale.js'

function statusIcon(installed: boolean): string {
  return installed ? chalk.green('✓') : chalk.dim('✗')
}

function note(annotations: AnnotationsStore, key: string): string {
  const ann = annotations[key]
  return ann ? chalk.dim(` ← ${ann.note}`) : ''
}

function sectionHeader(title: string): void {
  console.log('\n' + chalk.bold.cyan(`  ${title}`))
  console.log(chalk.dim('  ' + '─'.repeat(title.length + 2)))
}

export function printSnapshot(snapshot: Snapshot, annotations: AnnotationsStore): void {
  const ts = new Date(snapshot.timestamp).toLocaleString()
  console.log('\n' + chalk.bold.white('devsnap') + chalk.dim(` — ${ts}`) + chalk.dim(` [${snapshot.id}]`))

  // ── System ────────────────────────────────────────────────────────────────
  sectionHeader('System')
  if (snapshot.system.data) {
    const s = snapshot.system.data
    const t = new Table({ style: { border: [], head: [] } })
    t.push(
      [chalk.dim('OS'), `${s.productName} ${s.macosVersion} (${s.macosBuild})`],
      [chalk.dim('Chip'), s.chip],
      [chalk.dim('RAM'), `${s.ramGB} GB`],
      [chalk.dim('Disk'), `${s.diskUsed} used / ${s.diskTotal} total (${s.diskFree} free)`],
    )
    console.log(t.toString())
  }

  // ── Homebrew ──────────────────────────────────────────────────────────────
  sectionHeader('Homebrew')
  if (snapshot.brew.status === 'unavailable') {
    console.log(chalk.dim('  Homebrew not installed'))
  } else if (snapshot.brew.data) {
    const b = snapshot.brew.data
    console.log(`  ${chalk.dim('Version:')} ${b.version}`)
    console.log(`  ${chalk.dim('Formulae:')} ${chalk.bold(String(b.formulae.length))}  ${chalk.dim('Casks:')} ${chalk.bold(String(b.casks.length))}`)

    if (b.formulae.length > 0) {
      console.log(chalk.dim('\n  Top formulae:'))
      const t = new Table({ head: ['Name', 'Version', 'Installed', 'Note'].map((h) => chalk.dim(h)), style: { border: [], head: [] } })
      b.formulae.slice(0, 20).forEach((f) => {
        t.push([f.name, f.version, f.installedOn ?? '—', annotations[`brew:${f.name}`]?.note ?? ''])
      })
      if (b.formulae.length > 20) t.push([chalk.dim(`  …and ${b.formulae.length - 20} more`), '', '', ''])
      console.log(t.toString())
    }
  }

  // ── Node Ecosystem ────────────────────────────────────────────────────────
  sectionHeader('Node Ecosystem')
  if (snapshot.node.status === 'unavailable') {
    console.log(chalk.dim('  Node.js not installed'))
  } else if (snapshot.node.data) {
    const n = snapshot.node.data
    const t = new Table({ style: { border: [], head: [] } })
    t.push(
      [chalk.dim('Node'), `v${n.nodeVersion}${note(annotations, 'node')}`],
      [chalk.dim('npm'), n.npmVersion ? `v${n.npmVersion}` : chalk.dim('—')],
      [chalk.dim('pnpm'), n.pnpmVersion ? `v${n.pnpmVersion}` : chalk.dim('—')],
      [chalk.dim('bun'), n.bunVersion ? `v${n.bunVersion}` : chalk.dim('—')],
      [chalk.dim('nvm'), n.nvmVersion ?? chalk.dim('—')],
      [chalk.dim('fnm'), n.fnmVersion ? `v${n.fnmVersion}` : chalk.dim('—')],
    )
    console.log(t.toString())
    if (n.globalPackages.length > 0) {
      console.log(chalk.dim(`  Global packages (${n.globalPackages.length}):`), n.globalPackages.map((p) => `${p.name}@${p.version ?? '—'}`).join(', '))
    }
  }

  // ── Runtimes ──────────────────────────────────────────────────────────────
  sectionHeader('Runtimes')
  if (snapshot.runtimes.data) {
    const r = snapshot.runtimes.data
    const rows = [
      ['Python', r.python],
      ['Ruby', r.ruby],
      ['Go', r.go],
      ['Rust', r.rust],
      ['Java', r.java],
    ] as const
    const t = new Table({ style: { border: [], head: [] } })
    for (const [name, entry] of rows) {
      if (entry) {
        const mgr = entry.manager ? chalk.dim(` (${entry.manager} ${entry.managerVersion ?? ''})`.trim()) : ''
        t.push([chalk.dim(name), `v${entry.version}${mgr}${note(annotations, `runtime:${name.toLowerCase()}`)}`])
      } else {
        t.push([chalk.dim(name), chalk.dim('not installed')])
      }
    }
    console.log(t.toString())
  }

  // ── Docker ────────────────────────────────────────────────────────────────
  sectionHeader('Docker')
  if (snapshot.docker.status === 'unavailable') {
    console.log(chalk.dim('  Docker not installed'))
  } else if (snapshot.docker.data) {
    const d = snapshot.docker.data
    console.log(`  ${chalk.dim('Version:')} ${d.version}  ${chalk.dim('Images:')} ${chalk.bold(String(d.images.length))}  ${chalk.dim('Running containers:')} ${chalk.bold(String(d.runningContainers.length))}`)
    if (d.runningContainers.length > 0) {
      const t = new Table({ head: ['ID', 'Name', 'Image', 'Status'].map((h) => chalk.dim(h)), style: { border: [], head: [] } })
      d.runningContainers.forEach((c) => t.push([c.id.slice(0, 12), c.name, c.image, c.status]))
      console.log(t.toString())
    }
  }

  // ── Databases ─────────────────────────────────────────────────────────────
  sectionHeader('Databases')
  if (snapshot.databases.data) {
    const d = snapshot.databases.data
    const t = new Table({ head: ['Database', 'Version', 'Running', 'Note'].map((h) => chalk.dim(h)), style: { border: [], head: [] } })
    for (const db of [d.postgres, d.mysql, d.redis, d.mongodb, d.sqlite]) {
      if (db.installed) {
        t.push([
          db.name,
          db.version ?? '—',
          db.running ? chalk.green('yes') : chalk.dim('no'),
          annotations[`db:${db.name.toLowerCase()}`]?.note ?? '',
        ])
      } else {
        t.push([chalk.dim(db.name), chalk.dim('—'), chalk.dim('—'), ''])
      }
    }
    console.log(t.toString())
  }

  // ── Browsers ──────────────────────────────────────────────────────────────
  sectionHeader('Browsers')
  if (snapshot.browsers.data) {
    const installed = snapshot.browsers.data.browsers.filter((b) => b.installed)
    if (installed.length === 0) {
      console.log(chalk.dim('  No browsers detected'))
    } else {
      const t = new Table({ style: { border: [], head: [] } })
      installed.forEach((b) => t.push([`${statusIcon(true)} ${b.name}`, b.version ?? '—']))
      console.log(t.toString())
    }
  }

  // ── Terminals ─────────────────────────────────────────────────────────────
  sectionHeader('Terminals')
  if (snapshot.terminals.data) {
    const t = new Table({ style: { border: [], head: [] } })
    const { shell, shellVersion, tmux, terminals } = snapshot.terminals.data
    t.push([chalk.dim('Shell'), `${shell}${shellVersion ? ` v${shellVersion}` : ''}`])
    t.push([chalk.dim('tmux'), tmux ? `v${tmux}` : chalk.dim('not installed')])
    terminals.filter((t) => t.installed).forEach((term) => {
      t.push([`  ${statusIcon(true)} ${term.name}`, term.version ?? '—'])
    })
    console.log(t.toString())
  }

  // ── Editors ───────────────────────────────────────────────────────────────
  sectionHeader('Editors / IDEs')
  if (snapshot.editors.data) {
    const installed = snapshot.editors.data.editors.filter((e) => e.installed)
    if (installed.length === 0) {
      console.log(chalk.dim('  No editors detected'))
    } else {
      const t = new Table({ style: { border: [], head: [] } })
      installed.forEach((e) => {
        const ext = e.extensionCount !== undefined ? chalk.dim(` (${e.extensionCount} extensions)`) : ''
        t.push([`${statusIcon(true)} ${e.name}`, `${e.version ?? '—'}${ext}`])
      })
      console.log(t.toString())
    }
  }

  // ── LLMs ──────────────────────────────────────────────────────────────────
  sectionHeader('LLMs / AI Tools')
  if (snapshot.llms.data) {
    const l = snapshot.llms.data
    const t = new Table({ style: { border: [], head: [] } })
    t.push([`${statusIcon(l.ollama.installed)} Ollama`, l.ollama.version ? `v${l.ollama.version}` : chalk.dim(l.ollama.installed ? 'installed' : '—')])
    if (l.ollama.installed && l.ollama.models.length > 0) {
      t.push([chalk.dim('  models'), l.ollama.models.map((m) => m.name).join(', ')])
    }
    t.push([`${statusIcon(l.lmStudio.installed)} LM Studio`, l.lmStudio.installed ? 'installed' : chalk.dim('—')])
    t.push([`${statusIcon(l.claudeDesktop.installed)} Claude Desktop`, l.claudeDesktop.installed ? 'installed' : chalk.dim('—')])
    t.push([`${statusIcon(l.copilot.installed)} GitHub Copilot`, l.copilot.installed ? 'extension installed' : chalk.dim('—')])
    console.log(t.toString())
  }

  // ── CLI Tools ─────────────────────────────────────────────────────────────
  sectionHeader('CLI Tools')
  if (snapshot.cliTools.data) {
    const installed = snapshot.cliTools.data.tools.filter((t) => t.installed)
    const notInstalled = snapshot.cliTools.data.tools.filter((t) => !t.installed)

    const t = new Table({ head: ['Tool', 'Version', 'Note'].map((h) => chalk.dim(h)), style: { border: [], head: [] } })
    installed.forEach((tool) => {
      t.push([chalk.green(tool.name), tool.version ?? '—', annotations[`cli:${tool.name}`]?.note ?? ''])
    })
    console.log(t.toString())

    if (notInstalled.length > 0) {
      console.log(chalk.dim(`  Not installed: ${notInstalled.map((t) => t.name).join(', ')}`))
    }
  }

  // ── Stale Tools ───────────────────────────────────────────────────────────
  const stale = detectStaleTools(snapshot)
  if (stale.length > 0) {
    sectionHeader('Stale Tools (>180 days)')
    const t = new Table({ head: ['Tool', 'Category', 'Installed', 'Days Ago'].map((h) => chalk.dim(h)), style: { border: [], head: [] } })
    stale.forEach((s) => t.push([chalk.yellow(s.name), s.category, s.installedOn, chalk.yellow(String(s.daysAgo))]))
    console.log(t.toString())
    console.log(chalk.dim(`  These tools haven't changed in over 180 days — consider reviewing them.\n`))
  }

  console.log()
}
