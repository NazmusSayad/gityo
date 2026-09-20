#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import pkg from '../package.json'
import { mainController } from './controllers/commit'
import { showConfigController } from './controllers/config'
import { createPullRequestController } from './controllers/pr-create'
import { mergePullRequestController } from './controllers/pr-merge'
import { showStylesController } from './controllers/styles'
import { handleError } from './lib/handle-error'

const app = new Command()
  .name('gityo')
  .description(
    'Stage changes, generate a commit message, create a commit, and run a post-commit git command.'
  )
  .option(
    '-i, --input <input>',
    'Use the provided input as the commit message.'
  )
  .option(
    '-s, --style <style>',
    'Commit message style key to use (defaults to "default").'
  )
  .option(
    '-m, --model <model>',
    'Model key from config to use (defaults to "default").'
  )
  .option(
    '-g, --generate',
    'Generate a commit message and commit without asking.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-y, --yolo',
    'Skip all questions, and generate message, commit, run post command. [Will fail if no model available]'
  )
  .version(`v${pkg.version}`, '-v, --version', 'Show the current version.')
  .action((options) => {
    if (options.generate && options.input) {
      console.error('Cannot use --generate and --input together.')
      process.exit(1)
    }

    handleError(() => mainController(options))
  })

app
  .command('commit')
  .description(
    'Stage changes, generate a commit message, create a commit, and run a post-commit git command.'
  )
  .option(
    '-i, --input <input>',
    'Use the provided input as the commit message.'
  )
  .option(
    '-s, --style <style>',
    'Commit message style key to use (defaults to "default").'
  )
  .option(
    '-m, --model <model>',
    'Model key from config to use (defaults to "default").'
  )
  .option(
    '-g, --generate',
    'Generate a commit message and commit without asking.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-y, --yolo',
    'Skip all questions, and generate message, commit, run post command. [Will fail if no model available]'
  )
  .action((options) => {
    if (options.generate && options.input) {
      console.error('Cannot use --generate and --input together.')
      process.exit(1)
    }

    handleError(() => mainController(options))
  })

const pr = app
  .command('pr')
  .description('Create and merge GitHub pull requests.')

pr.command('create')
  .description('Create a pull request with an AI-generated title and body.')
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
  .action((baseBranch, headBranch, options) => {
    handleError(() =>
      createPullRequestController(baseBranch, headBranch, options)
    )
  })

pr.command('merge')
  .description('Create the pull request if needed, then merge it.')
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
    'Merge the pull request without asking for confirmation.'
  )
  .action((baseBranch, headBranch, options) => {
    handleError(() =>
      mergePullRequestController(baseBranch, headBranch, options)
    )
  })

const config = app
  .command('config')
  .description('Show where to manage your gityo configuration.')
  .action(() => {
    handleError(showConfigController)
  })

config
  .command('styles')
  .description('Render available commit, PR title, and PR body styles.')
  .action(() => {
    handleError(showStylesController)
  })

void app.parseAsync(process.argv)
