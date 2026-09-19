#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import pkg from '../package.json'
import { createPullRequestController } from './controllers/pr-create'
import { handleError } from './lib/handle-error'

const app = new Command()
  .name('gityo-pr-create')
  .description(
    'Create a GitHub pull request with an AI-generated title and body.'
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
    '-t, --title-style <style>',
    'Title style key to use (defaults to "default").'
  )
  .option(
    '-b, --body-style <style>',
    'Body style key to use (defaults to "default").'
  )
  .option(
    '-y, --yolo',
    'Create the pull request without asking for confirmation.'
  )
  .option('-w, --web', 'Open the pull request in a browser.')
  .version(`v${pkg.version}`, '-v, --version', 'Show the current version.')
  .action((baseBranch, headBranch, options) => {
    handleError(() =>
      createPullRequestController(baseBranch, headBranch, options)
    )
  })

void app.parseAsync(process.argv)
