import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, BrewInfo, BrewFormula, BrewCask } from '../types.js'

interface BrewFormulaJson {
  name: string
  versions?: { stable?: string }
  installed?: Array<{ version: string; installed_on_request?: boolean; install_time?: number }>
  desc?: string
}

interface BrewCaskJson {
  token: string
  version?: string
  installed?: string
  desc?: string
  name?: string[]
}

interface BrewInfoJson {
  formulae?: BrewFormulaJson[]
  casks?: BrewCaskJson[]
}

export async function scanBrew(): Promise<ScannerResult<BrewInfo>> {
  try {
    const versionResult = await execa('brew', ['--version'], withCmdTimeout()).catch(() => null)
    if (!versionResult) {
      return { status: 'unavailable', data: null }
    }

    const version = versionResult.stdout.split('\n')[0].replace('Homebrew ', '').trim()

    const infoResult = await execa('brew', ['info', '--json=v2', '--installed'], withCmdTimeout()).catch(() => null)
    if (!infoResult) {
      return { status: 'ok', data: { version, formulae: [], casks: [] } }
    }

    const info: BrewInfoJson = JSON.parse(infoResult.stdout)

    const formulae: BrewFormula[] = (info.formulae ?? []).map((f) => {
      const installed = f.installed?.[0]
      let installedOn: string | null = null
      if (installed?.install_time != null) {
        installedOn = new Date(installed.install_time * 1000).toISOString().split('T')[0]
      }
      return {
        name: f.name,
        version: installed?.version ?? f.versions?.stable ?? 'unknown',
        installedOn,
        description: f.desc ?? '',
      }
    })

    const casks: BrewCask[] = (info.casks ?? []).map((c) => ({
      name: c.name?.[0] ?? c.token,
      version: c.installed ?? c.version ?? 'unknown',
      description: c.desc ?? '',
    }))

    return { status: 'ok', data: { version, formulae, casks } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
