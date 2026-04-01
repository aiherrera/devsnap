import chalk from 'chalk'
import { listSnapshots } from '../store/snapshots.js'

export async function runList(): Promise<void> {
  const snapshots = await listSnapshots()

  if (snapshots.length === 0) {
    console.log(chalk.dim('No snapshots yet. Run `devsnap scan` to create one.'))
    return
  }

  console.log('\n' + chalk.bold('Snapshots'))
  for (const snap of snapshots) {
    const date = new Date(snap.timestamp).toLocaleString()
    const sizeKB = (snap.sizeBytes / 1024).toFixed(1)
    console.log(`  ${chalk.cyan(snap.id)}  ${chalk.dim(date)}  ${chalk.dim(sizeKB + ' KB')}`)
  }
  console.log()
}
