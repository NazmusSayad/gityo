import { exec } from '../shell.js'

export async function getRepoRoot() {
  const output = await exec('git', ['rev-parse', '--show-toplevel'])

  return output.trim()
}

export async function fetchBranchAndTags(branch: string) {
  await exec('git', ['fetch', 'origin', branch, '--tags', '--force'])
}

export async function assertLocalCommitsMatch(
  fromTag: string | null,
  toSha: string,
  githubHashes: string[]
) {
  for (const ref of fromTag === null ? [toSha] : [fromTag, toSha]) {
    try {
      await exec('git', ['cat-file', '-e', `${ref}^{commit}`])
    } catch {
      throw new Error(
        `'${ref}' from GitHub is not in your local repository. Fetch it and try again.`
      )
    }
  }

  const range = fromTag === null ? toSha : `${fromTag}..${toSha}`
  const output = await exec('git', ['rev-list', range])
  const localHashes = output.split('\n').filter((line) => line.length > 0)

  const githubSet = new Set(githubHashes)
  const matches =
    localHashes.length === githubHashes.length &&
    localHashes.every((hash) => githubSet.has(hash))

  if (!matches) {
    throw new Error(
      `Local commits do not match GitHub for ${range}: ${localHashes.length} local, ${githubHashes.length} on GitHub.`
    )
  }
}
