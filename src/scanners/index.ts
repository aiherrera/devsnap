import type { Snapshot, ScannerResult } from '../types.js'
import { SNAPSHOT_SCHEMA_VERSION } from '../types.js'
import type { DevSnapConfig } from '../store/config.js'
import { getSnapshotId } from '../store/snapshots.js'
import { scanSystem } from './system.js'
import { scanBrew } from './brew.js'
import { scanNode } from './node.js'
import { scanRuntimes } from './runtimes.js'
import { scanDocker } from './docker.js'
import { scanDatabases } from './databases.js'
import { scanBrowsers } from './browsers.js'
import { scanTerminals } from './terminals.js'
import { scanEditors } from './editors.js'
import { scanLLMs } from './llms.js'
import { scanCliTools } from './cli-tools.js'

export const SCANNER_COUNT = 11

export type ScannerName =
  | 'system'
  | 'brew'
  | 'node'
  | 'runtimes'
  | 'docker'
  | 'databases'
  | 'browsers'
  | 'terminals'
  | 'editors'
  | 'llms'
  | 'cliTools'

export type ScanProgress = (name: ScannerName) => void

export async function runAllScanners(
  onProgress?: ScanProgress,
  config?: Pick<DevSnapConfig, 'extraCliTools' | 'disabledScanners'>,
): Promise<Snapshot> {
  const id = getSnapshotId()
  const timestamp = new Date().toISOString()

  const disabled = new Set(
    (config?.disabledScanners ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean),
  )

  const wrap = async <T>(name: ScannerName, fn: () => Promise<T>): Promise<T> => {
    try {
      const result = await fn()
      onProgress?.(name)
      return result
    } catch (err) {
      onProgress?.(name)
      throw err
    }
  }

  const runOrSkip = async <T>(name: ScannerName, fn: () => Promise<ScannerResult<T>>): Promise<ScannerResult<T>> => {
    if (disabled.has(name)) {
      onProgress?.(name)
      return { status: 'unavailable', data: null }
    }
    return wrap(name, fn)
  }

  const [system, brew, node, runtimes, docker, databases, browsers, terminals, editors, llms, cliTools] =
    await Promise.all([
      runOrSkip('system', scanSystem),
      runOrSkip('brew', scanBrew),
      runOrSkip('node', scanNode),
      runOrSkip('runtimes', scanRuntimes),
      runOrSkip('docker', scanDocker),
      runOrSkip('databases', scanDatabases),
      runOrSkip('browsers', scanBrowsers),
      runOrSkip('terminals', scanTerminals),
      runOrSkip('editors', scanEditors),
      runOrSkip('llms', scanLLMs),
      runOrSkip('cliTools', () => scanCliTools(config?.extraCliTools)),
    ])

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    id,
    timestamp,
    system,
    brew,
    node,
    runtimes,
    docker,
    databases,
    browsers,
    terminals,
    editors,
    llms,
    cliTools,
  }
}
