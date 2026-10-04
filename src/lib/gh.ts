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
  commits: { oid: string }[]
}

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
  const pullRequests = await ghJson<PullRequestResult[]>([
    'pr',
    'list',
    '--state',
    'open',
    '--base',
    base,
    '--head',
    head,
    '--limit',
    '100',
    '--json',
    'number,url,baseRefName,headRefName,commits',
  ])

  const matches = pullRequests.filter(
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
    commitCount: match.commits.length,
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
