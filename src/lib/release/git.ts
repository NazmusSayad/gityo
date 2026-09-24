import { exec } from '../shell.js'

const FIELD_SEPARATOR = '\x1f'
const RECORD_SEPARATOR = '\x1e'

export type ReleaseCommit = {
  hash: string
  date: string
  authorName: string
  authorEmail: string
  message: string
}

export async function getRepoRoot() {
  const output = await exec('git', ['rev-parse', '--show-toplevel'])

  return output.trim()
}

export async function fetchBranchAndTags(branch: string) {
  await exec('git', ['fetch', 'origin', branch, '--tags', '--force'])
}

export async function getCommitsBetween(
  fromTag: string | null,
  toRef: string
): Promise<ReleaseCommit[]> {
  const range = fromTag === null ? toRef : `${fromTag}..${toRef}`
  const output = await exec('git', [
    'log',
    `--format=%H${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%B${RECORD_SEPARATOR}`,
    range,
  ])

  return output
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash, date, authorName, authorEmail, message] =
        record.split(FIELD_SEPARATOR)
      return { hash, date, authorName, authorEmail, message: message.trim() }
    })
}
