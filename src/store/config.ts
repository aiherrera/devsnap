import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEVSNAP_DIR = join(homedir(), '.devsnap')
const CONFIG_PATH = join(DEVSNAP_DIR, 'config.json')

const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export interface DevSnapConfig {
  /** Scanner categories to skip. Values: brew, node, runtimes, docker, databases, browsers, terminals, editors, llms, cliTools, system */
  disabledScanners?: string[]
  /** Additional CLI tool names to probe beyond the built-in list */
  extraCliTools?: string[]
  /** Days before a tool is considered stale (default: 180) */
  staleDays?: number
  /** Default number of snapshots to keep when running `devsnap clean` (default: 5) */
  cleanKeep?: number
  /** Whether to auto-open the HTML report after `devsnap scan --html` (default: true) */
  autoOpenHtml?: boolean
}

const DEFAULTS: Required<DevSnapConfig> = {
  disabledScanners: [],
  extraCliTools: [],
  staleDays: 180,
  cleanKeep: 5,
  autoOpenHtml: true,
}

export type ConfigKey = keyof DevSnapConfig

const CONFIG_KEYS = new Set<string>([
  'disabledScanners',
  'extraCliTools',
  'staleDays',
  'cleanKeep',
  'autoOpenHtml',
])

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function parseAndValidateConfigValue(key: ConfigKey, raw: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    parsed = raw
  }

  switch (key) {
    case 'autoOpenHtml': {
      if (typeof parsed === 'boolean') return parsed
      if (parsed === 'true' || raw === 'true') return true
      if (parsed === 'false' || raw === 'false') return false
      throw new Error('autoOpenHtml must be true or false')
    }
    case 'staleDays': {
      const n = typeof parsed === 'number' ? parsed : parseInt(String(parsed), 10)
      if (!Number.isInteger(n) || n < 1 || n > 36500) {
        throw new Error('staleDays must be an integer between 1 and 36500')
      }
      return n
    }
    case 'cleanKeep': {
      const n = typeof parsed === 'number' ? parsed : parseInt(String(parsed), 10)
      if (!Number.isInteger(n) || n < 1 || n > 10_000) {
        throw new Error('cleanKeep must be an integer between 1 and 10000')
      }
      return n
    }
    case 'disabledScanners':
    case 'extraCliTools': {
      if (!isStringArray(parsed)) {
        throw new Error(`${key} must be a JSON array of strings`)
      }
      return parsed
    }
    default:
      return parsed
  }
}

export async function loadConfig(): Promise<Required<DevSnapConfig>> {
  if (!existsSync(CONFIG_PATH)) return { ...DEFAULTS }
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw) as DevSnapConfig
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(DEVSNAP_DIR, { recursive: true, mode: 0o700 })
  await chmod(DEVSNAP_DIR, 0o700).catch(() => {})
}

export async function saveConfig(config: DevSnapConfig): Promise<void> {
  await ensureConfigDir()
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

export async function runConfigCommand(action: 'show' | 'set', key?: string, value?: string): Promise<void> {
  const chalk = (await import('chalk')).default

  if (action === 'show') {
    const config = await loadConfig()
    console.log('\n' + chalk.bold('devsnap config') + chalk.dim(` (${CONFIG_PATH})\n`))
    for (const [k, v] of Object.entries(config)) {
      console.log(`  ${chalk.cyan(k)}: ${JSON.stringify(v)}`)
    }
    console.log()
    return
  }

  if (action === 'set') {
    if (!key || value === undefined) {
      console.error('Usage: devsnap config set <key> <value>')
      process.exit(1)
    }

    if (RESERVED_KEYS.has(key)) {
      console.error(chalk.red(`Reserved config key: ${key}`))
      process.exit(1)
    }

    if (!CONFIG_KEYS.has(key)) {
      console.error(
        chalk.red(`Unknown config key: ${key}`) +
          chalk.dim(
            `\n  Allowed: ${[...CONFIG_KEYS].sort().join(', ')}`,
          ),
      )
      process.exit(1)
    }

    let coerced: unknown
    try {
      coerced = parseAndValidateConfigValue(key as ConfigKey, value)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(chalk.red(msg))
      process.exit(1)
    }

    const config = await loadConfig()
    const updated: Required<DevSnapConfig> = { ...config, [key]: coerced }
    await saveConfig(updated)
    console.log(chalk.green(`Config updated: `) + chalk.cyan(key) + ' = ' + JSON.stringify(coerced))
  }
}
