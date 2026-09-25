#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings'
import pkg from '../package.json' with { type: 'json' }
import { mainController } from './controllers/commit.js'
import { showConfigController } from './controllers/config.js'
import { createPullRequestController } from './controllers/pr-create.js'
import { mergePullRequestController } from './controllers/pr-merge.js'
import { releaseController } from './controllers/release.js'
import { showStylesController } from './controllers/styles.js'
import { handleError } from './lib/handle-error.js'

const app = new Command()
  .enablePositionalOptions()
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
    '--model <model>',
    'Model key from config to use (overrides the configured model).'
  )
  .option(
    '-g, --generate',
    'Generate a commit message and commit without asking.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-S, --staged',
    'Commit only staged files. Fails if nothing is staged.'
  )
  .option('-A, --all', 'Commit all changes, not just staged files.')
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

    if (options.staged && options.all) {
      console.error('Cannot use --staged and --all together.')
      process.exit(1)
    }

    handleError(() =>
      mainController({
        ...options,
        scope: options.all
          ? 'everything'
          : options.staged
            ? 'staged-only'
            : 'staged-or-changes',
      })
    )
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
    '--model <model>',
    'Model key from config to use (overrides the configured model).'
  )
  .option(
    '-g, --generate',
    'Generate a commit message and commit without asking.'
  )
  .option('-p, --post', 'Run the post-commit git command without asking.')
  .option(
    '-S, --staged',
    'Commit only staged files. Fails if nothing is staged.'
  )
  .option('-A, --all', 'Commit all changes, not just staged files.')
  .option(
    '-y, --yolo',
    'Skip all questions, and generate message, commit, run post command. [Will fail if no model available]'
  )
  .action((options) => {
    if (options.generate && options.input) {
      console.error('Cannot use --generate and --input together.')
      process.exit(1)
    }

    if (options.staged && options.all) {
      console.error('Cannot use --staged and --all together.')
      process.exit(1)
    }

    handleError(() =>
      mainController({
        ...options,
        scope: options.all
          ? 'everything'
          : options.staged
            ? 'staged-only'
            : 'staged-or-changes',
      })
    )
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
    '--model <model>',
    'Model key from config to use (overrides the configured model).'
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
  .option(
    '-A, --all',
    'Commit all local changes, not just staged files, before continuing.'
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
    '--model <model>',
    'Model key from config to use (overrides the configured model).'
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
  .option(
    '-A, --all',
    'Commit all local changes, not just staged files, before continuing.'
  )
  .option('-m, --merge', 'Merge the commits with the base branch.')
  .option('-r, --rebase', 'Rebase the commits onto the base branch.')
  .option('-s, --squash', 'Squash the commits into one commit.')
  .action((baseBranch, headBranch, options) => {
    const methods = [options.merge, options.rebase, options.squash]
    if (methods.filter(Boolean).length > 1) {
      console.error('Use only one of --merge, --rebase, or --squash.')
      process.exit(1)
    }

    handleError(() =>
      mergePullRequestController(baseBranch, headBranch, {
        ...options,
        mergeMethod: options.merge
          ? 'merge'
          : options.rebase
            ? 'rebase'
            : options.squash
              ? 'squash'
              : undefined,
      })
    )
  })

app
  .command('release')
  .description('Create a GitHub release with AI-generated release notes.')
  .argument('[tag]', 'Release tag to create (asks when omitted).')
  .option(
    '--model <model>',
    'Model key from config to use (overrides the configured model).'
  )
  .option(
    '-y, --yolo',
    'Create the release without asking for confirmation (requires a tag).'
  )
  .option(
    '-f, --force',
    'Recreate the release without asking if it already exists.'
  )
  .option('--major', 'Bump the major version of the latest release.')
  .option('--minor', 'Bump the minor version of the latest release.')
  .option('--patch', 'Bump the patch version of the latest release.')
  .action((tag, options) => {
    const bumps = [options.major, options.minor, options.patch]
    if (bumps.filter(Boolean).length > 1) {
      console.error('Use only one of --major, --minor, or --patch.')
      process.exit(1)
    }

    handleError(() =>
      releaseController(tag, {
        ...options,
        bump: options.major
          ? 'major'
          : options.minor
            ? 'minor'
            : options.patch
              ? 'patch'
              : undefined,
      })
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
