import chalk from 'chalk'
import { writeFile, readFile, mkdir, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'

const LABEL = 'com.devsnap.auto-scan'
const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)

/** Preset scan intervals for launchd `StartInterval` (seconds). `1m` is 30 days (fixed calendar-style month). */
export const SCHEDULE_INTERVAL_SECONDS = {
  '1h': 3600,
  '8h': 8 * 3600,
  '24h': 24 * 3600,
  '7d': 7 * 24 * 3600,
  '1m': 30 * 24 * 3600,
} as const

export type ScheduleIntervalPreset = keyof typeof SCHEDULE_INTERVAL_SECONDS

const PRESET_ORDER: ScheduleIntervalPreset[] = ['1h', '8h', '24h', '7d', '1m']

export function parseScheduleInterval(raw: string): ScheduleIntervalPreset | null {
  const key = raw.trim().toLowerCase() as ScheduleIntervalPreset
  return PRESET_ORDER.includes(key) ? key : null
}

function describeIntervalSeconds(secs: number): string {
  const preset = PRESET_ORDER.find((p) => SCHEDULE_INTERVAL_SECONDS[p] === secs)
  if (preset) {
    const labels: Record<ScheduleIntervalPreset, string> = {
      '1h': '1 hour',
      '8h': '8 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '1m': '30 days (~1 month)',
    }
    return `${preset} (${labels[preset]})`
  }
  if (secs % 86400 === 0) return `${secs / 86400} day(s)`
  if (secs % 3600 === 0) return `${secs / 3600} hour(s)`
  return `${secs} second(s)`
}

function escapePlistString(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPlist(interval: number, programArguments: string[], stdOut: string, stdErr: string): string {
  const argsXml = programArguments.map((a) => `    <string>${escapePlistString(a)}</string>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
  </array>
  <key>StartInterval</key>
  <integer>${interval}</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${escapePlistString(stdOut)}</string>
  <key>StandardErrorPath</key>
  <string>${escapePlistString(stdErr)}</string>
</dict>
</plist>`
}

async function resolveProgramArguments(): Promise<string[]> {
  try {
    const r = await execa('which', ['devsnap'], withCmdTimeout())
    return [r.stdout.trim(), 'scan']
  } catch {
    const r = await execa('which', ['npx'], withCmdTimeout())
    return [r.stdout.trim(), 'devsnap', 'scan']
  }
}

export async function runSchedule(
  action: 'install' | 'uninstall' | 'status',
  intervalPreset?: ScheduleIntervalPreset,
): Promise<void> {
  const logOut = join(homedir(), '.devsnap', 'schedule.log')
  const logErr = join(homedir(), '.devsnap', 'schedule.err')

  if (action === 'status') {
    if (!existsSync(PLIST_PATH)) {
      console.log(chalk.dim('No schedule installed. Run `devsnap schedule install` to set one up.'))
      return
    }
    const raw = await readFile(PLIST_PATH, 'utf8')
    const match = raw.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/)
    const secs = match ? parseInt(match[1], 10) : 0
    console.log(`\n  Schedule: ${chalk.green('active')}`)
    console.log(`  Interval: every ${chalk.bold(describeIntervalSeconds(secs))} (${secs}s)`)
    console.log(`  Plist: ${chalk.dim(PLIST_PATH)}\n`)
    return
  }

  if (action === 'uninstall') {
    if (!existsSync(PLIST_PATH)) {
      console.log(chalk.dim('No schedule found.'))
      return
    }
    await execa('launchctl', ['unload', PLIST_PATH], withCmdTimeout()).catch(() => null)
    const { unlink } = await import('node:fs/promises')
    await unlink(PLIST_PATH)
    console.log(chalk.green('Schedule removed.'))
    return
  }

  // install
  const preset = intervalPreset ?? '24h'
  const intervalSecs = SCHEDULE_INTERVAL_SECONDS[preset]
  const programArguments = await resolveProgramArguments()

  await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
  await mkdir(join(homedir(), '.devsnap'), { recursive: true, mode: 0o700 })
  await chmod(join(homedir(), '.devsnap'), 0o700).catch(() => {})

  const plist = buildPlist(intervalSecs, programArguments, logOut, logErr)
  await writeFile(PLIST_PATH, plist, 'utf8')

  // Unload if already loaded, then load
  await execa('launchctl', ['unload', PLIST_PATH], withCmdTimeout()).catch(() => null)
  await execa('launchctl', ['load', PLIST_PATH], withCmdTimeout())

  console.log(chalk.green('Schedule installed.'))
  console.log(`  Runs every ${chalk.bold(describeIntervalSeconds(intervalSecs))} via launchd`)
  console.log(`  Plist: ${chalk.dim(PLIST_PATH)}`)
  console.log(chalk.dim('\n  To remove: devsnap schedule uninstall\n'))
}
