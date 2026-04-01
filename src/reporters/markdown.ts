import type { Snapshot, AnnotationsStore } from '../types.js'

function ann(annotations: AnnotationsStore, key: string): string {
  const a = annotations[key]
  return a ? ` _(${a.note})_` : ''
}

export function generateMarkdown(snapshot: Snapshot, annotations: AnnotationsStore): string {
  const lines: string[] = []
  const ts = new Date(snapshot.timestamp).toLocaleString()

  lines.push(`# devsnap — ${ts}`)
  lines.push(`> Snapshot ID: \`${snapshot.id}\``)
  lines.push('')

  // System
  lines.push('## System')
  if (snapshot.system.data) {
    const s = snapshot.system.data
    lines.push(`| Key | Value |`)
    lines.push(`|-----|-------|`)
    lines.push(`| OS | ${s.productName} ${s.macosVersion} (${s.macosBuild}) |`)
    lines.push(`| Chip | ${s.chip} |`)
    lines.push(`| RAM | ${s.ramGB} GB |`)
    lines.push(`| Disk | ${s.diskUsed} used / ${s.diskTotal} total (${s.diskFree} free) |`)
  }
  lines.push('')

  // Homebrew
  lines.push('## Homebrew')
  if (snapshot.brew.status === 'unavailable') {
    lines.push('_Not installed_')
  } else if (snapshot.brew.data) {
    const b = snapshot.brew.data
    lines.push(`Version: **${b.version}** | Formulae: **${b.formulae.length}** | Casks: **${b.casks.length}**`)
    lines.push('')
    if (b.formulae.length > 0) {
      lines.push('### Formulae')
      lines.push('| Name | Version | Installed | Note |')
      lines.push('|------|---------|-----------|------|')
      b.formulae.forEach((f) => {
        lines.push(`| ${f.name} | ${f.version} | ${f.installedOn ?? '—'} | ${annotations[`brew:${f.name}`]?.note ?? ''} |`)
      })
      lines.push('')
    }
    if (b.casks.length > 0) {
      lines.push('### Casks')
      lines.push('| Name | Version |')
      lines.push('|------|---------|')
      b.casks.forEach((c) => {
        lines.push(`| ${c.name} | ${c.version} |`)
      })
    }
  }
  lines.push('')

  // Node
  lines.push('## Node Ecosystem')
  if (snapshot.node.status === 'unavailable') {
    lines.push('_Not installed_')
  } else if (snapshot.node.data) {
    const n = snapshot.node.data
    lines.push(`| Runtime | Version |`)
    lines.push(`|---------|---------|`)
    lines.push(`| Node.js | v${n.nodeVersion}${ann(annotations, 'node')} |`)
    if (n.npmVersion) lines.push(`| npm | v${n.npmVersion} |`)
    if (n.pnpmVersion) lines.push(`| pnpm | v${n.pnpmVersion} |`)
    if (n.bunVersion) lines.push(`| bun | v${n.bunVersion} |`)
    if (n.nvmVersion) lines.push(`| nvm | ${n.nvmVersion} |`)
    if (n.fnmVersion) lines.push(`| fnm | v${n.fnmVersion} |`)
    if (n.globalPackages.length > 0) {
      lines.push('')
      lines.push('**Global packages:** ' + n.globalPackages.map((p) => `\`${p.name}@${p.version}\``).join(', '))
    }
  }
  lines.push('')

  // Runtimes
  lines.push('## Runtimes')
  if (snapshot.runtimes.data) {
    const r = snapshot.runtimes.data
    lines.push('| Runtime | Version | Manager |')
    lines.push('|---------|---------|---------|')
    const entries = [
      ['Python', r.python],
      ['Ruby', r.ruby],
      ['Go', r.go],
      ['Rust', r.rust],
      ['Java', r.java],
    ] as const
    for (const [name, entry] of entries) {
      if (entry) {
        const mgr = entry.manager ? `${entry.manager} ${entry.managerVersion ?? ''}`.trim() : '—'
        lines.push(`| ${name} | v${entry.version} | ${mgr} |`)
      } else {
        lines.push(`| ${name} | — | — |`)
      }
    }
  }
  lines.push('')

  // Docker
  lines.push('## Docker')
  if (snapshot.docker.status === 'unavailable') {
    lines.push('_Not installed_')
  } else if (snapshot.docker.data) {
    const d = snapshot.docker.data
    lines.push(`Version: **${d.version}** | Images: **${d.images.length}** | Running: **${d.runningContainers.length}**`)
    if (d.runningContainers.length > 0) {
      lines.push('')
      lines.push('| ID | Name | Image | Status |')
      lines.push('|----|------|-------|--------|')
      d.runningContainers.forEach((c) => lines.push(`| ${c.id.slice(0, 12)} | ${c.name} | ${c.image} | ${c.status} |`))
    }
  }
  lines.push('')

  // Databases
  lines.push('## Databases')
  if (snapshot.databases.data) {
    const d = snapshot.databases.data
    lines.push('| Database | Version | Running | Note |')
    lines.push('|----------|---------|---------|------|')
    for (const db of [d.postgres, d.mysql, d.redis, d.mongodb, d.sqlite]) {
      lines.push(`| ${db.name} | ${db.installed ? (db.version ?? '—') : '_not installed_'} | ${db.installed ? (db.running ? '✓' : '—') : ''} | ${annotations[`db:${db.name.toLowerCase()}`]?.note ?? ''} |`)
    }
  }
  lines.push('')

  // Browsers
  lines.push('## Browsers')
  if (snapshot.browsers.data) {
    const installed = snapshot.browsers.data.browsers.filter((b) => b.installed)
    if (installed.length === 0) {
      lines.push('_No browsers detected_')
    } else {
      lines.push('| Browser | Version |')
      lines.push('|---------|---------|')
      installed.forEach((b) => lines.push(`| ${b.name} | ${b.version ?? '—'} |`))
    }
  }
  lines.push('')

  // Terminals
  lines.push('## Terminals')
  if (snapshot.terminals.data) {
    const { shell, shellVersion, tmux, terminals } = snapshot.terminals.data
    lines.push(`| App | Version |`)
    lines.push(`|-----|---------|`)
    lines.push(`| Shell (${shell}) | ${shellVersion ? `v${shellVersion}` : '—'} |`)
    lines.push(`| tmux | ${tmux ? `v${tmux}` : '—'} |`)
    terminals.filter((t) => t.installed).forEach((term) => {
      lines.push(`| ${term.name} | ${term.version ?? '—'} |`)
    })
  }
  lines.push('')

  // Editors
  lines.push('## Editors / IDEs')
  if (snapshot.editors.data) {
    const installed = snapshot.editors.data.editors.filter((e) => e.installed)
    if (installed.length === 0) {
      lines.push('_No editors detected_')
    } else {
      lines.push('| Editor | Version | Extensions |')
      lines.push('|--------|---------|------------|')
      installed.forEach((e) => {
        lines.push(`| ${e.name} | ${e.version ?? '—'} | ${e.extensionCount !== undefined ? e.extensionCount : '—'} |`)
      })
    }
  }
  lines.push('')

  // LLMs
  lines.push('## LLMs / AI Tools')
  if (snapshot.llms.data) {
    const l = snapshot.llms.data
    lines.push('| Tool | Status |')
    lines.push('|------|--------|')
    lines.push(`| Ollama | ${l.ollama.installed ? `v${l.ollama.version ?? '?'}` : '—'} |`)
    if (l.ollama.installed && l.ollama.models.length > 0) {
      lines.push(`| ↳ Models | ${l.ollama.models.map((m) => m.name).join(', ')} |`)
    }
    lines.push(`| LM Studio | ${l.lmStudio.installed ? 'installed' : '—'} |`)
    lines.push(`| Claude Desktop | ${l.claudeDesktop.installed ? 'installed' : '—'} |`)
    lines.push(`| GitHub Copilot | ${l.copilot.installed ? 'extension installed' : '—'} |`)
  }
  lines.push('')

  // CLI Tools
  lines.push('## CLI Tools')
  if (snapshot.cliTools.data) {
    const installed = snapshot.cliTools.data.tools.filter((t) => t.installed)
    const notInstalled = snapshot.cliTools.data.tools.filter((t) => !t.installed)
    lines.push('| Tool | Version | Note |')
    lines.push('|------|---------|------|')
    installed.forEach((tool) => {
      lines.push(`| ${tool.name} | ${tool.version ?? '—'} | ${annotations[`cli:${tool.name}`]?.note ?? ''} |`)
    })
    if (notInstalled.length > 0) {
      lines.push('')
      lines.push('**Not installed:** ' + notInstalled.map((t) => t.name).join(', '))
    }
  }
  lines.push('')

  return lines.join('\n')
}
