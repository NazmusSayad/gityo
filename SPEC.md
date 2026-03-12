# gityo CLI Spec

## Purpose

`gityo` is a CLI that helps developers stage changes, generate or enter a commit message, create the commit, and optionally run a post-commit git command.

## Core Workflow

### 1. Start

Run:

```bash
gityo
```

### 2. Stage Changes

Show the current branch and changed files.

Initial example:

```text
branch: feature/auth

changes:
[ ] auth.js
[ ] userService.js
[ ] middleware/authGuard.js
```

Controls:

```text
↑ ↓   move
space select / deselect
enter confirm
```

Rules:

- If the user confirms with no files selected, stage all changed files.
- The interface must allow selecting a subset of files before commit generation.

Selected example:

```text
branch: feature/auth

changes:
[x] auth.js
[x] userService.js
[ ] middleware/authGuard.js
```

### 3. Enter or Generate Commit Message

After staging:

- Prompt the user to enter a commit message.
- If the user enters a message, use it directly.
- If the user gives no message and presses `enter`, generate one from the staged diff using the selected model.
- Pressing `tab` switches the active model during message generation.

If the message is AI-generated:

- Show the generated message and ask for confirmation.
- `y` or `enter`: accept and commit.
- `n`: exit without committing.
- `r`: regenerate the message.

Then run:

```bash
git commit -m "<message>"
```

### 4. Run Post Command

After a successful commit, run a configurable post command.

Default:

```bash
git push
```

Notes:

- The config allows `postCommand` values `push` and `push-and-pull`.
- The original spec names these values but does not define the exact git command for `push-and-pull`.

## Configuration

Use a JSON config file.

### Config Fields (~/.config/gityo.json)

- `models`: record of available model groups.
  - Keys: `openai`, `anthropic`, `openrouter`, or a custom base URL.
  - Values: arrays of model names (string) or (object, with `name`, `reasoning` properties).
- `defaultModel`: model used by default for commit message generation.
- `autoAcceptCommitMessage`: if `true`, accept generated commit messages automatically; otherwise ask for confirmation.
- `postCommand`: `push` or `push-and-pull`.
- `autoRunPostCommand`: if `true`, run the post command automatically; otherwise prompt first.
- `customInstructions`: optional string of custom instructions to include in the prompt for commit message generation.

#### Project Level Config (.gityo.config.json)

- Same structure as the global config.
- Overrides global config when present.

#### Project Level Instructions (.gityo.instructions.md)

- Optional markdown file for project-specific instructions.
- Overrides `customInstructions` in the JSON config (both global and project-level) when present.

## API Key Management

API keys must not be stored in the JSON config file.

Requirements:

- Prompt for an API key when a selected model requires one and no saved key exists.
- Save the key in a secure local store.
- Reuse the saved key for future runs.
- Support updating keys through the CLI.
- Do not save API keys in the JSON config file.

Commands:

```bash
gityo models set openai sk-xxxx
gityo models set https://custom-base-url sk-xxxx
gityo models set
gityo models list
```

Rules:

- `gityo models set` with no arguments opens an interactive prompt.
- `gityo models list` lists models together with their associated keys, with keys masked for security.

## Dependencies

Use these packages:

- `ai` for LLM integration `https://ai-sdk.dev`.
- `https://ai-sdk.dev/providers/ai-sdk-providers/openai` for OpenAI models.
- `https://ai-sdk.dev/providers/ai-sdk-providers/anthropic` for Anthropic models.
- `https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai` for Google models.
- `https://ai-sdk.dev/providers/openai-compatible-providers` for custom base URL models.
- `noarg` for argument parsing: `https://www.npmjs.com/package/noarg`.
- `@inquirer/prompts` for interactive prompts.
- `chalk` for terminal colors.
- `zod` for config validation.

Dependency rule:

- Add all dependencies as dev dependencies because the CLI will be compiled before publishing.

## Testing Guidance

- Create a Docker-based test environment for reliability checks.
- Authentication is not required for test environments.
- Git behavior may be faked or mocked to verify CLI flow safely.
- DO NOT RUN ANY TESTS AGAINST A REAL GIT REPO TO AVOID DATA LOSS.
