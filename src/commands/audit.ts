import ora from 'ora'
import chalk from 'chalk'
import Table from 'cli-table3'
import { scanSecurity } from '../scanners/security.js'
import { saveReport } from '../store/snapshots.js'
import openBrowser from 'open'
import { loadConfig } from '../store/config.js'
import type { SecurityInfo, SecurityCheck, SecurityStatus } from '../types.js'

function statusIcon(status: SecurityStatus): string {
  switch (status) {
    case 'pass': return chalk.green('✓ pass')
    case 'warn': return chalk.yellow('⚠ warn')
    case 'fail': return chalk.red('✗ fail')
    default: return chalk.dim('? unknown')
  }
}

function printSecurityReport(data: SecurityInfo): void {
  console.log('\n' + chalk.bold.white('Security Audit') + chalk.dim(' — devsnap\n'))

  const checks: SecurityCheck[] = [
    data.filevault,
    data.firewall,
    data.sip,
    data.gatekeeper,
    data.automaticUpdates,
    data.remoteLogin,
    data.screenLock,
  ]

  const t = new Table({
    head: ['Check', 'Status', 'Detail'].map((h) => chalk.dim(h)),
    style: { border: [], head: [] },
    colWidths: [32, 12, 60],
    wordWrap: true,
  })

  for (const check of checks) {
    t.push([chalk.bold(check.name), statusIcon(check.status), chalk.dim(check.detail)])
  }
  console.log(t.toString())

  const passes = checks.filter((c) => c.status === 'pass').length
  const warns = checks.filter((c) => c.status === 'warn').length
  const fails = checks.filter((c) => c.status === 'fail').length
  const unknowns = checks.filter((c) => c.status === 'unknown').length

  console.log(
    `\n  Score: ${chalk.green(`${passes} pass`)}  ${chalk.yellow(`${warns} warn`)}  ${chalk.red(`${fails} fail`)}  ${chalk.dim(`${unknowns} unknown`)}\n`,
  )

  if (data.brewOutdated.length > 0) {
    console.log(chalk.bold.cyan('  Outdated Homebrew Packages') + chalk.dim(` (${data.brewOutdated.length})`))
    console.log(chalk.dim('  ─────────────────────────────────────'))
    const bt = new Table({
      head: ['Package', 'Installed', 'Latest'].map((h) => chalk.dim(h)),
      style: { border: [], head: [] },
    })
    data.brewOutdated.forEach((p) => bt.push([p.name, chalk.yellow(p.installedVersion), chalk.green(p.currentVersion)]))
    console.log(bt.toString())
  }

  if (data.openPorts.length > 0) {
    console.log(chalk.bold.cyan('  Open Listening Ports') + chalk.dim(` (${data.openPorts.length})`))
    console.log(chalk.dim('  ─────────────────────────────────────'))
    const pt = new Table({
      head: ['Port', 'Process', 'PID'].map((h) => chalk.dim(h)),
      style: { border: [], head: [] },
    })
    data.openPorts.forEach((p) => pt.push([chalk.cyan(p.port), p.process, chalk.dim(p.pid)]))
    console.log(pt.toString())
  }

  console.log()
}

function generateAuditHTML(data: SecurityInfo): string {
  const ts = new Date().toLocaleString()

  function esc(s: string | null | undefined): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  const checks = [data.filevault, data.firewall, data.sip, data.gatekeeper, data.automaticUpdates, data.remoteLogin, data.screenLock]
  const passes = checks.filter((c) => c.status === 'pass').length
  const warns = checks.filter((c) => c.status === 'warn').length
  const fails = checks.filter((c) => c.status === 'fail').length

  function statusBadge(s: SecurityStatus): string {
    const cls = s === 'pass' ? 'pass' : s === 'warn' ? 'warn' : s === 'fail' ? 'fail' : 'unknown'
    const icon = s === 'pass' ? '✓' : s === 'warn' ? '⚠' : s === 'fail' ? '✗' : '?'
    return `<span class="badge ${cls}">${icon} ${esc(s)}</span>`
  }

  const checksRows = checks
    .map((c) => `<tr><td class="check-name">${esc(c.name)}</td><td>${statusBadge(c.status)}</td><td class="dim">${esc(c.detail)}</td></tr>`)
    .join('')

  const outdatedRows =
    data.brewOutdated.length === 0
      ? '<tr><td colspan="3" class="dim">All Homebrew packages are up to date</td></tr>'
      : data.brewOutdated
          .map((p) => `<tr><td>${esc(p.name)}</td><td class="warn-text">${esc(p.installedVersion)}</td><td class="pass-text">${esc(p.currentVersion)}</td></tr>`)
          .join('')

  const portsRows =
    data.openPorts.length === 0
      ? '<tr><td colspan="3" class="dim">No open TCP listening ports detected</td></tr>'
      : data.openPorts
          .map((p) => `<tr><td class="port-num">${esc(p.port)}</td><td>${esc(p.process)}</td><td class="dim">${esc(p.pid)}</td></tr>`)
          .join('')

  // SVG score ring
  const total = checks.length
  const scorePercent = Math.round((passes / total) * 100)
  const radius = 54
  const circ = 2 * Math.PI * radius
  const passArc = (passes / total) * circ
  const warnArc = (warns / total) * circ
  const failArc = (fails / total) * circ
  const unknownArc = circ - passArc - warnArc - failArc

  let offset = 0
  function arc(length: number, color: string): string {
    if (length <= 0) return ''
    const seg = `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="${color}" stroke-width="12" stroke-dasharray="${length} ${circ - length}" stroke-dashoffset="${-(offset)}" stroke-linecap="round"/>`
    offset += length
    return seg
  }

  const scoreRing = `
  <svg viewBox="0 0 120 120" class="score-ring" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--border)" stroke-width="12"/>
    ${arc(passArc, '#4ade80')}
    ${arc(warnArc, '#f59e0b')}
    ${arc(failArc, '#f87171')}
    ${arc(unknownArc, '#374151')}
    <text x="60" y="56" text-anchor="middle" class="ring-pct">${scorePercent}%</text>
    <text x="60" y="72" text-anchor="middle" class="ring-label">secure</text>
  </svg>`

  const CSS = `
    :root { --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a; --text: #e2e4ea; --dim: #6b7280; --accent: #60a5fa; --green: #4ade80; --red: #f87171; --yellow: #f59e0b; }
    @media (prefers-color-scheme: light) {
      :root { --bg: #f8fafc; --surface: #fff; --border: #e2e8f0; --text: #1e293b; --dim: #64748b; --accent: #2563eb; --green: #16a34a; --red: #dc2626; --yellow: #d97706; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; }
    .container { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
    header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    header h1 { font-size: 1.8rem; color: var(--accent); }
    .meta { color: var(--dim); font-size: 0.85rem; }
    .overview { display: flex; align-items: center; gap: 2rem; margin: 1.5rem 0 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem 2rem; }
    .score-ring { width: 120px; height: 120px; flex-shrink: 0; transform: rotate(-90deg); }
    .ring-pct { font-size: 22px; font-weight: 700; fill: var(--text); transform: rotate(90deg); transform-box: fill-box; transform-origin: center; }
    .ring-label { font-size: 10px; fill: var(--dim); text-transform: uppercase; letter-spacing: 0.05em; transform: rotate(90deg); transform-box: fill-box; transform-origin: center; }
    .score-legend { display: flex; flex-direction: column; gap: 0.4rem; }
    .score-legend .leg { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.pass { background: #4ade80; }
    .dot.warn { background: #f59e0b; }
    .dot.fail { background: #f87171; }
    .dot.unknown { background: #374151; }
    details { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1rem; background: var(--surface); overflow: hidden; }
    summary { cursor: pointer; padding: 0.75rem 1rem; list-style: none; display: flex; align-items: center; user-select: none; }
    summary::-webkit-details-marker { display: none; }
    summary::before { content: '▶'; margin-right: 0.6rem; font-size: 0.7rem; color: var(--dim); transition: transform 0.2s; }
    details[open] > summary::before { transform: rotate(90deg); }
    summary h2 { font-size: 1rem; font-weight: 600; }
    .section-body { padding: 0 1rem 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; }
    th { text-align: left; padding: 0.4rem 0.75rem; color: var(--dim); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
    td { padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .check-name { font-weight: 500; min-width: 220px; }
    .badge { border-radius: 4px; padding: 0.15em 0.55em; font-size: 0.75rem; font-weight: 600; }
    .badge.pass { background: rgba(74,222,128,0.15); color: var(--green); }
    .badge.warn { background: rgba(245,158,11,0.15); color: var(--yellow); }
    .badge.fail { background: rgba(248,113,113,0.12); color: var(--red); }
    .badge.unknown { background: rgba(107,114,128,0.15); color: var(--dim); }
    .dim { color: var(--dim); }
    .warn-text { color: var(--yellow); }
    .pass-text { color: var(--green); }
    .port-num { font-family: 'SF Mono', 'Fira Code', monospace; font-weight: 600; color: var(--accent); }
    code { background: var(--border); border-radius: 3px; padding: 0.1em 0.35em; font-size: 0.85em; font-family: 'SF Mono', 'Fira Code', monospace; }
  `

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>devsnap — Security Audit — ${esc(ts)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>devsnap — Security Audit</h1>
      <div class="meta">${esc(ts)}</div>
    </header>

    <div class="overview">
      ${scoreRing}
      <div class="score-legend">
        <div class="leg"><span class="dot pass"></span><strong>${passes}</strong>&nbsp;<span class="dim">checks passed</span></div>
        <div class="leg"><span class="dot warn"></span><strong>${warns}</strong>&nbsp;<span class="dim">warnings</span></div>
        <div class="leg"><span class="dot fail"></span><strong>${fails}</strong>&nbsp;<span class="dim">failures</span></div>
        <div class="leg"><span class="dot unknown"></span><strong>${checks.filter((c) => c.status === 'unknown').length}</strong>&nbsp;<span class="dim">unknown</span></div>
      </div>
      <div style="margin-left:auto; text-align:right">
        <div style="font-size:2.5rem;font-weight:700;color:var(--${scorePercent >= 80 ? 'green' : scorePercent >= 50 ? 'yellow' : 'red'})">${scorePercent}%</div>
        <div class="dim" style="font-size:0.8rem">security score</div>
      </div>
    </div>

    <details open>
      <summary><h2>Security Checks</h2></summary>
      <div class="section-body">
        <table>
          <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>${checksRows}</tbody>
        </table>
      </div>
    </details>

    <details open>
      <summary><h2>Outdated Homebrew Packages (${data.brewOutdated.length})</h2></summary>
      <div class="section-body">
        <table>
          <thead><tr><th>Package</th><th>Installed</th><th>Latest</th></tr></thead>
          <tbody>${outdatedRows}</tbody>
        </table>
      </div>
    </details>

    <details open>
      <summary><h2>Open Listening Ports (${data.openPorts.length})</h2></summary>
      <div class="section-body">
        <table>
          <thead><tr><th>Port</th><th>Process</th><th>PID</th></tr></thead>
          <tbody>${portsRows}</tbody>
        </table>
      </div>
    </details>
  </div>
</body>
</html>`
}

export async function runAudit(opts: { html: boolean }): Promise<void> {
  const config = await loadConfig()
  const spinner = ora({ text: 'Running security audit…', color: 'cyan' }).start()

  const result = await scanSecurity()
  spinner.succeed('Audit complete')

  if (result.status === 'error' || !result.data) {
    console.error(chalk.red('Security scan failed:'), result.error)
    process.exit(1)
  }

  printSecurityReport(result.data)

  if (opts.html) {
    const html = generateAuditHTML(result.data)
    const id = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, 'Z') + '-audit'
    try {
      const htmlPath = await saveReport(id, html, 'html')
      console.log(`  HTML report → ${htmlPath}`)
      if (config.autoOpenHtml) {
        await openBrowser(htmlPath)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(chalk.red('Could not save or open HTML report:'), msg)
      process.exit(1)
    }
  }
}
