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
