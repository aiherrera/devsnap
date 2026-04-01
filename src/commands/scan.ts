import ora from 'ora'
import { runAllScanners, SCANNER_COUNT } from '../scanners/index.js'
import { saveSnapshot, saveReport } from '../store/snapshots.js'
import { getAnnotations } from '../store/annotations.js'
import { printSnapshot } from '../reporters/terminal.js'
import { generateMarkdown } from '../reporters/markdown.js'
import { generateHTML } from '../reporters/html.js'
import { loadConfig } from '../store/config.js'
import openBrowser from 'open'
import type { Snapshot } from '../types.js'

export interface ScanOptions {
  html: boolean
  md: boolean
  save: boolean
  json: boolean
}

export async function runScan(options: ScanOptions): Promise<void> {
  const config = await loadConfig()

  // JSON output: skip spinner and reporters, just print raw snapshot
  if (options.json) {
    const snapshot = await runAllScanners(undefined, config)
    if (options.save) await saveSnapshot(snapshot)
    process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n')
    return
  }

  const spinner = ora({ text: 'Scanning environment…', color: 'cyan' }).start()

  let completed = 0
  const total = SCANNER_COUNT

  const snapshot: Snapshot = await runAllScanners(() => {
    completed++
    spinner.text = `Scanning environment… (${completed}/${total})`
  }, config)

  spinner.succeed('Scan complete')

  const annotations = await getAnnotations()

  printSnapshot(snapshot, annotations)

  if (options.save) {
    const snapPath = await saveSnapshot(snapshot)
    console.log(`  Snapshot saved → ${snapPath}`)
  }

  if (options.md) {
    const md = generateMarkdown(snapshot, annotations)
    const mdPath = await saveReport(snapshot.id, md, 'md')
    console.log(`  Markdown report → ${mdPath}`)
  }

  if (options.html) {
    const html = generateHTML(snapshot, annotations)
    const htmlPath = await saveReport(snapshot.id, html, 'html')
    console.log(`  HTML report → ${htmlPath}`)
    if (config.autoOpenHtml) {
      await openBrowser(htmlPath)
    }
  }
}
