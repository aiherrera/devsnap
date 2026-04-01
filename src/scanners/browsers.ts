import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import { existsSync } from 'node:fs'
import type { ScannerResult, BrowsersInfo, BrowserEntry } from '../types.js'

interface BrowserDef {
  name: string
  appPath: string
  plistKey: string
}

const BROWSERS: BrowserDef[] = [
  { name: 'Google Chrome', appPath: '/Applications/Google Chrome.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Firefox', appPath: '/Applications/Firefox.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Safari', appPath: '/Applications/Safari.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Arc', appPath: '/Applications/Arc.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Brave Browser', appPath: '/Applications/Brave Browser.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Zen Browser', appPath: '/Applications/Zen Browser.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Microsoft Edge', appPath: '/Applications/Microsoft Edge.app', plistKey: 'CFBundleShortVersionString' },
  { name: 'Opera', appPath: '/Applications/Opera.app', plistKey: 'CFBundleShortVersionString' },
]

async function getBrowserVersion(appPath: string, plistKey: string): Promise<string | null> {
  try {
    const plistPath = `${appPath}/Contents/Info.plist`
    const r = await execa('defaults', ['read', plistPath, plistKey], withCmdTimeout())
    return r.stdout.trim() || null
  } catch {
    return null
  }
}

export async function scanBrowsers(): Promise<ScannerResult<BrowsersInfo>> {
  try {
    const browsers = await Promise.all(
      BROWSERS.map(async ({ name, appPath, plistKey }): Promise<BrowserEntry> => {
        const installed = existsSync(appPath)
        if (!installed) return { name, installed: false, version: null }
        const version = await getBrowserVersion(appPath, plistKey)
        return { name, installed: true, version }
      }),
    )

    return { status: 'ok', data: { browsers } }
  } catch (err) {
    return { status: 'error', data: null, error: String(err) }
  }
}
