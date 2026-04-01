import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import { existsSync } from 'node:fs'
import type { ScannerResult, TerminalsInfo, TerminalEntry } from '../types.js'

interface TerminalDef {
  name: string
  appPath: string
}

const TERMINALS: TerminalDef[] = [
  { name: 'iTerm2', appPath: '/Applications/iTerm.app' },
  { name: 'Warp', appPath: '/Applications/Warp.app' },
  { name: 'Ghostty', appPath: '/Applications/Ghostty.app' },
  { name: 'Alacritty', appPath: '/Applications/Alacritty.app' },
  { name: 'Kitty', appPath: '/Applications/kitty.app' },
  { name: 'Terminal', appPath: '/Applications/Utilities/Terminal.app' },
  { name: 'Hyper', appPath: '/Applications/Hyper.app' },
]

async function getAppVersion(appPath: string): Promise<string | null> {
  try {
    const plistPath = `${appPath}/Contents/Info.plist`
    const r = await execa('defaults', ['read', plistPath, 'CFBundleShortVersionString'], withCmdTimeout())
    return r.stdout.trim() || null
  } catch {
    return null
  }
}

export async function scanTerminals(): Promise<ScannerResult<TerminalsInfo>> {
  try {
    const shell = process.env['SHELL'] ?? '/bin/zsh'
    const shellName = shell.split('/').pop() ?? 'unknown'

    let shellVersion: string | null = null
    try {
      const r = await execa(shell, ['--version'], withCmdTimeout())
      const match = (r.stdout || r.stderr).match(/(\d+\.\d+[\.\d]*)/)
      shellVersion = match ? match[1] : null
    } catch {
      // some shells don't support --version
    }

    let tmux: string | null = null
    try {
      const r = await execa('tmux', ['-V'], withCmdTimeout())
      tmux = r.stdout.trim().replace('tmux ', '')
    } catch {
      // tmux not installed
    }

    const terminals = await Promise.all(
      TERMINALS.map(async ({ name, appPath }): Promise<TerminalEntry> => {
        const installed = existsSync(appPath)
        if (!installed) return { name, installed: false, version: null }
        const version = await getAppVersion(appPath)
        return { name, installed: true, version }
      }),
    )

    return {
      status: 'ok',
      data: {
        shell: shellName,
        shellVersion,
        tmux,
        terminals,
      },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
