import chalk from 'chalk'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { getAnnotations, setAnnotation, removeAnnotation } from '../store/annotations.js'

async function promptNote(key: string): Promise<string> {
  const rl = readline.createInterface({ input, output })
  try {
    const answer = await rl.question(chalk.cyan(`Note for ${key}: `))
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function runAnnotate(key: string, note?: string, opts?: { show?: boolean; list?: boolean; remove?: boolean }): Promise<void> {
  if (opts?.list) {
    const annotations = await getAnnotations()
    const entries = Object.entries(annotations)
    if (entries.length === 0) {
      console.log(chalk.dim('No annotations yet. Add one with: devsnap annotate <key> "<note>"'))
      return
    }
    console.log('\n' + chalk.bold('Annotations'))
    for (const [k, ann] of entries) {
      console.log(`  ${chalk.cyan(k)}  ${ann.note}  ${chalk.dim(new Date(ann.updatedAt).toLocaleDateString())}`)
    }
    console.log()
    return
  }

  if (opts?.show) {
    const annotations = await getAnnotations()
    const ann = annotations[key]
    if (!ann) {
      console.log(chalk.dim(`No annotation for ${key}`))
    } else {
      console.log(`${chalk.cyan(key)}: ${ann.note}  ${chalk.dim(new Date(ann.updatedAt).toLocaleDateString())}`)
    }
    return
  }

  if (opts?.remove) {
    const removed = await removeAnnotation(key)
    if (removed) {
      console.log(chalk.green(`Removed annotation for ${key}`))
    } else {
      console.log(chalk.dim(`No annotation found for ${key}`))
    }
    return
  }

  // Interactive mode: prompt if note not provided on CLI
  const resolvedNote = note ?? (process.stdin.isTTY ? await promptNote(key) : undefined)

  if (!resolvedNote) {
    console.error('Provide a note: devsnap annotate <key> "<note>"')
    process.exit(1)
  }

  await setAnnotation(key, resolvedNote)
  console.log(chalk.green(`Annotation saved: `) + chalk.cyan(key) + ' ← ' + resolvedNote)
}
