import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, NodeInfo, GlobalNpmPackage } from '../types.js'

async function getVersion(cmd: string, args: string[]): Promise<string | null> {
  try {
    const r = await execa(cmd, args, withCmdTimeout())
    return r.stdout.trim().replace(/^v/, '')
  } catch {
    return null
  }
}

export async function scanNode(): Promise<ScannerResult<NodeInfo>> {
  try {
    const nodeVersion = await getVersion('node', ['--version'])
    if (!nodeVersion) {
      return { status: 'unavailable', data: null }
    }

    const [npmVersion, pnpmVersion, bunVersion, nvmVersion, fnmVersion] = await Promise.all([
      getVersion('npm', ['--version']),
      getVersion('pnpm', ['--version']),
      getVersion('bun', ['--version']),
      // nvm doesn't expose a binary, check via env
      Promise.resolve(process.env['NVM_DIR'] ? 'installed (via NVM_DIR)' : null),
      getVersion('fnm', ['--version']).then((v) => v?.replace('fnm ', '') ?? null),
    ])

    // Parse global npm packages — npm list exits non-zero on peer dep warnings,
    // so we use reject:false and parse stdout regardless of exit code
    let globalPackages: GlobalNpmPackage[] = []
    try {
      const r = await execa('npm', ['list', '-g', '--depth=0', '--json'], withCmdTimeout({ reject: false }))
      if (r.stdout) {
        const parsed = JSON.parse(r.stdout) as { dependencies?: Record<string, { version?: string }> }
        globalPackages = Object.entries(parsed.dependencies ?? {}).map(([name, info]) => ({
          name,
          version: info.version ?? null,
        }))
      }
    } catch {
      // JSON parse failure or npm not available — leave as empty array
    }

    return {
      status: 'ok',
      data: {
        nodeVersion,
        npmVersion,
        pnpmVersion,
        bunVersion,
        nvmVersion,
        fnmVersion,
        globalPackages,
      },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
