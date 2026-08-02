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

export async function getChangedFiles(git: SimpleGit) {
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

export async function getCommitDiff(git: SimpleGit) {
  const staged = await git.raw(['diff', '--cached', '--no-ext-diff'])

  if (staged.trim().length > 0) {
    return { diff: staged, hasStaged: true }
  }

  const [unstaged, untracked] = await Promise.all([
    git.raw(['diff', '--no-ext-diff']),
    git.raw(['ls-files', '--others', '--exclude-standard', '-z']),
  ])

  const untrackedDiffs = await Promise.all(
    splitNull(untracked).map((file) =>
      git.raw(['diff', '--no-index', '--', '/dev/null', file])
    )
  )

  return {
    diff: [unstaged, ...untrackedDiffs]
      .filter((part) => part.length > 0)
      .join('\n'),
    hasStaged: false,
  }
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
