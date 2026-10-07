import { generateMessage, prepareCommit } from './controllers/commit.js'
import { DEFAULT_MAX_DIFF_TOKENS, DEFAULT_PER_FILE_CAP } from './lib/diff.js'
import { getCommitDiff } from './lib/git.js'

export type CommitScope = 'everything' | 'staged-only' | 'staged-or-changes'

export type CommitSession = {
  root: string
  scope: 'staged' | 'all'
  files: string[]
  generateMessage: () => Promise<string>
  commit: (message: string) => Promise<void>
}

export async function createCommitSession(options: {
  cwd: string
  scope?: CommitScope
  model?: string
  style?: string
}): Promise<CommitSession> {
  const prepared = await prepareCommit({
    cwd: options.cwd,
    scope: options.scope ?? 'staged-or-changes',
    model: options.model,
    style: options.style,
  })
  let diff: string | null = null

  return {
    root: prepared.root,
    scope: prepared.diffScope,
    files: prepared.files,

    async generateMessage() {
      if (prepared.files.length === 0) {
        throw new Error('No changed files found.')
      }

      diff ??= await getCommitDiff(prepared.git, prepared.diffScope)

      const message = await generateMessage({
        git: prepared.git,
        scope: prepared.diffScope,
        languageModel: prepared.languageModel,
        style: prepared.style,
        instructions: prepared.instructions,
        diff,
        files: prepared.files,
        perFileCap: prepared.config.perFileCap ?? DEFAULT_PER_FILE_CAP,
        maxDiffTokens: prepared.config.maxDiffTokens ?? DEFAULT_MAX_DIFF_TOKENS,
      })

      if (message.trim().length === 0) {
        throw new Error('The selected model returned an empty commit message.')
      }

      return message.trim()
    },

    async commit(message: string) {
      if (message.trim().length === 0) {
        throw new Error('Commit message cannot be empty.')
      }

      if (prepared.diffScope === 'all') {
        await prepared.git.add(['-A'])
      }

      await prepared.git.commit(message.trim())
    },
  }
}
