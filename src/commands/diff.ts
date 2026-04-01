import chalk from 'chalk'
import { loadSnapshot, getLatestTwo, listSnapshots } from '../store/snapshots.js'
import type { Snapshot } from '../types.js'
import { diffSnapshots } from '../util/snapshot-diff.js'

function printDiff(before: Snapshot, after: Snapshot): void {
  const categories = diffSnapshots(before, after)

  const bDate = new Date(before.timestamp).toLocaleString()
  const aDate = new Date(after.timestamp).toLocaleString()

  console.log('\n' + chalk.bold('devsnap diff'))
  console.log(chalk.dim(`  from: ${bDate} [${before.id}]`))
  console.log(chalk.dim(`    to: ${aDate} [${after.id}]`))

  if (Object.keys(categories).length === 0) {
    console.log('\n' + chalk.green('  No changes detected between snapshots.'))
    return
  }

  for (const [category, entries] of Object.entries(categories)) {
    console.log('\n' + chalk.bold.cyan(`  ${category}`))
    for (const entry of entries) {
      if (entry.type === 'added') {
        console.log(chalk.green(`    + ${entry.key}`) + (entry.after ? chalk.dim(` ${entry.after}`) : ''))
      } else if (entry.type === 'removed') {
        console.log(chalk.red(`    - ${entry.key}`) + (entry.before ? chalk.dim(` ${entry.before}`) : ''))
      } else {
        console.log(chalk.yellow(`    ~ ${entry.key}`) + chalk.dim(` ${entry.before} → ${entry.after}`))
      }
    }
  }
  console.log()
}

export async function runDiff(id1?: string, id2?: string): Promise<void> {
  let before: Snapshot
  let after: Snapshot

  try {
    if (id1 && id2) {
      ;[before, after] = await Promise.all([loadSnapshot(id1), loadSnapshot(id2)])
    } else if (id1) {
      const metas = await listSnapshots()
      if (metas.length < 1) {
        console.error('No snapshots found. Run `devsnap scan` first.')
        process.exit(1)
      }
      const latest = metas[metas.length - 1]
      before = await loadSnapshot(id1)
      after = await loadSnapshot(latest.id)
    } else {
      const pair = await getLatestTwo()
      if (!pair) {
        console.error('Need at least 2 snapshots to diff. Run `devsnap scan` twice.')
        process.exit(1)
      }
      ;[before, after] = pair
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(msg)
    process.exit(1)
  }

  printDiff(before, after)
}
