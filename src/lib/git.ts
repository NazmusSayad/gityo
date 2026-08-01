import { simpleGit } from 'simple-git'
import type { ResolvedConfig } from '../schema'

export async function ensureInsideGitRepo(cwd = process.cwd()) {
  if (!(await createGit(cwd).checkIsRepo())) {
    throw new Error('gityo must be run inside a git repository.')
  }
}

export async function getRepositoryRoot(cwd = process.cwd()) {
  try {
    return (await createGit(cwd).revparse(['--show-toplevel'])).trim()
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message.trim() || 'Failed to resolve git repository root.'
        : 'Failed to resolve git repository root.'
    )
  }
}

export async function getCurrentBranch(cwd = process.cwd()) {
  const summary = await createGit(cwd).branch()

  return summary.detached ? '(detached HEAD)' : summary.current
}

export async function getChangedFiles(cwd = process.cwd()) {
  const git = createGit(cwd)
  const [unstaged, staged, untracked] = await Promise.all([
    git.raw(['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z']),
    git.raw([
      'diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACDMRTUXB',
      '-z',
    ]),
    git.raw(['ls-files', '--others', '--exclude-standard', '-z']),
  ])

  return Array.from(
    new Set([
      ...splitNull(staged),
      ...splitNull(unstaged),
      ...splitNull(untracked),
    ])
  ).sort((left, right) => left.localeCompare(right))
}

export async function stageFiles(files: string[], cwd = process.cwd()) {
  if (files.length === 0) {
    return
  }

  await createGit(cwd).add(files)
}

export async function getStagedDiff(cwd = process.cwd()) {
  return createGit(cwd).raw(['diff', '--cached', '--no-ext-diff'])
}

export async function commitChanges(message: string, cwd = process.cwd()) {
  await createGit(cwd, true).commit(message)
}

export async function runPostCommand(
  postCommand: ResolvedConfig['postCommand'],
  cwd = process.cwd()
) {
  const git = createGit(cwd, true)

  await git.push()

  if (postCommand === 'push-and-pull') {
    await git.pull(['--rebase'])
  }
}

function splitNull(output: string) {
  return output.split('\0').filter(Boolean)
}

function createGit(cwd: string, live = false) {
  const git = simpleGit({ baseDir: cwd })

  if (live) {
    git.outputHandler((_, stdout, stderr) => {
      stdout.pipe(process.stdout)
      stderr.pipe(process.stderr)
    })
  }

  return git
}
