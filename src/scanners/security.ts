import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import type { ScannerResult, SecurityInfo, SecurityCheck, OpenPortEntry, BrewOutdatedEntry } from '../types.js'

async function checkFileVault(): Promise<SecurityCheck> {
  try {
    const { stdout } = await execa('fdesetup', ['status'], withCmdTimeout())
    const on = /FileVault is On/i.test(stdout)
    return { name: 'FileVault', status: on ? 'pass' : 'fail', detail: stdout.trim() }
  } catch {
    return { name: 'FileVault', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkFirewall(): Promise<SecurityCheck> {
  try {
    const { stdout } = await execa('/usr/libexec/ApplicationFirewall/socketfilterfw', ['--getglobalstate'], withCmdTimeout())
    const on = /enabled/i.test(stdout)
    return { name: 'Firewall', status: on ? 'pass' : 'fail', detail: stdout.trim() }
  } catch {
    return { name: 'Firewall', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkSIP(): Promise<SecurityCheck> {
  try {
    const { stdout, stderr } = await execa('csrutil', ['status'], withCmdTimeout())
    const out = (stdout || stderr).trim()
    const enabled = /enabled/i.test(out)
    return { name: 'System Integrity Protection', status: enabled ? 'pass' : 'warn', detail: out }
  } catch {
    return { name: 'System Integrity Protection', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkGatekeeper(): Promise<SecurityCheck> {
  try {
    const { stdout, stderr } = await execa('spctl', ['--status'], withCmdTimeout())
    const out = (stdout || stderr).trim()
    const enabled = /enabled/i.test(out)
    return { name: 'Gatekeeper', status: enabled ? 'pass' : 'warn', detail: out }
  } catch {
    return { name: 'Gatekeeper', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkAutomaticUpdates(): Promise<SecurityCheck> {
  try {
    const { stdout } = await execa(
      'defaults',
      ['read', '/Library/Preferences/com.apple.SoftwareUpdate', 'AutomaticCheckEnabled'],
      withCmdTimeout(),
    )
    const on = stdout.trim() === '1'
    return {
      name: 'Automatic Updates',
      status: on ? 'pass' : 'warn',
      detail: on ? 'Automatic update checks enabled' : 'Automatic update checks disabled',
    }
  } catch {
    return { name: 'Automatic Updates', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkRemoteLogin(): Promise<SecurityCheck> {
  try {
    // Check if sshd is listening on port 22
    const { stdout } = await execa('launchctl', ['list', 'com.openssh.sshd'], withCmdTimeout({ reject: false }))
    const running = stdout.includes('com.openssh.sshd')
    return {
      name: 'Remote Login (SSH)',
      status: running ? 'warn' : 'pass',
      detail: running ? 'SSH remote login is enabled (port 22)' : 'SSH remote login is disabled',
    }
  } catch {
    return { name: 'Remote Login (SSH)', status: 'unknown', detail: 'Could not determine status' }
  }
}

async function checkScreenLock(): Promise<SecurityCheck> {
  try {
    const { stdout } = await execa('defaults', ['read', 'com.apple.screensaver', 'askForPassword'], withCmdTimeout())
    const on = stdout.trim() === '1'
    return {
      name: 'Screen Lock',
      status: on ? 'pass' : 'warn',
      detail: on ? 'Password required after screensaver' : 'No password required after screensaver',
    }
  } catch {
    return { name: 'Screen Lock', status: 'unknown', detail: 'Could not read screensaver preferences' }
  }
}

async function getOpenPorts(): Promise<OpenPortEntry[]> {
  try {
    const { stdout } = await execa('lsof', ['-i', '-P', '-n', '-sTCP:LISTEN'], withCmdTimeout({ reject: false }))
    const lines = stdout.trim().split('\n').slice(1) // skip header
    const seen = new Set<string>()
    const entries: OpenPortEntry[] = []

    for (const line of lines) {
      const parts = line.split(/\s+/)
      if (parts.length < 9) continue
      const process = parts[0] ?? ''
      const pid = parts[1] ?? ''
      const name = parts[8] ?? ''
      const portMatch = name.match(/:(\d+)$/)
      if (!portMatch) continue
      const port = portMatch[1]
      const key = `${process}:${port}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push({ process, pid, port, protocol: 'TCP' })
    }

    return entries.slice(0, 30) // cap at 30 to avoid noise
  } catch {
    return []
  }
}

async function getBrewOutdated(): Promise<BrewOutdatedEntry[]> {
  try {
    const { stdout } = await execa('brew', ['outdated', '--verbose'], withCmdTimeout({ reject: false }))
    const lines = stdout.trim().split('\n').filter(Boolean)
    const entries: BrewOutdatedEntry[] = []

    for (const line of lines) {
      // format: "name (installedVersion) < currentVersion"
      const match = line.match(/^(\S+)\s+\(([^)]+)\)\s+<\s+(.+)$/)
      if (match) {
        entries.push({ name: match[1], installedVersion: match[2], currentVersion: match[3].trim() })
      }
    }

    return entries
  } catch {
    return []
  }
}

export async function scanSecurity(): Promise<ScannerResult<SecurityInfo>> {
  try {
    const [filevault, firewall, sip, gatekeeper, automaticUpdates, remoteLogin, screenLock, openPorts, brewOutdated] =
      await Promise.all([
        checkFileVault(),
        checkFirewall(),
        checkSIP(),
        checkGatekeeper(),
        checkAutomaticUpdates(),
        checkRemoteLogin(),
        checkScreenLock(),
        getOpenPorts(),
        getBrewOutdated(),
      ])

    return {
      status: 'ok',
      data: { filevault, firewall, sip, gatekeeper, automaticUpdates, remoteLogin, screenLock, openPorts, brewOutdated },
    }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
