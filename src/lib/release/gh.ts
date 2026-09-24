import { exec, execInherit } from '../shell.js'

export type Release = {
  tagName: string
  publishedAt: string
}

export async function listReleases(limit: number): Promise<Release[]> {
  const output = await exec('gh', [
    'release',
    'list',
    '--exclude-drafts',
    '--limit',
    String(limit),
    '--json',
    'tagName,publishedAt',
  ])

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

export async function getBranchHeadSha(branch: string) {
  const output = await exec('gh', [
    'api',
    `repos/{owner}/{repo}/commits/${encodeURIComponent(branch)}`,
    '--jq',
    '.sha',
  ])

  return output.trim()
}

export async function listReleaseCommits(
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

  const output = await exec('gh', ['api', '--paginate', ...args])
  const commits = output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ReleaseCommit)

  return fromTag === null ? commits : commits.reverse()
}

export async function releaseExists(tag: string) {
  try {
    await exec('gh', ['release', 'view', tag, '--json', 'tagName'])
    return true
  } catch {
    return false
  }
}

export async function deleteRelease(tag: string) {
  await execInherit('gh', ['release', 'delete', tag, '--yes'])
  await execInherit('gh', [
    'api',
    '--method',
    'DELETE',
    `repos/{owner}/{repo}/git/refs/tags/${encodeURIComponent(tag)}`,
  ])
}

export async function createRelease(input: {
  tag: string
  target: string
  notes: string
}) {
  await execInherit('gh', [
    'release',
    'create',
    input.tag,
    '--target',
    input.target,
    '--notes',
    input.notes,
  ])
}
