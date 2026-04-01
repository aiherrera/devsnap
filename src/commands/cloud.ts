import chalk from 'chalk'
import openBrowser from 'open'
import { loadSnapshot, listSnapshots } from '../store/snapshots.js'
import type { Snapshot } from '../types.js'
import {
  loadCloudCredentials,
  saveCloudCredentials,
  clearCloudCredentials,
  DEFAULT_CLOUD_API_BASE,
} from '../store/cloud-credentials.js'
import { redactSnapshotPaths } from '../util/redact-snapshot.js'

function resolveApiBase(override?: string): string {
  const env = process.env.DEVSNAP_CLOUD_API?.trim()
  if (override?.trim()) return override.trim().replace(/\/$/, '')
  if (env) return env.replace(/\/$/, '')
  return DEFAULT_CLOUD_API_BASE
}

async function requireCreds(): Promise<{ apiKey: string; apiBaseUrl: string; dashboardUrl?: string }> {
  const c = await loadCloudCredentials()
  if (!c?.apiKey) {
    console.error(chalk.red('Not authenticated. Run: ') + chalk.cyan('devsnap cloud auth --key <API_KEY> [--url <api_base>]'))
    process.exit(1)
  }
  return { ...c, apiBaseUrl: resolveApiBase(c.apiBaseUrl) }
}

async function apiFetch(
  creds: { apiKey: string; apiBaseUrl: string },
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${creds.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${creds.apiKey}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers })
}

export async function runCloudAuth(opts: { key: string; url?: string; dashboard?: string }): Promise<void> {
  const apiBaseUrl = resolveApiBase(opts.url)
  const dashboardUrl = opts.dashboard?.trim().replace(/\/$/, '')
  await saveCloudCredentials({
    apiKey: opts.key.trim(),
    apiBaseUrl,
    dashboardUrl: dashboardUrl || undefined,
  })
  console.log(chalk.green('Saved API key to ') + chalk.dim('~/.devsnap/cloud.json') + chalk.green(' (mode 600).'))
  console.log(chalk.dim(`  API base: ${apiBaseUrl}`))
  if (dashboardUrl) console.log(chalk.dim(`  Dashboard: ${dashboardUrl}`))
}

export async function runCloudLogout(): Promise<void> {
  await clearCloudCredentials()
  console.log(chalk.green('Cloud credentials removed.'))
}

export async function runCloudStatus(): Promise<void> {
  const c = await loadCloudCredentials()
  console.log('\n' + chalk.bold('devsnap cloud'))
  if (!c?.apiKey) {
    console.log(chalk.dim('  Status: ') + chalk.yellow('not configured'))
    console.log(chalk.dim('  Run ') + chalk.cyan('devsnap cloud auth --key <KEY>') + chalk.dim(' to enable sync.\n'))
    return
  }
  console.log(chalk.dim('  Status: ') + chalk.green('authenticated'))
  console.log(chalk.dim('  API base: ') + resolveApiBase(c.apiBaseUrl))
  if (c.dashboardUrl) console.log(chalk.dim('  Dashboard: ') + c.dashboardUrl)
  console.log(chalk.dim('  Key file: ~/.devsnap/cloud.json\n'))
}

export async function runCloudPush(opts: { id?: string; tag?: string; note?: string; redacted: boolean }): Promise<void> {
  const creds = await requireCreds()
  let snapshot: Snapshot
  if (opts.id) {
    snapshot = await loadSnapshot(opts.id)
  } else {
    const metas = await listSnapshots()
    if (metas.length === 0) {
      console.error('No local snapshots. Run `devsnap scan` first.')
      process.exit(1)
    }
    snapshot = await loadSnapshot(metas[metas.length - 1].id)
  }
  const bodyPayload = opts.redacted ? redactSnapshotPaths(snapshot) : snapshot
  const res = await apiFetch(creds, '/api/snapshots', {
    method: 'POST',
    body: JSON.stringify({
      payload: bodyPayload,
      tag: opts.tag ?? null,
      note: opts.note ?? null,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(chalk.red(`Upload failed (${res.status}): ${text || res.statusText}`))
    process.exit(1)
  }
  const data = (await res.json()) as { id: string; localId: string }
  console.log(chalk.green('Snapshot uploaded.'))
  console.log(chalk.dim(`  Cloud id: ${data.id}`))
  console.log(chalk.dim(`  Local id: ${data.localId}`))
  if (opts.redacted) console.log(chalk.dim('  Paths in cliTools were redacted.'))
}

export async function runCloudList(limit: number): Promise<void> {
  const creds = await requireCreds()
  const res = await apiFetch(creds, `/api/snapshots?limit=${encodeURIComponent(String(limit))}`)
  if (!res.ok) {
    console.error(chalk.red(`List failed (${res.status}): ${await res.text()}`))
    process.exit(1)
  }
  const rows = (await res.json()) as Array<{
    id: string
    localId: string
    createdAt: string
    tag: string | null
    note: string | null
  }>
  if (rows.length === 0) {
    console.log(chalk.dim('No cloud snapshots yet. Run `devsnap cloud push`.'))
    return
  }
  console.log('\n' + chalk.bold('Cloud snapshots'))
  for (const r of rows) {
    const label = r.tag ? chalk.cyan(` [${r.tag}]`) : ''
    const note = r.note ? chalk.dim(` — ${r.note}`) : ''
    console.log(`  ${chalk.green(r.id)}${label}${note}`)
    console.log(chalk.dim(`    local: ${r.localId} · ${r.createdAt}`))
  }
  console.log()
}

export async function runCloudOpen(): Promise<void> {
  const c = await loadCloudCredentials()
  const url = c?.dashboardUrl?.trim()
  if (!url) {
    console.error(
      chalk.red('No dashboard URL saved. Run: ') +
        chalk.cyan('devsnap cloud auth --key <KEY> --dashboard https://your-dashboard'),
    )
    process.exit(1)
  }
  await openBrowser(url)
  console.log(chalk.dim(`Opening ${url}`))
}

export async function runCloudRegister(opts: { url?: string; email?: string }): Promise<void> {
  const apiBase = resolveApiBase(opts.url)
  const res = await fetch(`${apiBase}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: opts.email ?? null }),
  })
  if (!res.ok) {
    console.error(chalk.red(`Register failed (${res.status}): ${await res.text()}`))
    process.exit(1)
  }
  const data = (await res.json()) as { apiKey: string }
  if (!data.apiKey) {
    console.error(chalk.red('Invalid response from server.'))
    process.exit(1)
  }
  await saveCloudCredentials({
    apiKey: data.apiKey,
    apiBaseUrl: apiBase,
  })
  console.log(chalk.green('Account created. API key saved to ~/.devsnap/cloud.json'))
  console.log(chalk.yellow('Store this key safely; it is not shown again on the server.'))
  console.log(chalk.dim(`  API base: ${apiBase}`))
}
