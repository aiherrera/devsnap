import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, SystemInfo } from '../types.js'

export async function scanSystem(): Promise<ScannerResult<SystemInfo>> {
  try {
    const [swVers, arch, memRaw, dfRaw] = await Promise.all([
      execa('sw_vers', [], withCmdTimeout()).then((r) => r.stdout).catch(() => ''),
      execa('uname', ['-m'], withCmdTimeout()).then((r) => r.stdout.trim()).catch(() => 'unknown'),
      execa('sysctl', ['-n', 'hw.memsize'], withCmdTimeout()).then((r) => r.stdout.trim()).catch(() => '0'),
      execa('df', ['-k', '/'], withCmdTimeout()).then((r) => r.stdout).catch(() => ''),
    ])

    const get = (key: string): string => {
      const match = swVers.match(new RegExp(`${key}:\\s*(.+)`))
      return match ? match[1].trim() : 'unknown'
    }

    const ramBytes = parseInt(memRaw, 10)
    const ramGB = Math.round(ramBytes / 1024 / 1024 / 1024)

    // Parse df output: Filesystem 512-blocks Used Available ...
    let diskTotal = 'unknown'
    let diskUsed = 'unknown'
    let diskFree = 'unknown'
    const dfLines = dfRaw.trim().split('\n')
    if (dfLines.length >= 2) {
      const parts = dfLines[1].split(/\s+/)
      // df -k gives 1K-blocks
      if (parts.length >= 4) {
        const toGB = (kb: string) => `${(parseInt(kb, 10) / 1024 / 1024).toFixed(1)} GB`
        diskTotal = toGB(parts[1])
        diskUsed = toGB(parts[2])
        diskFree = toGB(parts[3])
      }
    }

    // Determine chip from arch + sysctl brand string
    let chip = arch
    try {
      const brand = await execa('sysctl', ['-n', 'machdep.cpu.brand_string'], withCmdTimeout()).then((r) => r.stdout.trim())
      chip = brand || arch
    } catch {
      // Apple Silicon doesn't have machdep.cpu.brand_string; use hw.chip
      try {
        const hwChip = await execa('sysctl', ['-n', 'hw.chip'], withCmdTimeout()).then((r) => r.stdout.trim())
        chip = hwChip || arch
      } catch {
        // keep arch as chip
      }
    }

    return {
      status: 'ok',
      data: {
        macosVersion: get('ProductVersion'),
        macosBuild: get('BuildVersion'),
        productName: get('ProductName'),
        chip,
        arch,
        ramGB,
        diskTotal,
        diskUsed,
        diskFree,
      },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
