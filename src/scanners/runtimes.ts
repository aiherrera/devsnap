import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, RuntimesInfo, RuntimeEntry } from '../types.js'

async function detect(
  cmd: string,
  versionArgs: string[],
  managerCmd?: string,
  managerArgs?: string[],
): Promise<RuntimeEntry | null> {
  try {
    const versionRaw = await execa(cmd, versionArgs, withCmdTimeout({ stderr: 'pipe' }))
      .then((r) => (r.stdout || r.stderr).trim())
      .catch(() => null)

    if (!versionRaw) return null

    // Extract semver-like version
    const match = versionRaw.match(/(\d+\.\d+[\.\d]*)/)
    const version = match ? match[1] : versionRaw.split('\n')[0].trim()

    let managerVersion: string | null | undefined = null
    if (managerCmd && managerArgs) {
      managerVersion = await execa(managerCmd, managerArgs, withCmdTimeout())
        .then((r) => r.stdout.trim().match(/(\d+\.\d+[\.\d]*)/)?.[1]?.trim() ?? null)
        .catch(() => null)
    }

    return {
      name: cmd,
      version,
      manager: managerCmd,
      managerVersion,
    }
  } catch {
    return null
  }
}

export async function scanRuntimes(): Promise<ScannerResult<RuntimesInfo>> {
  try {
    const [python, ruby, go, rust, java] = await Promise.all([
      detect('python3', ['--version'], 'pyenv', ['version']),
      detect('ruby', ['--version'], 'rbenv', ['version']),
      detect('go', ['version']),
      detect('rustc', ['--version']),
      detect('java', ['-version'], undefined, undefined),
    ])

    const allNull = [python, ruby, go, rust, java].every((r) => r === null)
    if (allNull) {
      return { status: 'unavailable', data: null }
    }

    return {
      status: 'ok',
      data: { python, ruby, go, rust, java },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
