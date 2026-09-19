#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import pkg from '../package.json'
import { mergePullRequestController } from './controllers/pr-merge'
import { handleError } from './lib/handle-error'

const app = new Command()
  .name('gityo-pr-merge')
  .description(
    'Create the pull request if needed, then merge it with the GitHub CLI.'
  )
  .argument(
    '[base-branch]',
    'Base branch to merge into (defaults to the repository default branch).'
  )
  .argument(
    '[head-branch]',
    'Head branch with the changes (defaults to the current branch).'
  )
  .option(
    '-m, --model <model>',
    'Model key from config to use (defaults to "default").'
  )
  .option(
    '-y, --yolo',
    'Merge the pull request without asking for confirmation.'
  )
  .version(`v${pkg.version}`, '-v, --version', 'Show the current version.')
  .action((baseBranch, headBranch, options) => {
    handleError(() =>
      mergePullRequestController(baseBranch, headBranch, options)
    )
  })

void app.parseAsync(process.argv)
