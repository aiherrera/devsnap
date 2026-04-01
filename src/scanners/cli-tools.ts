import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, CliToolsInfo, CliToolEntry } from '../types.js'

interface ToolDef {
  name: string
  cmd: string
  versionArgs: string[]
  versionPattern?: RegExp
}

const TOOLS: ToolDef[] = [
  { name: 'git', cmd: 'git', versionArgs: ['--version'] },
  { name: 'gh', cmd: 'gh', versionArgs: ['--version'] },
  { name: 'kubectl', cmd: 'kubectl', versionArgs: ['version', '--client', '-o', 'json'], versionPattern: /"gitVersion":\s*"v([\d.]+)"/ },
  { name: 'helm', cmd: 'helm', versionArgs: ['version', '--template', '{{.Version}}'] },
  { name: 'k9s', cmd: 'k9s', versionArgs: ['version', '-s'] },
  { name: 'terraform', cmd: 'terraform', versionArgs: ['version', '-json'] },
  { name: 'aws', cmd: 'aws', versionArgs: ['--version'] },
  { name: 'gcloud', cmd: 'gcloud', versionArgs: ['--version'] },
  { name: 'az', cmd: 'az', versionArgs: ['--version'] },
  { name: 'docker', cmd: 'docker', versionArgs: ['--version'] },
  { name: 'docker-compose', cmd: 'docker-compose', versionArgs: ['--version'] },
  { name: 'jq', cmd: 'jq', versionArgs: ['--version'] },
  { name: 'yq', cmd: 'yq', versionArgs: ['--version'] },
  { name: 'fzf', cmd: 'fzf', versionArgs: ['--version'] },
  { name: 'bat', cmd: 'bat', versionArgs: ['--version'] },
  { name: 'eza', cmd: 'eza', versionArgs: ['--version'] },
  { name: 'zoxide', cmd: 'zoxide', versionArgs: ['--version'] },
  { name: 'ripgrep', cmd: 'rg', versionArgs: ['--version'] },
  { name: 'fd', cmd: 'fd', versionArgs: ['--version'] },
  { name: 'curl', cmd: 'curl', versionArgs: ['--version'] },
  { name: 'wget', cmd: 'wget', versionArgs: ['--version'] },
  { name: 'make', cmd: 'make', versionArgs: ['--version'] },
  { name: 'cmake', cmd: 'cmake', versionArgs: ['--version'] },
  { name: 'direnv', cmd: 'direnv', versionArgs: ['version'] },
  { name: 'starship', cmd: 'starship', versionArgs: ['--version'] },
  { name: 'just', cmd: 'just', versionArgs: ['--version'] },
  { name: 'mkcert', cmd: 'mkcert', versionArgs: ['-version'] },
  { name: 'ngrok', cmd: 'ngrok', versionArgs: ['version'] },
  { name: 'stripe', cmd: 'stripe', versionArgs: ['--version'] },
  { name: 'vercel', cmd: 'vercel', versionArgs: ['--version'] },
  { name: 'supabase', cmd: 'supabase', versionArgs: ['--version'] },
  { name: 'flyctl', cmd: 'flyctl', versionArgs: ['version'] },
  { name: 'wrangler', cmd: 'wrangler', versionArgs: ['--version'] },
]

/** Single binary name only — no paths or shell metacharacters */
const SAFE_CLI_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/

function buildExtraDefs(extraCliTools: string[] | undefined): ToolDef[] {
  if (!extraCliTools?.length) return []
  const known = new Set(TOOLS.map((t) => t.cmd))
  const out: ToolDef[] = []
  for (const name of extraCliTools) {
    if (typeof name !== 'string' || !SAFE_CLI_NAME.test(name)) continue
    if (known.has(name)) continue
    known.add(name)
    out.push({ name, cmd: name, versionArgs: ['--version'] })
  }
  return out
}

async function probeTool(tool: ToolDef): Promise<CliToolEntry> {
  try {
    const [whichResult, versionResult] = await Promise.all([
      execa('which', [tool.cmd], withCmdTimeout()).catch(() => null),
      execa(tool.cmd, tool.versionArgs, withCmdTimeout({ stderr: 'pipe', reject: false })),
    ])

    if (!whichResult) return { name: tool.name, installed: false, version: null, path: null }

    const raw = (versionResult.stdout || versionResult.stderr || '').trim()

    // Special case: terraform outputs JSON
    if (tool.name === 'terraform') {
      try {
        const parsed = JSON.parse(raw) as { terraform_version?: string }
        return { name: tool.name, installed: true, version: parsed.terraform_version ?? null, path: whichResult.stdout.trim() }
      } catch {
        // fall through to regex
      }
    }

    const pattern = tool.versionPattern ?? /(\d+\.\d+[\.\d]*)/
    const match = raw.match(pattern)
    return {
      name: tool.name,
      installed: true,
      version: match ? match[1] : raw.split('\n')[0].slice(0, 30),
      path: whichResult.stdout.trim(),
    }
  } catch {
    return { name: tool.name, installed: false, version: null, path: null }
  }
}

export async function scanCliTools(extraCliTools?: string[]): Promise<ScannerResult<CliToolsInfo>> {
  try {
    const extra = buildExtraDefs(extraCliTools)
    const defs = [...TOOLS, ...extra]
    const tools = await Promise.all(defs.map(probeTool))
    return { status: 'ok', data: { tools } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
