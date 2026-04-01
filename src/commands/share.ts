import chalk from 'chalk'
import { execa } from 'execa'
import { withCmdTimeout } from '../util/execa-options.js'
import { readFile } from 'node:fs/promises'
import { listSnapshots, loadSnapshot, saveReport, getLatestReport } from '../store/snapshots.js'
import { getAnnotations } from '../store/annotations.js'
import { generateHTML } from '../reporters/html.js'
import { generateMarkdown } from '../reporters/markdown.js'

async function copyToClipboard(text: string): Promise<void> {
  await execa('pbcopy', withCmdTimeout({ input: text }))
}

async function uploadGist(filename: string, content: string, description: string): Promise<string> {
  // Requires gh CLI to be authenticated
  const r = await execa('gh', [
    'gist', 'create',
    '--desc', description,
    '--filename', filename,
    '-',
  ], withCmdTimeout({ input: content }))
  return r.stdout.trim()
}

export async function runShare(target: 'clipboard' | 'gist', format: 'html' | 'md' = 'md'): Promise<void> {
  const snapshots = await listSnapshots()
  if (snapshots.length === 0) {
    console.error('No snapshots found. Run `devsnap scan` first.')
    process.exit(1)
  }

  const meta = snapshots[snapshots.length - 1]
  let snapshot
  try {
    snapshot = await loadSnapshot(meta.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(msg)
    process.exit(1)
  }
  const annotations = await getAnnotations()

  if (target === 'clipboard') {
    if (format === 'html') {
      // Try to find an existing HTML report first, else generate
      const existing = await getLatestReport('html')
      const html = existing
        ? await readFile(existing, 'utf8')
        : generateHTML(snapshot, annotations)
      await copyToClipboard(html)
      console.log(chalk.green('HTML report copied to clipboard.'))
    } else {
      const md = generateMarkdown(snapshot, annotations)
      await copyToClipboard(md)
      console.log(chalk.green('Markdown report copied to clipboard.'))
    }
    return
  }

  if (target === 'gist') {
    // Check gh is available
    const ghAvailable = await execa('which', ['gh'], withCmdTimeout()).then(() => true).catch(() => false)
    if (!ghAvailable) {
      console.error('gh CLI not found. Install with: brew install gh')
      process.exit(1)
    }

    const md = generateMarkdown(snapshot, annotations)
    const filename = `devsnap-${meta.id}.md`
    const description = `devsnap environment snapshot — ${new Date(meta.timestamp).toLocaleString()}`

    console.log(
      chalk.dim(
        'Uploading to GitHub Gist (environment details become public on your GitHub account; review before sharing)…',
      ),
    )
    const url = await uploadGist(filename, md, description)
    console.log(chalk.green('Gist created → ') + chalk.cyan(url))

    // Also save the report locally
    await saveReport(meta.id, md, 'md')
  }
}
