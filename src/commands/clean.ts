import chalk from 'chalk'
import { unlink } from 'node:fs/promises'
import { listSnapshots, reportPath } from '../store/snapshots.js'
import { existsSync } from 'node:fs'

export async function runClean(keepN = 5): Promise<void> {
  if (!Number.isInteger(keepN) || keepN < 1) {
    console.error(chalk.red('Invalid --keep value: use a positive integer (e.g. 5).'))
    process.exit(1)
  }

  const snapshots = await listSnapshots()

  if (snapshots.length === 0) {
    console.log(chalk.dim('No snapshots to clean.'))
    return
  }

  if (snapshots.length <= keepN) {
    console.log(chalk.dim(`Only ${snapshots.length} snapshot(s) — nothing to clean (keep=${keepN}).`))
    return
  }

  const toDelete = snapshots.slice(0, snapshots.length - keepN)
  console.log(`\nRemoving ${chalk.bold(String(toDelete.length))} snapshot(s), keeping last ${chalk.bold(String(keepN))}...\n`)

  for (const snap of toDelete) {
    await unlink(snap.path)
    console.log(`  ${chalk.red('✗')} ${snap.id}`)

    // Remove associated reports if present
    for (const ext of ['html', 'md'] as const) {
      const rp = reportPath(snap.id, ext)
      if (existsSync(rp)) await unlink(rp)
    }
  }

  console.log(chalk.green(`\nDone. ${snapshots.length - toDelete.length} snapshot(s) remain.\n`))
}
