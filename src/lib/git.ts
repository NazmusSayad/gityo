import { execa } from 'execa'
import type { z } from 'zod'
import { postCommandSchema } from '../schema'

export async function ensureInsideGitRepo(cwd = process.cwd()) {
  const result = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    reject: false,
  })

  if (result.exitCode !== 0 || result.stdout.trim() !== 'true') {
    throw new Error('gityo must be run inside a git repository.')
  }
}

export async function getCurrentBranch(cwd = process.cwd()) {
  const result = await execa(
    'git',
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    {
      cwd,
      reject: false,
    }
  )

  if (result.exitCode === 0) {
    return result.stdout.trim()
  }

  if (result.exitCode === 1) {
    return '(detached HEAD)'
  }

  throw new Error(result.stderr.trim() || 'Git command failed.')
}

export async function getChangedFiles(cwd = process.cwd()) {
  const [unstagedResult, stagedResult, untrackedResult] = await Promise.all([
    runGit(['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z'], cwd),
    runGit(
      ['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB', '-z'],
      cwd
    ),
    runGit(['ls-files', '--others', '--exclude-standard', '-z'], cwd),
  ])

  return Array.from(
    new Set([
      ...unstagedResult.stdout.split('\0').filter(Boolean),
      ...stagedResult.stdout.split('\0').filter(Boolean),
      ...untrackedResult.stdout.split('\0').filter(Boolean),
    ])
  ).sort((left, right) => left.localeCompare(right))
}

export async function stageFiles(files: string[], cwd = process.cwd()) {
  if (files.length === 0) {
    return
  }

  await runGit(['add', '--', ...files], cwd)
}

export async function getStagedDiff(cwd = process.cwd()) {
  return (await runGit(['diff', '--cached', '--no-ext-diff'], cwd)).stdout
}

export async function commitChanges(message: string, cwd = process.cwd()) {
  await execa('git', ['commit', '-m', message], {
    cwd,
    stdio: 'inherit',
  })
}

export async function runPostCommand(
  postCommand: z.infer<typeof postCommandSchema>,
  cwd = process.cwd()
) {
  await execa('git', ['push'], {
    cwd,
    stdio: 'inherit',
  })

  if (postCommand === 'push-and-pull') {
    await execa('git', ['pull', '--rebase'], {
      cwd,
      stdio: 'inherit',
    })
  }
}

async function runGit(args: string[], cwd: string) {
  const result = await execa('git', args, {
    cwd,
    reject: false,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Git command failed.')
  }

  return result
}
