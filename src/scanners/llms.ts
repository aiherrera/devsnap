import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ScannerResult, LLMsInfo, OllamaModel } from '../types.js'

export async function scanLLMs(): Promise<ScannerResult<LLMsInfo>> {
  try {
    // Ollama
    let ollamaInstalled = false
    let ollamaVersion: string | null = null
    let models: OllamaModel[] = []

    try {
      const vr = await execa('ollama', ['--version'], withCmdTimeout())
      ollamaInstalled = true
      const match = vr.stdout.match(/(\d+\.\d+[\.\d]*)/)
      ollamaVersion = match ? match[1] : vr.stdout.trim()

      const lr = await execa('ollama', ['list'], withCmdTimeout())
      const lines = lr.stdout.trim().split('\n').slice(1) // skip header
      models = lines
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s{2,}/)
          return {
            name: parts[0] ?? '',
            size: parts[2] ?? '',
            modified: parts[3] ?? '',
          }
        })
    } catch {
      // ollama not installed or not running
    }

    // LM Studio
    const lmStudioPath = '/Applications/LM Studio.app'
    const lmStudioInstalled = existsSync(lmStudioPath)

    // Claude Desktop
    const claudeDesktopPath = '/Applications/Claude.app'
    const claudeSupportPath = join(homedir(), 'Library', 'Application Support', 'Claude')
    const claudeDesktopInstalled = existsSync(claudeDesktopPath) || existsSync(claudeSupportPath)

    // GitHub Copilot (VS Code extension)
    const copilotExtDir = join(homedir(), '.vscode', 'extensions')
    let copilotInstalled = false
    try {
      const { readdir } = await import('node:fs/promises')
      const entries = await readdir(copilotExtDir)
      copilotInstalled = entries.some((e) => e.toLowerCase().startsWith('github.copilot'))
    } catch {
      // extensions dir doesn't exist
    }

    return {
      status: 'ok',
      data: {
        ollama: { installed: ollamaInstalled, version: ollamaVersion, models },
        lmStudio: { installed: lmStudioInstalled },
        claudeDesktop: { installed: claudeDesktopInstalled },
        copilot: { installed: copilotInstalled },
      },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
