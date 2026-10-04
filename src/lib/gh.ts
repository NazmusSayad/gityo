import { exec, execInherit } from './shell.js'

export type PullRequest = {
  number: number
  url: string
  baseRefName: string
  headRefName: string
  commitCount: number
}

type PullRequestResult = {
  number: number
  url: string
  baseRefName: string
  headRefName: string
  commits: { totalCount: number }
}

type PullRequestQueryResult = {
  data: {
    repository: {
      pullRequests: {
        nodes: PullRequestResult[]
      }
    }
  }
}

const PULL_REQUEST_QUERY = `
  query($owner: String!, $name: String!, $base: String!, $head: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 100, states: OPEN, baseRefName: $base, headRefName: $head) {
        nodes {
          number
          url
          baseRefName
          headRefName
          commits { totalCount }
        }
      }
    }
  }
`

type CompareFile = {
  filename: string
  previousFilename?: string
  status: string
  additions: number
  deletions: number
  patch?: string
}

export type CompareResult = {
  commits: { sha: string; commit: { message: string } }[]
  files?: CompareFile[]
}

export async function getDefaultBranch() {
  const output = await exec('gh', [
    'repo',
    'view',
    '--json',
    'defaultBranchRef',
    '--jq',
    '.defaultBranchRef.name',
  ])

  return output.trim()
}

export async function fetchCompare(base: string, head: string) {
  return ghJson<CompareResult>([
    'api',
    `repos/{owner}/{repo}/compare/${base}...${head}`,
  ])
}

export async function findPullRequest(base: string, head: string) {
  const result = await ghJson<PullRequestQueryResult>([
    'api',
    'graphql',
    '-f',
    `query=${PULL_REQUEST_QUERY}`,
    '-F',
    'owner={owner}',
    '-F',
    'name={repo}',
    '-F',
    `base=${base}`,
    '-F',
    `head=${head}`,
  ])
  const matches = result.data.repository.pullRequests.nodes.filter(
    (pullRequest) =>
      pullRequest.baseRefName === base && pullRequest.headRefName === head
  )

  if (matches.length === 0) {
    return null
  }

  if (matches.length > 1) {
    throw new Error(`Multiple open pull requests found for ${base} <- ${head}.`)
  }

  const match = matches[0]

  return {
    number: match.number,
    url: match.url,
    baseRefName: match.baseRefName,
    headRefName: match.headRefName,
    commitCount: match.commits.totalCount,
  }
}

export async function createPullRequest(input: {
  title: string
  body: string
  base: string
  head: string
}) {
  return exec('gh', [
    'pr',
    'create',
    '--title',
    input.title,
    '--body',
    input.body,
    '--assignee',
    '@me',
    '--base',
    input.base,
    '--head',
    input.head,
  ])
}

export type MergeMethod = 'merge' | 'rebase' | 'squash'

export async function mergePullRequest(number: number, method: MergeMethod) {
  await execInherit('gh', ['pr', 'merge', String(number), `--${method}`])
}

export async function openPullRequest(number: number) {
  await execInherit('gh', ['pr', 'view', String(number), '--web'])
}

async function ghJson<T>(args: string[]): Promise<T> {
  return JSON.parse(await exec('gh', args)) as T
}
