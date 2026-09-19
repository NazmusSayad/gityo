import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { getChangedFiles, getGit } from '../lib/git'
import { getCurrentBranch } from '../lib/pr'
import { selectionTheme } from '../lib/prompts'
import { mainController } from './commit'

type LocalChangesOptions = {
  yolo?: boolean
}

export async function handleUncommittedChanges(
  headBranch: string,
  options: LocalChangesOptions = {}
) {
  const currentBranch = await getCurrentBranch()

  if (currentBranch !== headBranch) {
    return
  }

  const { git } = await getGit()
  const files = await getChangedFiles(git)

  if (files.length === 0) {
    return
  }

  console.log(
    chalk.yellow(
      `• You have ${files.length} uncommitted local change(s):\n${files.join('\n')}`
    )
  )
  console.log('')

  if (!options.yolo) {
    const shouldPush = await confirm({
      message: 'Do you want to commit and push them before continuing?',
      default: true,
      theme: selectionTheme,
    })

    if (!shouldPush) {
      console.log(chalk.dim('Ignoring uncommitted local changes.'))
      console.log('')
      return
    }
  } else {
    console.log(chalk.yellow('✓ Committing and pushing local changes'))
  }

  await mainController({ yolo: options.yolo, push: true })
  console.log('')
}
