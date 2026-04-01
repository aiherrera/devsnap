import type { Snapshot, AnnotationsStore } from '../types.js'
import { detectStaleTools } from '../store/stale.js'

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function badge(installed: boolean): string {
  return installed
    ? '<span class="badge ok">✓</span>'
    : '<span class="badge no">✗</span>'
}

function noteHtml(annotations: AnnotationsStore, key: string): string {
  const a = annotations[key]
  return a ? `<span class="note" title="${esc(a.updatedAt)}">← ${esc(a.note)}</span>` : ''
}

function section(title: string, content: string, id: string): string {
  return `
  <details open id="${id}">
    <summary>
      <h2>${esc(title)}</h2>
      <a href="#devsnap-top" class="to-top" aria-label="Back to top" title="Back to top" onclick="event.stopPropagation()">↑</a>
    </summary>
    <div class="section-body">${content}</div>
  </details>`
}

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('')
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

// ── Chart helpers (pure SVG, no CDN) ─────────────────────────────────────────

interface BarDatum { label: string; value: number; color: string }

function svgHBar(data: BarDatum[]): string {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const rowH = 30
  const labelW = 130
  const barMaxW = 220
  const valueW = 36
  const width = labelW + barMaxW + valueW
  const height = data.length * rowH + 6

  const rows = data.map((d, i) => {
    const bw = Math.max((d.value / maxVal) * barMaxW, d.value > 0 ? 4 : 0)
    const y = i * rowH + 4
    return `
      <text x="${labelW - 8}" y="${y + 17}" text-anchor="end" class="bar-lbl">${esc(d.label)}</text>
      <rect x="${labelW}" y="${y + 3}" width="${bw}" height="18" rx="3" fill="${d.color}" opacity="0.82"/>
      <text x="${labelW + bw + 6}" y="${y + 17}" class="bar-val">${d.value}</text>`
  }).join('')

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" class="chart-hbar">${rows}</svg>`
}

interface DonutSlice { label: string; value: number; color: string }

function svgDonut(slices: DonutSlice[], size = 140): string {
  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="chart-donut"><circle cx="${size/2}" cy="${size/2}" r="${size*0.38}" fill="none" stroke="var(--border)" stroke-width="${size*0.14}"/></svg>`

  const cx = size / 2, cy = size / 2, r = size * 0.38, ir = size * 0.25
  let paths = ''
  let angle = -Math.PI / 2

  for (const slice of slices) {
    if (slice.value <= 0) continue
    const sweep = (slice.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
    const endAngle = angle + sweep
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
    const lg = sweep > Math.PI ? 1 : 0
    const ix1 = cx + ir * Math.cos(endAngle), iy1 = cy + ir * Math.sin(endAngle)
    const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
    paths += `<path d="M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${lg},0 ${ix2},${iy2} Z" fill="${slice.color}" opacity="0.88"/>`
    angle = endAngle
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" class="chart-donut">${paths}</svg>`
}

function buildCharts(snapshot: Snapshot): string {
  // Tool counts by category
  const barData: BarDatum[] = [
    { label: 'Brew formulae', value: snapshot.brew.data?.formulae.length ?? 0, color: '#f59e0b' },
    { label: 'Brew casks', value: snapshot.brew.data?.casks.length ?? 0, color: '#fb923c' },
    { label: 'CLI tools', value: snapshot.cliTools.data?.tools.filter((t) => t.installed).length ?? 0, color: '#60a5fa' },
    { label: 'Docker images', value: snapshot.docker.data?.images.length ?? 0, color: '#818cf8' },
    { label: 'Ollama models', value: snapshot.llms.data?.ollama.models.length ?? 0, color: '#a78bfa' },
    { label: 'Global npm pkgs', value: snapshot.node.data?.globalPackages.length ?? 0, color: '#34d399' },
  ]

  // CLI tools installed vs missing
  const cliInstalled = snapshot.cliTools.data?.tools.filter((t) => t.installed).length ?? 0
  const cliMissing = snapshot.cliTools.data?.tools.filter((t) => !t.installed).length ?? 0
  const cliDonut = svgDonut([
    { label: 'Installed', value: cliInstalled, color: '#4ade80' },
    { label: 'Missing', value: cliMissing, color: '#374151' },
  ])

  // Databases running vs stopped vs missing
  const dbs = snapshot.databases.data
  const dbRunning = dbs ? [dbs.postgres, dbs.mysql, dbs.redis, dbs.mongodb, dbs.sqlite].filter((d) => d.running).length : 0
  const dbStopped = dbs ? [dbs.postgres, dbs.mysql, dbs.redis, dbs.mongodb, dbs.sqlite].filter((d) => d.installed && !d.running).length : 0
  const dbMissing = dbs ? [dbs.postgres, dbs.mysql, dbs.redis, dbs.mongodb, dbs.sqlite].filter((d) => !d.installed).length : 0
  const dbDonut = svgDonut([
    { label: 'Running', value: dbRunning, color: '#4ade80' },
    { label: 'Stopped', value: dbStopped, color: '#f59e0b' },
    { label: 'Missing', value: dbMissing, color: '#374151' },
  ])

  const legend = (items: { color: string; label: string; value: number }[]) =>
    items.map((i) => `<div class="leg-item"><span class="leg-dot" style="background:${i.color}"></span><span class="leg-label">${esc(i.label)}</span><span class="leg-val">${i.value}</span></div>`).join('')

  return `<div class="charts-grid">
    <div class="chart-card wide">
      <div class="chart-title">Tool Inventory</div>
      ${svgHBar(barData)}
    </div>
    <div class="chart-card">
      <div class="chart-title">CLI Coverage</div>
      <div class="donut-wrap">
        ${cliDonut}
        <div class="donut-legend">
          ${legend([{color:'#4ade80',label:'Installed',value:cliInstalled},{color:'#374151',label:'Missing',value:cliMissing}])}
        </div>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Databases</div>
      <div class="donut-wrap">
        ${dbDonut}
        <div class="donut-legend">
          ${legend([{color:'#4ade80',label:'Running',value:dbRunning},{color:'#f59e0b',label:'Stopped',value:dbStopped},{color:'#374151',label:'Missing',value:dbMissing}])}
        </div>
      </div>
    </div>
  </div>`
}

function buildSummaryStats(snapshot: Snapshot): string {
  const brewCount = (snapshot.brew.data?.formulae.length ?? 0) + (snapshot.brew.data?.casks.length ?? 0)
  const cliCount = snapshot.cliTools.data?.tools.filter((t) => t.installed).length ?? 0
  const editorCount = snapshot.editors.data?.editors.filter((e) => e.installed).length ?? 0
  const browserCount = snapshot.browsers.data?.browsers.filter((b) => b.installed).length ?? 0
  const dockerImages = snapshot.docker.data?.images.length ?? 0
  const ollamaModels = snapshot.llms.data?.ollama.models.length ?? 0
  const staleCount = detectStaleTools(snapshot).length

  const stat = (label: string, value: number, fragment: string, warn = false) =>
    `<a href="#${fragment}" class="stat stat-link${warn && value > 0 ? ' warn' : ''}"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></a>`

  return `<div class="summary-stats" id="devsnap-summary">
    ${stat('brew packages', brewCount, 'brew')}
    ${stat('CLI tools', cliCount, 'cli-tools')}
    ${stat('editors', editorCount, 'editors')}
    ${stat('browsers', browserCount, 'browsers')}
    ${stat('docker images', dockerImages, 'docker')}
    ${stat('ollama models', ollamaModels, 'llms')}
    ${stat('stale tools', staleCount, 'stale', true)}
  </div>`
}

export function generateHTML(snapshot: Snapshot, annotations: AnnotationsStore): string {
  const ts = new Date(snapshot.timestamp).toLocaleString()
  const sections: string[] = []

  // System
  if (snapshot.system.data) {
    const s = snapshot.system.data
    const rows = [
      ['OS', `${esc(s.productName)} ${esc(s.macosVersion)} (${esc(s.macosBuild)})`],
      ['Chip', esc(s.chip)],
      ['RAM', `${s.ramGB} GB`],
      ['Disk', `${esc(s.diskUsed)} used / ${esc(s.diskTotal)} total (${esc(s.diskFree)} free)`],
    ]
    sections.push(section('System', table(['Key', 'Value'], rows), 'system'))
  }

  // Homebrew
  if (snapshot.brew.status === 'unavailable') {
    sections.push(section('Homebrew', '<p class="dim">Not installed</p>', 'brew'))
  } else if (snapshot.brew.data) {
    const b = snapshot.brew.data
    let content = `<p>Version: <strong>${esc(b.version)}</strong> &nbsp; Formulae: <strong>${b.formulae.length}</strong> &nbsp; Casks: <strong>${b.casks.length}</strong></p>`
    if (b.formulae.length > 0) {
      content += '<h3>Formulae</h3>'
      content += table(
        ['Name', 'Version', 'Installed', 'Note'],
        b.formulae.map((f) => [esc(f.name), esc(f.version), esc(f.installedOn ?? '—'), noteHtml(annotations, `brew:${f.name}`)]),
      )
    }
    if (b.casks.length > 0) {
      content += '<h3>Casks</h3>'
      content += table(['Name', 'Version', 'Description'], b.casks.map((c) => [esc(c.name), esc(c.version), esc(c.description)]))
    }
    sections.push(section('Homebrew', content, 'brew'))
  }

  // Node
  if (snapshot.node.status === 'unavailable') {
    sections.push(section('Node Ecosystem', '<p class="dim">Not installed</p>', 'node'))
  } else if (snapshot.node.data) {
    const n = snapshot.node.data
    const rows: string[][] = [
      ['Node.js', `v${esc(n.nodeVersion)}`, noteHtml(annotations, 'node')],
      ['npm', n.npmVersion ? `v${esc(n.npmVersion)}` : '—', ''],
      ['pnpm', n.pnpmVersion ? `v${esc(n.pnpmVersion)}` : '—', ''],
      ['bun', n.bunVersion ? `v${esc(n.bunVersion)}` : '—', ''],
      ['nvm', n.nvmVersion ? esc(n.nvmVersion) : '—', ''],
      ['fnm', n.fnmVersion ? `v${esc(n.fnmVersion)}` : '—', ''],
    ]
    let content = table(['Runtime', 'Version', 'Note'], rows)
    if (n.globalPackages.length > 0) {
      content += `<p><strong>Global packages (${n.globalPackages.length}):</strong> ${n.globalPackages.map((p) => `<code>${esc(p.name)}@${esc(p.version ?? '—')}</code>`).join(' ')}</p>`
    }
    sections.push(section('Node Ecosystem', content, 'node'))
  }

  // Runtimes
  if (snapshot.runtimes.data) {
    const r = snapshot.runtimes.data
    const entries = [['Python', r.python], ['Ruby', r.ruby], ['Go', r.go], ['Rust', r.rust], ['Java', r.java]] as const
    const rows = entries.map(([name, entry]) => {
      if (!entry) return [esc(name), '—', '—']
      const mgr = entry.manager ? `${esc(entry.manager)} ${esc(entry.managerVersion ?? '')}`.trim() : '—'
      return [esc(name), `v${esc(entry.version)}`, mgr]
    })
    sections.push(section('Runtimes', table(['Runtime', 'Version', 'Manager'], rows), 'runtimes'))
  }

  // Docker
  if (snapshot.docker.status === 'unavailable') {
    sections.push(section('Docker', '<p class="dim">Not installed</p>', 'docker'))
  } else if (snapshot.docker.data) {
    const d = snapshot.docker.data
    let content = `<p>Version: <strong>${esc(d.version)}</strong> &nbsp; Images: <strong>${d.images.length}</strong> &nbsp; Running containers: <strong>${d.runningContainers.length}</strong></p>`
    if (d.runningContainers.length > 0) {
      content += table(['ID', 'Name', 'Image', 'Status'], d.runningContainers.map((c) => [esc(c.id.slice(0, 12)), esc(c.name), esc(c.image), esc(c.status)]))
    }
    if (d.images.length > 0) {
      content += '<h3>Images</h3>'
      content += table(['Repository', 'Tag', 'Size', 'Created'], d.images.map((i) => [esc(i.repository), esc(i.tag), esc(i.size), esc(i.created)]))
    }
    sections.push(section('Docker', content, 'docker'))
  }

  // Databases
  if (snapshot.databases.data) {
    const d = snapshot.databases.data
    const rows = [d.postgres, d.mysql, d.redis, d.mongodb, d.sqlite].map((db) => [
      esc(db.name),
      db.installed ? esc(db.version ?? '—') : '<span class="dim">not installed</span>',
      db.installed ? (db.running ? '<span class="badge ok">running</span>' : '<span class="dim">stopped</span>') : '',
      noteHtml(annotations, `db:${db.name.toLowerCase()}`),
    ])
    sections.push(section('Databases', table(['Database', 'Version', 'Status', 'Note'], rows), 'databases'))
  }

  // Browsers
  if (snapshot.browsers.data) {
    const installed = snapshot.browsers.data.browsers.filter((b) => b.installed)
    const content = installed.length === 0
      ? '<p class="dim">No browsers detected</p>'
      : table(['Browser', 'Version'], installed.map((b) => [esc(b.name), esc(b.version ?? '—')]))
    sections.push(section('Browsers', content, 'browsers'))
  }

  // Terminals
  if (snapshot.terminals.data) {
    const { shell, shellVersion, tmux, terminals } = snapshot.terminals.data
    const rows: string[][] = [
      [`Shell (${esc(shell)})`, shellVersion ? `v${esc(shellVersion)}` : '—'],
      ['tmux', tmux ? `v${esc(tmux)}` : '—'],
      ...terminals.filter((t) => t.installed).map((t) => [esc(t.name), esc(t.version ?? '—')]),
    ]
    sections.push(section('Terminals', table(['App', 'Version'], rows), 'terminals'))
  }

  // Editors
  if (snapshot.editors.data) {
    const installed = snapshot.editors.data.editors.filter((e) => e.installed)
    const content = installed.length === 0
      ? '<p class="dim">No editors detected</p>'
      : table(
          ['Editor', 'Version', 'Extensions'],
          installed.map((e) => [esc(e.name), esc(e.version ?? '—'), e.extensionCount !== undefined ? String(e.extensionCount) : '—']),
        )
    sections.push(section('Editors / IDEs', content, 'editors'))
  }

  // LLMs
  if (snapshot.llms.data) {
    const l = snapshot.llms.data
    const rows: string[][] = [
      [`${badge(l.ollama.installed)} Ollama`, l.ollama.version ? `v${esc(l.ollama.version)}` : '—'],
    ]
    if (l.ollama.installed && l.ollama.models.length > 0) {
      rows.push(['&nbsp;&nbsp;Models', l.ollama.models.map((m) => `<code>${esc(m.name)}</code>`).join(' ')])
    }
    rows.push([`${badge(l.lmStudio.installed)} LM Studio`, l.lmStudio.installed ? 'installed' : '—'])
    rows.push([`${badge(l.claudeDesktop.installed)} Claude Desktop`, l.claudeDesktop.installed ? 'installed' : '—'])
    rows.push([`${badge(l.copilot.installed)} GitHub Copilot`, l.copilot.installed ? 'extension installed' : '—'])
    sections.push(section('LLMs / AI Tools', table(['Tool', 'Version / Status'], rows), 'llms'))
  }

  // CLI Tools
  if (snapshot.cliTools.data) {
    const installed = snapshot.cliTools.data.tools.filter((t) => t.installed)
    const notInstalled = snapshot.cliTools.data.tools.filter((t) => !t.installed)
    let content = table(
      ['Tool', 'Version', 'Note'],
      installed.map((t) => [`<span class="installed">${esc(t.name)}</span>`, esc(t.version ?? '—'), noteHtml(annotations, `cli:${t.name}`)]),
    )
    if (notInstalled.length > 0) {
      content += `<p class="dim">Not installed: ${notInstalled.map((t) => esc(t.name)).join(', ')}</p>`
    }
    sections.push(section('CLI Tools', content, 'cli-tools'))
  }

  // Stale Tools (always present so summary link #stale resolves)
  const stale = detectStaleTools(snapshot)
  const staleContent =
    stale.length > 0
      ? table(
          ['Tool', 'Category', 'Installed', 'Age'],
          stale.map((s) => [esc(s.name), esc(s.category), esc(s.installedOn), `<span class="warn-text">${s.daysAgo}d</span>`]),
        )
      : '<p class="dim">No tools older than 180 days</p>'
  const staleTitle = stale.length > 0 ? '⚠ Stale Tools (>180 days)' : 'Stale Tools'
  sections.push(section(staleTitle, staleContent, 'stale'))

  const CSS = `
    :root { --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a; --text: #e2e4ea; --dim: #6b7280; --accent: #60a5fa; --green: #4ade80; --red: #f87171; }
    @media (prefers-color-scheme: light) {
      :root { --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0; --text: #1e293b; --dim: #64748b; --accent: #2563eb; --green: #16a34a; --red: #dc2626; }
    }
    html { scroll-behavior: smooth; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    header h1 { font-size: 1.8rem; color: var(--accent); }
    header .meta { color: var(--dim); font-size: 0.85rem; }
    details { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; background: var(--surface); overflow: hidden; scroll-margin-top: 0.75rem; }
    summary { cursor: pointer; padding: 0.75rem 1rem; list-style: none; display: flex; align-items: center; gap: 0.5rem; user-select: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: '▶'; flex-shrink: 0; margin-right: 0.1rem; font-size: 0.7rem; color: var(--dim); transition: transform 0.2s; }
    details[open] > summary::before { transform: rotate(90deg); }
    summary h2 { flex: 1; font-size: 1rem; font-weight: 600; color: var(--text); }
    .to-top { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 6px; font-size: 1.1rem; line-height: 1; text-decoration: none; color: var(--dim); border: 1px solid transparent; transition: color 0.15s, border-color 0.15s, background 0.15s; }
    .to-top:hover { color: var(--accent); border-color: var(--border); background: rgba(96,165,250,0.08); }
    .to-top:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .section-body { padding: 0 1rem 1rem; }
    h3 { margin: 1rem 0 0.5rem; font-size: 0.9rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0.75rem; }
    th { text-align: left; padding: 0.4rem 0.75rem; color: var(--dim); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--border); }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.03); }
    code { background: var(--border); border-radius: 3px; padding: 0.1em 0.35em; font-size: 0.85em; font-family: 'SF Mono', 'Fira Code', monospace; }
    .badge { border-radius: 4px; padding: 0.1em 0.5em; font-size: 0.75rem; font-weight: 600; }
    .badge.ok { background: rgba(74,222,128,0.15); color: var(--green); }
    .badge.no { background: rgba(248,113,113,0.1); color: var(--dim); }
    .installed { color: var(--green); font-weight: 500; }
    .dim { color: var(--dim); }
    .note { font-size: 0.8rem; color: var(--dim); font-style: italic; }
    p { margin: 0.5rem 0; }
    strong { color: var(--text); }
    .warn-text { color: #f59e0b; font-weight: 600; }
    .summary-stats { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1rem 0 2rem; scroll-margin-top: 0.75rem; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1.25rem; display: flex; flex-direction: column; align-items: center; min-width: 90px; }
    a.stat-link { text-decoration: none; color: inherit; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s; }
    a.stat-link:hover { border-color: var(--accent); box-shadow: 0 2px 12px rgba(37,99,235,0.12); transform: translateY(-1px); }
    a.stat-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .stat.warn { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
    .stat-value { font-size: 1.6rem; font-weight: 700; color: var(--accent); line-height: 1; }
    .stat.warn .stat-value { color: #f59e0b; }
    .stat-label { font-size: 0.7rem; color: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 2rem; }
    .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem 1.25rem; }
    .chart-card.wide { grid-column: span 1; }
    @media (max-width: 768px) { .charts-grid { grid-template-columns: 1fr; } .chart-card.wide { grid-column: span 1; } }
    .chart-title { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--dim); margin-bottom: 0.75rem; font-weight: 600; }
    .chart-hbar { width: 100%; height: auto; overflow: visible; }
    .bar-lbl { font-size: 11px; fill: var(--dim); font-family: -apple-system, sans-serif; }
    .bar-val { font-size: 11px; fill: var(--text); font-family: -apple-system, sans-serif; font-weight: 600; }
    .chart-donut { width: 100px; height: 100px; flex-shrink: 0; }
    .donut-wrap { display: flex; align-items: center; gap: 1rem; }
    .donut-legend { display: flex; flex-direction: column; gap: 0.35rem; }
    .leg-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; }
    .leg-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .leg-label { color: var(--dim); flex: 1; }
    .leg-val { font-weight: 600; color: var(--text); }
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devsnap — ${esc(ts)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="container">
    <header id="devsnap-top">
      <h1>devsnap</h1>
      <div class="meta">${esc(ts)} &nbsp;·&nbsp; <code>${esc(snapshot.id)}</code></div>
    </header>
    ${buildSummaryStats(snapshot)}
    ${buildCharts(snapshot)}
    ${sections.join('\n    ')}
  </div>
</body>
</html>`
}
