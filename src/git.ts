import { execa } from 'execa'
import type { PostCommand, RepositoryState } from './types'

export async function getRepositoryState(
  cwd = process.cwd()
): Promise<RepositoryState> {
  await ensureGitRepository(cwd)

  const [branch, unstagedFiles, stagedFiles, untrackedFiles] =
    await Promise.all([
      getBranchName(cwd),
      getChangedPaths(
        ['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z'],
        cwd
      ),
      getChangedPaths(
        ['diff', '--cached', '--name-only', '--diff-filter=ACDMRTUXB', '-z'],
        cwd
      ),
      getChangedPaths(
        ['ls-files', '--others', '--exclude-standard', '-z'],
        cwd
      ),
    ])

  const files = Array.from(
    new Set([...unstagedFiles, ...stagedFiles, ...untrackedFiles])
  ).sort((left, right) => left.localeCompare(right))

  return {
    branch,
    files,
  }
}

export async function stageFiles(files: string[], cwd = process.cwd()) {
  if (files.length === 0) {
    return
  }

  await runGit(['add', '--', ...files], cwd)
}

export async function getStagedDiff(cwd = process.cwd()) {
  const result = await runGit(['diff', '--cached', '--no-ext-diff'], cwd)

  return result.stdout
}

export async function commitChanges(message: string, cwd = process.cwd()) {
  await execa('git', ['commit', '-m', message], {
    cwd,
    stdio: 'inherit',
  })
}

export async function runPostCommand(
  postCommand: PostCommand,
  cwd = process.cwd()
) {
  const commands =
    postCommand === 'push' ? [['push']] : [['push'], ['pull', '--rebase']]

  for (const command of commands) {
    await execa('git', command, {
      cwd,
      stdio: 'inherit',
    })
  }
}

export function getPostCommandLabel(postCommand: PostCommand) {
  return postCommand === 'push' ? 'git push' : 'git push && git pull --rebase'
}

async function ensureGitRepository(cwd: string) {
  const result = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd,
    reject: false,
  })

  if (result.exitCode !== 0 || result.stdout.trim() !== 'true') {
    throw new Error('gityo must be run inside a git repository.')
  }
}

async function getBranchName(cwd: string) {
  const result = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  const branchName = result.stdout.trim()

  return branchName === 'HEAD' ? '(detached HEAD)' : branchName
}

async function getChangedPaths(args: string[], cwd: string) {
  const result = await runGit(args, cwd)

  return parseNullSeparatedLines(result.stdout)
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

function parseNullSeparatedLines(value: string) {
  return value.split('\0').filter(Boolean)
}
