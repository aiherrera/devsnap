import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { AnnotationsStore } from '../types.js'

const DEVSNAP_DIR = join(homedir(), '.devsnap')
const ANNOTATIONS_PATH = join(DEVSNAP_DIR, 'annotations.json')

export async function getAnnotations(): Promise<AnnotationsStore> {
  if (!existsSync(ANNOTATIONS_PATH)) return {}
  const raw = await readFile(ANNOTATIONS_PATH, 'utf8')
  return JSON.parse(raw) as AnnotationsStore
}

export async function setAnnotation(key: string, note: string): Promise<void> {
  await mkdir(DEVSNAP_DIR, { recursive: true, mode: 0o700 })
  await chmod(DEVSNAP_DIR, 0o700).catch(() => {})
  const store = await getAnnotations()
  store[key] = { note, updatedAt: new Date().toISOString() }
  await writeFile(ANNOTATIONS_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export async function removeAnnotation(key: string): Promise<boolean> {
  const store = await getAnnotations()
  if (!(key in store)) return false
  delete store[key]
  await writeFile(ANNOTATIONS_PATH, JSON.stringify(store, null, 2), 'utf8')
  return true
}
