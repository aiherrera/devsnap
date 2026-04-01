import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, DatabasesInfo, DatabaseEntry } from '../types.js'

async function isPortOpen(port: number): Promise<boolean> {
  if (port === 0) return false
  try {
    const r = await execa('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-t'], withCmdTimeout({ reject: false }))
    return r.stdout.trim().length > 0
  } catch {
    return false
  }
}

async function getVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const r = await execa(cmd, args, withCmdTimeout({ stderr: 'pipe' }))
    const output = r.stdout || r.stderr
    const match = output.match(/(\d+\.\d+[\.\d]*)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

async function isSqliteRunning(): Promise<boolean> {
  try {
    // Check for active sqlite3 processes
    const r = await execa('pgrep', ['-x', 'sqlite3'], withCmdTimeout({ reject: false }))
    return r.stdout.trim().length > 0
  } catch {
    return false
  }
}

async function getMysqlServerVersion(): Promise<string | null> {
  // Try mysqld first (server binary gives actual server version)
  const mysqld = await execa('mysqld', ['--version'], withCmdTimeout({ reject: false, stderr: 'pipe' }))
    .then((r) => (r.stdout || r.stderr).match(/(\d+\.\d+[\.\d]*)/)?.[1] ?? null)
    .catch(() => null)
  if (mysqld) return mysqld

  // Fallback: parse from mysql_config or brew info
  return execa('mysql_config', ['--version'], withCmdTimeout({ reject: false }))
    .then((r) => r.stdout.trim().match(/(\d+\.\d+[\.\d]*)/)?.[1] ?? null)
    .catch(() => null)
}

async function detectDatabase(
  name: string,
  cmds: string[],
  versionCmd: string,
  versionArgs: string[],
  port: number,
): Promise<DatabaseEntry> {
  const installed = await Promise.all(
    cmds.map((cmd) => execa('which', [cmd], withCmdTimeout()).then(() => true).catch(() => false)),
  )
  const isInstalled = installed.some(Boolean)

  if (!isInstalled) {
    return { name, installed: false, version: null, running: false }
  }

  const [version, running] = await Promise.all([
    name === 'MySQL' ? getMysqlServerVersion() : getVersion(versionCmd, versionArgs),
    name === 'SQLite' ? isSqliteRunning() : isPortOpen(port),
  ])

  return { name, installed: true, version, running }
}

export async function scanDatabases(): Promise<ScannerResult<DatabasesInfo>> {
  try {
    const [postgres, mysql, redis, mongodb, sqlite] = await Promise.all([
      detectDatabase('PostgreSQL', ['psql', 'pg_isready'], 'psql', ['--version'], 5432),
      detectDatabase('MySQL', ['mysql', 'mysqld'], 'mysql', ['--version'], 3306),
      detectDatabase('Redis', ['redis-cli', 'redis-server'], 'redis-cli', ['--version'], 6379),
      detectDatabase('MongoDB', ['mongod', 'mongosh'], 'mongod', ['--version'], 27017),
      detectDatabase('SQLite', ['sqlite3'], 'sqlite3', ['--version'], 0),
    ])

    return { status: 'ok', data: { postgres, mysql, redis, mongodb, sqlite } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
