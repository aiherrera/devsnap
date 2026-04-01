import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ScannerResult, EditorsInfo, EditorEntry } from '../types.js'

async function getAppVersion(appPath: string): Promise<string | null> {
  try {
    const plistPath = `${appPath}/Contents/Info.plist`
    const r = await execa('defaults', ['read', plistPath, 'CFBundleShortVersionString'], withCmdTimeout())
    return r.stdout.trim() || null
  } catch {
    return null
  }
}

async function countVSCodeExtensions(extensionsDir: string): Promise<number> {
  try {
    const entries = await readdir(extensionsDir)
    return entries.filter((e) => !e.startsWith('.')).length
  } catch {
    return 0
  }
}

export async function scanEditors(): Promise<ScannerResult<EditorsInfo>> {
  try {
    const editors: EditorEntry[] = []

    // VS Code
    const vscodePath = '/Applications/Visual Studio Code.app'
    const vscodeExtDir = join(homedir(), '.vscode', 'extensions')
    if (existsSync(vscodePath)) {
      const [version, extensionCount] = await Promise.all([
        getAppVersion(vscodePath),
        countVSCodeExtensions(vscodeExtDir),
      ])
      editors.push({ name: 'VS Code', installed: true, version, extensionCount })
    } else {
      editors.push({ name: 'VS Code', installed: false, version: null })
    }

    // Cursor
    const cursorPath = '/Applications/Cursor.app'
    const cursorExtDir = join(homedir(), '.cursor', 'extensions')
    if (existsSync(cursorPath)) {
      const [version, extensionCount] = await Promise.all([
        getAppVersion(cursorPath),
        countVSCodeExtensions(cursorExtDir),
      ])
      editors.push({ name: 'Cursor', installed: true, version, extensionCount })
    } else {
      editors.push({ name: 'Cursor', installed: false, version: null })
    }

    // Zed
    const zedPath = '/Applications/Zed.app'
    if (existsSync(zedPath)) {
      const version = await getAppVersion(zedPath)
      editors.push({ name: 'Zed', installed: true, version })
    } else {
      editors.push({ name: 'Zed', installed: false, version: null })
    }

    // JetBrains IDEs
    const jetbrainsApps = [
      { name: 'IntelliJ IDEA', path: '/Applications/IntelliJ IDEA.app' },
      { name: 'WebStorm', path: '/Applications/WebStorm.app' },
      { name: 'PyCharm', path: '/Applications/PyCharm.app' },
      { name: 'GoLand', path: '/Applications/GoLand.app' },
      { name: 'RustRover', path: '/Applications/RustRover.app' },
      { name: 'DataGrip', path: '/Applications/DataGrip.app' },
      { name: 'Rider', path: '/Applications/Rider.app' },
    ]

    for (const { name, path } of jetbrainsApps) {
      if (existsSync(path)) {
        const version = await getAppVersion(path)
        editors.push({ name, installed: true, version })
      }
    }

    // Vim / Neovim (CLI)
    for (const { name, cmd, args } of [
      { name: 'Neovim', cmd: 'nvim', args: ['--version'] },
      { name: 'Vim', cmd: 'vim', args: ['--version'] },
      { name: 'Emacs', cmd: 'emacs', args: ['--version'] },
    ]) {
      try {
        const r = await execa(cmd, args, withCmdTimeout())
        const match = (r.stdout || r.stderr).match(/(\d+\.\d+[\.\d]*)/)
        editors.push({ name, installed: true, version: match ? match[1] : null })
      } catch {
        // not installed
      }
    }

    return { status: 'ok', data: { editors } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
