import { confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import { getGit } from '../lib/git.js'
import { getCurrentBranch } from '../lib/pr.js'
import { selectionTheme } from '../lib/prompts.js'
import { getCommitFiles, mainController, type CommitScope } from './commit.js'

type LocalChangesOptions = {
  yolo?: boolean
  scope?: CommitScope
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
  const scope = options.scope ?? 'staged-or-changes'
  const { diffScope, files } = await getCommitFiles(git, scope)

  if (files.length === 0) {
    return
  }

  const label = diffScope === 'staged' ? 'staged' : 'uncommitted'

  console.log(
    chalk.yellow(
      `• You have ${files.length} ${label} local change(s):\n${files.join('\n')}`
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
      console.log(chalk.dim(`Ignoring ${label} local changes.`))
      console.log('')
      return
    }
  }

  await mainController({
    yolo: options.yolo,
    push: true,
    scope,
  })
  console.log('')
}
