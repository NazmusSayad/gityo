import { simpleGit, type SimpleGit } from 'simple-git'

export async function getGit(cwd = process.cwd()) {
  const probe = simpleGit({ baseDir: cwd })

  if (!(await probe.checkIsRepo())) {
    throw new Error('gityo must be run inside a git repository.')
  }

  const root = (await probe.revparse(['--show-toplevel'])).trim()

  return {
    git: simpleGit({ baseDir: root }),
    liveGit: createLiveGit(root),
  }
}

export type DiffScope = 'staged' | 'all'

export async function getStagedFiles(git: SimpleGit) {
  const staged = await git.raw([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACDMRTUXB',
    '-z',
  ])

  return splitNull(staged).sort((left, right) => left.localeCompare(right))
}

export async function getChangedFiles(git: SimpleGit) {
  const [unstaged, staged, untracked] = await Promise.all([
    git.raw(['diff', '--name-only', '--diff-filter=ACDMRTUXB', '-z']),
    getStagedFiles(git),
    git.raw(['ls-files', '--others', '--exclude-standard', '-z']),
  ])

  return Array.from(
    new Set([...staged, ...splitNull(unstaged), ...splitNull(untracked)])
  ).sort((left, right) => left.localeCompare(right))
}

export async function getCommitDiff(
  git: SimpleGit,
  scope: DiffScope,
  contextLines = 3
) {
  const unified = [`-U${contextLines}`]
  const staged = await git.raw([
    'diff',
    '--cached',
    '--no-ext-diff',
    ...unified,
  ])

  if (scope === 'staged') {
    return staged
  }

  if (scope !== 'all') {
    throw new Error(`Unknown commit scope '${scope as string}'.`)
  }

  const hasStaged = staged.trim().length > 0
  const [unstaged, untracked] = await Promise.all([
    git.raw([
      'diff',
      ...(hasStaged ? ['HEAD'] : []),
      '--no-ext-diff',
      ...unified,
    ]),
    git.raw(['ls-files', '--others', '--exclude-standard', '-z']),
  ])

  const untrackedDiffs = await Promise.all(
    splitNull(untracked).map((file) =>
      git.raw(['diff', '--no-index', ...unified, '--', '/dev/null', file])
    )
  )

  return [unstaged, ...untrackedDiffs]
    .filter((part) => part.length > 0)
    .join('\n')
}

function splitNull(output: string) {
  return output.split('\0').filter(Boolean)
}

function createLiveGit(baseDir: string): SimpleGit {
  const git = simpleGit({ baseDir })

  git.outputHandler((_, stdout, stderr) => {
    stdout.pipe(process.stdout)
    stderr.pipe(process.stderr)
  })

  return git
}
