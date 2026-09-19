import { spawn } from 'node:child_process'

export class CommandError extends Error {
  constructor(
    command: string,
    args: string[],
    code: number | null,
    stderr: string
  ) {
    const detail = stderr.trim() || `exited with code ${code ?? 'unknown'}`
    super(`${command} ${args.join(' ')} failed: ${detail}`)
    this.name = 'CommandError'
  }
}

export function exec(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')

    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(toSpawnError(command, error))
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
        return
      }

      reject(new CommandError(command, args, code, stderr))
    })
  })
}

export function execInherit(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })

    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(toSpawnError(command, error))
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new CommandError(command, args, code, ''))
    })
  })
}

function toSpawnError(command: string, error: NodeJS.ErrnoException) {
  if (error.code === 'ENOENT') {
    return new Error(
      `'${command}' was not found. Install it and make sure it is on your PATH.`
    )
  }

  return error
}
