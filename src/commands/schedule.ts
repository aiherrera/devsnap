import chalk from 'chalk'
import { writeFile, readFile, mkdir, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'

const LABEL = 'com.devsnap.auto-scan'
const PLIST_PATH = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)

/** Seconds for `StartInterval` presets and legacy plist status matching. */
export const SCHEDULE_INTERVAL_SECONDS = {
  '1h': 3600,
  '8h': 8 * 3600,
  '24h': 24 * 3600,
  '1w': 7 * 24 * 3600,
  '1m': 30 * 24 * 3600,
} as const

export type ScheduleIntervalPreset = keyof typeof SCHEDULE_INTERVAL_SECONDS

const PRESET_ORDER: ScheduleIntervalPreset[] = ['1h', '8h', '24h', '1w', '1m']

export function parseScheduleInterval(raw: string): ScheduleIntervalPreset | null {
  const key = raw.trim().toLowerCase() as ScheduleIntervalPreset
  return PRESET_ORDER.includes(key) ? key : null
}

export type ScheduleTime = { hour: number; minute: number }

export function parseScheduleTime(raw: string): ScheduleTime | null {
  const s = raw.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return null
  const hour = parseInt(m[1], 10)
  const minute = parseInt(m[2], 10)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return { hour, minute }
}

/** Default local time for calendar-based presets (`24h`, `1w`, `1m`). */
export const DEFAULT_SCHEDULE_TIME: ScheduleTime = { hour: 8, minute: 0 }

/** Apple launchd: Weekday 0 and 7 = Sunday, 1 = Monday, … 6 = Saturday */
const WEEKDAY_MONDAY = 1

export function usesStartInterval(preset: ScheduleIntervalPreset): boolean {
  return preset === '1h' || preset === '8h'
}

export function formatScheduleTime(t: ScheduleTime): string {
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
}

function escapePlistString(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build inner `<dict>` body for `StartCalendarInterval` (launchd local time). */
export function buildCalendarIntervalDictXml(
  hour: number,
  minute: number,
  opts?: { weekday?: number; day?: number },
): string {
  const lines: string[] = []
  if (opts?.weekday !== undefined) {
    lines.push(`  <key>Weekday</key>`)
    lines.push(`  <integer>${opts.weekday}</integer>`)
  }
  if (opts?.day !== undefined) {
    lines.push(`  <key>Day</key>`)
    lines.push(`  <integer>${opts.day}</integer>`)
  }
  lines.push(`  <key>Hour</key>`)
  lines.push(`  <integer>${hour}</integer>`)
  lines.push(`  <key>Minute</key>`)
  lines.push(`  <integer>${minute}</integer>`)
  return `<key>StartCalendarInterval</key>
<dict>
${lines.join('\n')}
</dict>`
}

function buildIntervalPlist(
  intervalSecs: number,
  programArguments: string[],
  stdOut: string,
  stdErr: string,
): string {
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
  <integer>${intervalSecs}</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${escapePlistString(stdOut)}</string>
  <key>StandardErrorPath</key>
  <string>${escapePlistString(stdErr)}</string>
</dict>
</plist>`
}

function buildCalendarPlist(
  preset: ScheduleIntervalPreset,
  time: ScheduleTime,
  programArguments: string[],
  stdOut: string,
  stdErr: string,
): string {
  const argsXml = programArguments.map((a) => `    <string>${escapePlistString(a)}</string>`).join('\n')
  let calendarXml: string
  if (preset === '24h') {
    calendarXml = buildCalendarIntervalDictXml(time.hour, time.minute)
  } else if (preset === '1w') {
    calendarXml = buildCalendarIntervalDictXml(time.hour, time.minute, { weekday: WEEKDAY_MONDAY })
  } else if (preset === '1m') {
    calendarXml = buildCalendarIntervalDictXml(time.hour, time.minute, { day: 1 })
  } else {
    throw new Error(`buildCalendarPlist: calendar preset expected, got ${preset}`)
  }
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
${calendarXml}
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
    return [String(r.stdout).trim(), 'scan']
  } catch {
    const r = await execa('which', ['npx'], withCmdTimeout())
    return [String(r.stdout).trim(), 'devsnap', 'scan']
  }
}

function describeIntervalSeconds(secs: number): string {
  const preset = PRESET_ORDER.find((p) => SCHEDULE_INTERVAL_SECONDS[p] === secs)
  if (preset) {
    const labels: Record<ScheduleIntervalPreset, string> = {
      '1h': '1 hour',
      '8h': '8 hours',
      '24h': '24 hours',
      '1w': '7 days',
      '1m': '30 days (~1 month)',
    }
    return `${preset} (${labels[preset]})`
  }
  if (secs % 86400 === 0) return `${secs / 86400} day(s)`
  if (secs % 3600 === 0) return `${secs / 3600} hour(s)`
  return `${secs} second(s)`
}

/** Parse `StartCalendarInterval` dict from a launchd plist (first occurrence). */
export function parseCalendarIntervalFromPlist(xml: string): {
  hour: number
  minute: number
  weekday?: number
  day?: number
} | null {
  const idx = xml.indexOf('<key>StartCalendarInterval</key>')
  if (idx === -1) return null
  const after = xml.slice(idx + '<key>StartCalendarInterval</key>'.length)
  const dictStart = after.indexOf('<dict>')
  if (dictStart === -1) return null
  const inner = after.slice(dictStart + '<dict>'.length)
  const dictEnd = inner.indexOf('</dict>')
  if (dictEnd === -1) return null
  const block = inner.slice(0, dictEnd)
  const hourM = /<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/.exec(block)
  const minuteM = /<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/.exec(block)
  const weekdayM = /<key>Weekday<\/key>\s*<integer>(\d+)<\/integer>/.exec(block)
  const dayM = /<key>Day<\/key>\s*<integer>(\d+)<\/integer>/.exec(block)
  if (!hourM || !minuteM) return null
  const out: { hour: number; minute: number; weekday?: number; day?: number } = {
    hour: parseInt(hourM[1], 10),
    minute: parseInt(minuteM[1], 10),
  }
  if (weekdayM) out.weekday = parseInt(weekdayM[1], 10)
  if (dayM) out.day = parseInt(dayM[1], 10)
  return out
}

function weekdayLaunchdToLabel(w: number): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const i = w === 7 ? 0 : w
  return names[i] ?? `weekday ${w}`
}

function describeCalendarSchedule(cal: {
  hour: number
  minute: number
  weekday?: number
  day?: number
}): string {
  const t = formatScheduleTime({ hour: cal.hour, minute: cal.minute })
  if (cal.weekday !== undefined) {
    return `weekly on ${weekdayLaunchdToLabel(cal.weekday)} at ${t} (preset 1w)`
  }
  if (cal.day !== undefined) {
    return `monthly on day ${cal.day} at ${t} (preset 1m)`
  }
  return `daily at ${t} (preset 24h)`
}

export async function runSchedule(
  action: 'install' | 'uninstall' | 'status',
  intervalPreset?: ScheduleIntervalPreset,
  time?: ScheduleTime,
): Promise<void> {
  const logOut = join(homedir(), '.devsnap', 'schedule.log')
  const logErr = join(homedir(), '.devsnap', 'schedule.err')

  if (action === 'status') {
    if (!existsSync(PLIST_PATH)) {
      console.log(chalk.dim('No schedule installed. Run `devsnap schedule install` to set one up.'))
      return
    }
    const raw = await readFile(PLIST_PATH, 'utf8')
    const cal = parseCalendarIntervalFromPlist(raw)
    console.log(`\n  Schedule: ${chalk.green('active')}`)
    if (cal) {
      console.log(`  When: ${chalk.bold(describeCalendarSchedule(cal))}`)
      console.log(chalk.dim('  (local time; uses StartCalendarInterval)'))
    } else {
      const match = raw.match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/)
      const secs = match ? parseInt(match[1], 10) : 0
      console.log(`  Interval: every ${chalk.bold(describeIntervalSeconds(secs))} (${secs}s)`)
      console.log(chalk.dim('  (StartInterval — not pinned to a clock time; use 24h/1w/1m for --time)'))
    }
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
  const scheduleTime = time ?? DEFAULT_SCHEDULE_TIME
  const programArguments = await resolveProgramArguments()

  await mkdir(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
  await mkdir(join(homedir(), '.devsnap'), { recursive: true, mode: 0o700 })
  await chmod(join(homedir(), '.devsnap'), 0o700).catch(() => {})

  const plist = usesStartInterval(preset)
    ? buildIntervalPlist(SCHEDULE_INTERVAL_SECONDS[preset], programArguments, logOut, logErr)
    : buildCalendarPlist(preset, scheduleTime, programArguments, logOut, logErr)

  await writeFile(PLIST_PATH, plist, 'utf8')

  await execa('launchctl', ['unload', PLIST_PATH], withCmdTimeout()).catch(() => null)
  await execa('launchctl', ['load', PLIST_PATH], withCmdTimeout())

  console.log(chalk.green('Schedule installed.'))
  if (usesStartInterval(preset)) {
    console.log(`  Runs every ${chalk.bold(describeIntervalSeconds(SCHEDULE_INTERVAL_SECONDS[preset]))} via launchd`)
    console.log(chalk.dim('  Note: --time is not used for 1h/8h (StartInterval only).'))
  } else {
    const label =
      preset === '24h'
        ? `Daily at ${formatScheduleTime(scheduleTime)} local time`
        : preset === '1w'
          ? `Every Monday at ${formatScheduleTime(scheduleTime)} local time`
          : `Day 1 of each month at ${formatScheduleTime(scheduleTime)} local time`
    console.log(`  ${chalk.bold(label)}`)
    const dim =
      preset === '24h'
        ? '(StartCalendarInterval; local timezone)'
        : preset === '1w'
          ? '(StartCalendarInterval; Monday; local timezone)'
          : '(StartCalendarInterval; 1st of month; local timezone)'
    console.log(chalk.dim(`  ${dim}`))
  }
  console.log(`  Plist: ${chalk.dim(PLIST_PATH)}`)
  console.log(chalk.dim('\n  To remove: devsnap schedule uninstall\n'))
}
