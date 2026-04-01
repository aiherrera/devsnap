import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DEVSNAP_DIR = join(homedir(), '.devsnap')
export const CLOUD_CREDENTIALS_PATH = join(DEVSNAP_DIR, 'cloud.json')

/** Default API base when developing against a local backend (override with `cloud auth --url` or `DEVSNAP_CLOUD_API`). */
export const DEFAULT_CLOUD_API_BASE = 'http://localhost:3001'

export interface CloudCredentials {
  apiKey: string
  /** e.g. https://api.example.com (no trailing slash) */
  apiBaseUrl: string
  /** Optional dashboard URL for `devsnap cloud open` */
  dashboardUrl?: string
}

export async function loadCloudCredentials(): Promise<CloudCredentials | null> {
  if (!existsSync(CLOUD_CREDENTIALS_PATH)) return null
  try {
    const raw = await readFile(CLOUD_CREDENTIALS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CloudCredentials>
    if (typeof parsed.apiKey !== 'string' || typeof parsed.apiBaseUrl !== 'string') return null
    return {
      apiKey: parsed.apiKey,
      apiBaseUrl: parsed.apiBaseUrl.replace(/\/$/, ''),
      dashboardUrl: typeof parsed.dashboardUrl === 'string' ? parsed.dashboardUrl.replace(/\/$/, '') : undefined,
    }
  } catch {
    return null
  }
}

export async function saveCloudCredentials(creds: CloudCredentials): Promise<void> {
  await mkdir(DEVSNAP_DIR, { recursive: true, mode: 0o700 })
  await chmod(DEVSNAP_DIR, 0o700).catch(() => {})
  const payload: CloudCredentials = {
    apiKey: creds.apiKey,
    apiBaseUrl: creds.apiBaseUrl.replace(/\/$/, ''),
    dashboardUrl: creds.dashboardUrl?.replace(/\/$/, ''),
  }
  await writeFile(CLOUD_CREDENTIALS_PATH, JSON.stringify(payload, null, 2), { mode: 0o600, encoding: 'utf8' })
  await chmod(CLOUD_CREDENTIALS_PATH, 0o600).catch(() => {})
}

export async function clearCloudCredentials(): Promise<void> {
  if (!existsSync(CLOUD_CREDENTIALS_PATH)) return
  const { unlink } = await import('node:fs/promises')
  await unlink(CLOUD_CREDENTIALS_PATH).catch(() => {})
}
