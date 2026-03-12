import { execa } from 'execa'
import type { z } from 'zod'
import { postCommandSchema } from '../schema'

export async function stageFiles(files: string[], cwd = process.cwd()) {
  if (files.length === 0) {
    return
  }

  await runGit(['add', '--', ...files], cwd)
}

export async function getStagedDiff(cwd = process.cwd()) {
  return (await runGit(['diff', '--cached', '--no-ext-diff'], cwd)).stdout
}

export async function commitChanges(message: string, cwd = process.cwd()) {
  await execa('git', ['commit', '-m', message], {
    cwd,
    stdio: 'inherit',
  })
}

export async function runPostCommand(
  postCommand: z.infer<typeof postCommandSchema>,
  cwd = process.cwd()
) {
  await execa('git', ['push'], {
    cwd,
    stdio: 'inherit',
  })

  if (postCommand === 'push-and-pull') {
    await execa('git', ['pull', '--rebase'], {
      cwd,
      stdio: 'inherit',
    })
  }
}

async function runGit(args: string[], cwd: string) {
  const result = await execa('git', args, {
    cwd,
    reject: false,
  })

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'Git command failed.')
  }

  return result
}
