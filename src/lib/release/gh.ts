import { exec, execWithOutput } from '../shell.js'

export type Release = {
  tagName: string
  publishedAt: string
}

export async function listReleases(
  cwd: string,
  limit: number
): Promise<Release[]> {
  const output = await exec(
    'gh',
    [
      'release',
      'list',
      '--exclude-drafts',
      '--limit',
      String(limit),
      '--json',
      'tagName,publishedAt',
    ],
    cwd
  )

  const releases = JSON.parse(output) as Release[]

  return releases.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  )
}

export type ReleaseCommit = {
  hash: string
  date: string
  authorName: string
  authorEmail: string
  message: string
}

const COMMIT_JQ =
  '{hash: .sha, date: .commit.author.date, authorName: .commit.author.name, authorEmail: .commit.author.email, message: .commit.message}'

export async function getBranchHeadSha(cwd: string, branch: string) {
  const output = await exec(
    'gh',
    [
      'api',
      `repos/{owner}/{repo}/commits/${encodeURIComponent(branch)}`,
      '--jq',
      '.sha',
    ],
    cwd
  )

  return output.trim()
}

export async function listReleaseCommits(
  cwd: string,
  fromTag: string | null,
  toSha: string
): Promise<ReleaseCommit[]> {
  const args =
    fromTag === null
      ? [
          `repos/{owner}/{repo}/commits?sha=${toSha}&per_page=100`,
          '--jq',
          `.[] | ${COMMIT_JQ}`,
        ]
      : [
          `repos/{owner}/{repo}/compare/${encodeURIComponent(fromTag)}...${toSha}?per_page=100`,
          '--jq',
          `.commits[] | ${COMMIT_JQ}`,
        ]

  const output = await exec('gh', ['api', '--paginate', ...args], cwd)
  const commits = output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ReleaseCommit)

  return fromTag === null ? commits : commits.reverse()
}

export async function releaseExists(cwd: string, tag: string) {
  try {
    await exec('gh', ['release', 'view', tag, '--json', 'tagName'], cwd)
    return true
  } catch {
    return false
  }
}

export async function deleteRelease(
  cwd: string,
  tag: string,
  output: 'inherit' | 'capture'
) {
  await execWithOutput('gh', ['release', 'delete', tag, '--yes'], cwd, output)
  await execWithOutput(
    'gh',
    [
      'api',
      '--method',
      'DELETE',
      `repos/{owner}/{repo}/git/refs/tags/${encodeURIComponent(tag)}`,
    ],
    cwd,
    output
  )
}

export async function createRelease(
  cwd: string,
  input: {
    tag: string
    target: string
    notes: string
  },
  output: 'inherit' | 'capture'
) {
  await execWithOutput(
    'gh',
    [
      'release',
      'create',
      input.tag,
      '--target',
      input.target,
      '--notes',
      input.notes,
    ],
    cwd,
    output
  )
}
