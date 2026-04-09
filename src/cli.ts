#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import { runScan } from './commands/scan.js'
import { runDiff } from './commands/diff.js'
import { runAnnotate } from './commands/annotate.js'
import { runList } from './commands/list.js'
import { runOpen } from './commands/open.js'
import { runExport } from './commands/export.js'
import { runClean } from './commands/clean.js'
import { runSearch } from './commands/search.js'
import { runSchedule, parseScheduleInterval } from './commands/schedule.js'
import { runShare } from './commands/share.js'
import { runConfigCommand } from './store/config.js'
import { runAudit } from './commands/audit.js'
import {
  runCloudAuth,
  runCloudLogout,
  runCloudStatus,
  runCloudPush,
  runCloudList,
  runCloudOpen,
  runCloudRegister,
} from './commands/cloud.js'

const program = new Command()

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')
const pkgVersion = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }

program
  .name('devsnap')
  .description(
    'Local-first macOS dev environment scanner (scan, annotate, diff). Optional cloud sync + dashboard.',
  )
  .version(pkgVersion.version)

// devsnap scan
program
  .command('scan')
  .description('Scan your dev environment and save a snapshot')
  .option('--html', 'Generate and open an HTML report')
  .option('--md', 'Generate a Markdown report')
  .option('--json', 'Output raw JSON to stdout')
  .option('--no-save', 'Print only, do not save snapshot')
  .action(async (opts: { html: boolean; md: boolean; save: boolean; json: boolean }) => {
    await runScan({ html: opts.html, md: opts.md, save: opts.save, json: opts.json })
  })

// devsnap diff [id1] [id2]
program
  .command('diff [id1] [id2]')
  .description('Compare two snapshots (defaults to last two)')
  .action(async (id1?: string, id2?: string) => {
    await runDiff(id1, id2)
  })

// devsnap annotate <key> [note]
program
  .command('annotate [key] [note]')
  .description('Add or view annotations for tools (interactive if note omitted)')
  .option('--list', 'List all annotations')
  .option('--show', 'Show annotation for a specific key')
  .option('--remove', 'Remove annotation for a specific key')
  .action(async (key: string | undefined, note: string | undefined, opts: { list?: boolean; show?: boolean; remove?: boolean }) => {
    if (!key && !opts.list) {
      console.error('Usage: devsnap annotate <key> ["<note>"]')
      console.error('       devsnap annotate --list')
      process.exit(1)
    }
    await runAnnotate(key ?? '', note, opts)
  })

// devsnap list
program
  .command('list')
  .description('List all saved snapshots')
  .action(async () => {
    await runList()
  })

// devsnap open
program
  .command('open')
  .description('Open the latest HTML report in your browser')
  .action(async () => {
    await runOpen()
  })

// devsnap export <format> [output]
program
  .command('export <format> [output]')
  .description('Export snapshot data (formats: brewfile, bootstrap)')
  .action(async (format: string, output?: string) => {
    await runExport(format, output)
  })

// devsnap clean
program
  .command('clean')
  .description('Remove old snapshots, keeping the most recent N')
  .option('-k, --keep <n>', 'Number of snapshots to keep', '5')
  .action(async (opts: { keep: string }) => {
    const keep = parseInt(opts.keep, 10)
    if (!Number.isInteger(keep) || keep < 1) {
      console.error('Invalid --keep: use a positive integer (default: 5).')
      process.exit(1)
    }
    await runClean(keep)
  })

// devsnap search <query>
program
  .command('search <query>')
  .description('Search across the latest snapshot')
  .option('-s, --snapshot <id>', 'Search a specific snapshot by ID')
  .action(async (query: string, opts: { snapshot?: string }) => {
    await runSearch(query, opts.snapshot)
  })

// devsnap schedule <install|uninstall|status>
program
  .command('schedule <action>')
  .description('Manage automatic scans via launchd (actions: install, uninstall, status)')
  .option(
    '-i, --interval <preset>',
    'Scan interval: 1h, 8h, 24h (default), 7d, 1m',
    '24h',
  )
  .action(async (action: string, opts: { interval: string }) => {
    if (!['install', 'uninstall', 'status'].includes(action)) {
      console.error('Usage: devsnap schedule <install|uninstall|status>')
      process.exit(1)
    }
    const preset = parseScheduleInterval(opts.interval)
    if (!preset) {
      console.error('Invalid --interval: use one of: 1h, 8h, 24h, 7d, 1m (default: 24h).')
      process.exit(1)
    }
    await runSchedule(action as 'install' | 'uninstall' | 'status', preset)
  })

// devsnap share <clipboard|gist>
program
  .command('share <target>')
  .description('Share the latest snapshot (targets: clipboard, gist)')
  .option('-f, --format <fmt>', 'Output format: md or html (default: md)', 'md')
  .action(async (target: string, opts: { format: string }) => {
    if (!['clipboard', 'gist'].includes(target)) {
      console.error('Usage: devsnap share <clipboard|gist> [--format md|html]')
      process.exit(1)
    }
    await runShare(target as 'clipboard' | 'gist', opts.format as 'md' | 'html')
  })

// devsnap audit
program
  .command('audit')
  .description('Run a security audit of your macOS system')
  .option('--html', 'Generate and open an HTML security report')
  .action(async (opts: { html: boolean }) => {
    await runAudit({ html: opts.html })
  })

// devsnap config <show|set> [key] [value]
program
  .command('config <action> [key] [value]')
  .description('View or update devsnap configuration (actions: show, set)')
  .action(async (action: string, key?: string, value?: string) => {
    if (!['show', 'set'].includes(action)) {
      console.error('Usage: devsnap config show | devsnap config set <key> <value>')
      process.exit(1)
    }
    await runConfigCommand(action as 'show' | 'set', key, value)
  })

// devsnap cloud …
const cloud = program.command('cloud').description('Optional sync to your own HTTP API (no server in this repo)')

cloud
  .command('register')
  .description('Create an API key on the server (no local scan required)')
  .option('--url <url>', 'API base URL (default: DEVSNAP_CLOUD_API or http://localhost:3001)')
  .option('--email <email>', 'Optional email for your account record')
  .action(async (opts: { url?: string; email?: string }) => {
    await runCloudRegister({ url: opts.url, email: opts.email })
  })

cloud
  .command('auth')
  .description('Save API key and API base URL for cloud commands')
  .requiredOption('--key <key>', 'API key from register or admin')
  .option('--url <url>', 'API base URL (default: DEVSNAP_CLOUD_API or http://localhost:3001)')
  .option('--dashboard <url>', 'Dashboard URL for `devsnap cloud open`')
  .action(async (opts: { key: string; url?: string; dashboard?: string }) => {
    await runCloudAuth({ key: opts.key, url: opts.url, dashboard: opts.dashboard })
  })

cloud
  .command('logout')
  .description('Remove saved cloud credentials')
  .action(async () => {
    await runCloudLogout()
  })

cloud
  .command('status')
  .description('Show whether cloud credentials are configured')
  .action(async () => {
    await runCloudStatus()
  })

cloud
  .command('push')
  .description('Upload a local snapshot JSON to the cloud (latest by default)')
  .option('-i, --id <id>', 'Local snapshot id (from devsnap list)')
  .option('-t, --tag <tag>', 'Optional tag label')
  .option('-n, --note <note>', 'Optional note')
  .option('--redacted', 'Redact filesystem paths in cliTools before upload')
  .action(async (opts: { id?: string; tag?: string; note?: string; redacted?: boolean }) => {
    await runCloudPush({
      id: opts.id,
      tag: opts.tag,
      note: opts.note,
      redacted: Boolean(opts.redacted),
    })
  })

cloud
  .command('list')
  .description('List snapshots stored in the cloud')
  .option('-l, --limit <n>', 'Max rows', '50')
  .action(async (opts: { limit: string }) => {
    const n = parseInt(opts.limit, 10)
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      console.error('Invalid --limit (1–500).')
      process.exit(1)
    }
    await runCloudList(n)
  })

cloud
  .command('open')
  .description('Open the saved dashboard URL in a browser')
  .action(async () => {
    await runCloudOpen()
  })

program.parse()
