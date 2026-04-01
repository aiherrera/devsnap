import { mkdir, readFile, writeFile, readdir, stat, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import type { Snapshot } from '../types.js'
import {
  displayTimestampFromSnapshotId,
  isValidReportFileId,
  isValidSnapshotFileId,
} from '../util/snapshot-ids.js'

const DEVSNAP_DIR = join(homedir(), '.devsnap')
const SNAPSHOTS_DIR = join(DEVSNAP_DIR, 'snapshots')
const REPORTS_DIR = join(DEVSNAP_DIR, 'reports')

function assertResolvedPathUnderDir(absFile: string, absDir: string): void {
  const f = resolve(absFile)
  const d = resolve(absDir)
  if (f !== d && !f.startsWith(d + sep)) {
    throw new Error('Resolved path escapes devsnap data directory')
  }
}

export async function ensureStoreDirs(): Promise<void> {
  await mkdir(DEVSNAP_DIR, { recursive: true, mode: 0o700 })
  await chmod(DEVSNAP_DIR, 0o700).catch(() => {})
  await mkdir(SNAPSHOTS_DIR, { recursive: true, mode: 0o700 })
  await mkdir(REPORTS_DIR, { recursive: true, mode: 0o700 })
}

export function getSnapshotId(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z')
}

export function snapshotPath(id: string): string {
  return join(SNAPSHOTS_DIR, `${id}.json`)
}

export function reportPath(id: string, ext: 'html' | 'md'): string {
  return join(REPORTS_DIR, `${id}.${ext}`)
}

export async function saveSnapshot(snapshot: Snapshot): Promise<string> {
  await ensureStoreDirs()
  if (!isValidSnapshotFileId(snapshot.id)) {
    throw new Error(`Invalid snapshot id on save: ${snapshot.id}`)
  }
  const path = snapshotPath(snapshot.id)
  assertResolvedPathUnderDir(path, SNAPSHOTS_DIR)
  await writeFile(path, JSON.stringify(snapshot, null, 2), 'utf8')
  return path
}

export async function loadSnapshot(id: string): Promise<Snapshot> {
  if (!isValidSnapshotFileId(id)) {
    throw new Error(
      `Invalid snapshot id "${id}". Use ids from \`devsnap list\` (timestamp-style names only).`,
    )
  }
  const path = snapshotPath(id)
  assertResolvedPathUnderDir(path, SNAPSHOTS_DIR)
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as Snapshot
}

export interface SnapshotMeta {
  id: string
  timestamp: string
  path: string
  sizeBytes: number
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  if (!existsSync(SNAPSHOTS_DIR)) return []
  const files = await readdir(SNAPSHOTS_DIR)
  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort()

  const metas = await Promise.all(
    jsonFiles.map(async (file) => {
      const path = join(SNAPSHOTS_DIR, file)
      const id = file.replace(/\.json$/, '')
      if (!isValidSnapshotFileId(id)) return null
      const info = await stat(path)
      return {
        id,
        timestamp: displayTimestampFromSnapshotId(id),
        path,
        sizeBytes: info.size,
      }
    }),
  )

  return metas.filter((m): m is SnapshotMeta => m !== null)
}

export async function getLatestTwo(): Promise<[Snapshot, Snapshot] | null> {
  const metas = await listSnapshots()
  if (metas.length < 2) return null
  const last = metas.slice(-2)
  const [a, b] = await Promise.all([loadSnapshot(last[0].id), loadSnapshot(last[1].id)])
  return [a, b]
}

export async function saveReport(id: string, content: string, ext: 'html' | 'md'): Promise<string> {
  if (!isValidReportFileId(id)) {
    throw new Error(`Invalid report id "${id}".`)
  }
  await ensureStoreDirs()
  const path = reportPath(id, ext)
  assertResolvedPathUnderDir(path, REPORTS_DIR)
  await writeFile(path, content, 'utf8')
  return path
}

export async function getLatestReport(ext: 'html' | 'md'): Promise<string | null> {
  if (!existsSync(REPORTS_DIR)) return null
  const files = await readdir(REPORTS_DIR)
  const matching = files
    .filter((f) => f.endsWith(`.${ext}`))
    .filter((f) => {
      const id = f.slice(0, -(ext.length + 1))
      return isValidReportFileId(id)
    })
    .sort()
  if (matching.length === 0) return null
  return join(REPORTS_DIR, matching[matching.length - 1])
}
