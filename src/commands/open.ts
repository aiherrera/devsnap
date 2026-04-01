import openBrowser from 'open'
import { getLatestReport } from '../store/snapshots.js'
import chalk from 'chalk'

export async function runOpen(): Promise<void> {
  const path = await getLatestReport('html')
  if (!path) {
    console.log(chalk.dim('No HTML report found. Run `devsnap scan --html` first.'))
    return
  }
  console.log(`Opening ${chalk.cyan(path)}`)
  await openBrowser(path)
}
