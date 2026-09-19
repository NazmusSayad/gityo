# gityo

`gityo` writes or generates a commit message for your changes, stages them, and commits. It can then run a post-commit git action.

It replaces the usual sequence of git commands with a single command.

## Install

```bash
npm install -g gityo
```

Or run it without installing globally:

```bash
npx gityo
```

## What it does

- writes or generates a commit message based on your current git state
- stages everything when nothing is staged yet
- creates the commit for you
- can run a post-commit action like `git push`

## Quick use

Run it inside a git repository:

```bash
gityo
```

Typical flow:

1. Generate a commit message (from staged files if any, otherwise all changes)
2. Stage everything if nothing is staged
3. Create the commit
4. Optionally run the configured post-commit action

If you already staged files before running `gityo`, only those are used for the message and committed. Your other changes are left alone.

## Common commands

```bash
gityo
gityo --generate
gityo --model fast --generate
gityo --style concise --generate
gityo --input "fix login redirect bug"
gityo --yolo
```

## Pull requests

gityo also ships two commands for GitHub pull requests. They call the
[GitHub CLI](https://cli.github.com) (`gh`), so `gh` must be installed and
authenticated. They do not inspect your local working tree. The pull request
content comes from the GitHub compare API.

Create a pull request with an AI-generated title and body:

```bash
gityo-pr-create
gityo-pr-create main feature/login
gityo-pr-create --yolo
gityo-pr-create --web
```

The base branch defaults to the repository default branch, and the head branch
defaults to the current branch. gityo generates the title and body from the
commits and diff between the two branches, using the `models` config. Customize
each part with `prTitleInstructions` and `prBodyInstructions`, and gityo follows
the repository's pull request template when one exists.

Create the pull request if needed, then merge it:

```bash
gityo-pr-merge
gityo-pr-merge main feature/login
gityo-pr-merge --yolo
```

`--yolo` skips the review/merge confirmation, and `--model` picks a model key
from your config.

## AI setup

A configured model is required. gityo won't run without one, and it must be able to resolve the API key from your environment even when you pass `--input`. Models live in a `models` map in your config file. Each key is a name you can pick with `--model`; gityo uses the `default` key when you don't pass `--model`:

```json
{
  "$schema": "https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json",
  "models": {
    "default": {
      "npm": "@openrouter/ai-sdk-provider",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "model": "openai/gpt-oss-120b:nitro"
    },
    "fast": {
      "npm": "@ai-sdk/openai",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-5-mini"
    }
  },
  "style": "concise"
}
```

Each model config:

- `npm`: the provider package, one of 30 supported AI SDK providers (autocompleted by the schema). Optional; defaults to `@ai-sdk/openai-compatible`
- `apiKeyEnv`: environment variable(s) holding the API key, tried in order
- `model`: the model ID
- `apiUrl`: optional base URL (required when `npm` is `@ai-sdk/openai-compatible`)
- `options`: extra provider options passed to the provider factory

`apiKeyEnv` accepts a single variable name or an array of names:

```json
"apiKeyEnv": ["GITYO_API_KEY", "OPENROUTER_API_KEY"]
```

OpenAI-compatible example without `npm`:

```json
"local": {
  "apiKeyEnv": "MY_API_KEY",
  "model": "my-model",
  "apiUrl": "https://my-endpoint.example.com/v1"
}
```

Then use:

```bash
gityo --generate
gityo --model fast --generate
gityo --style concise --generate
```

Providers are the official Vercel AI SDK packages: `@ai-sdk/openai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/xai`, `@ai-sdk/azure`, `@ai-sdk/amazon-bedrock`, `@ai-sdk/groq`, `@ai-sdk/mistral`, `@ai-sdk/deepseek`, `@ai-sdk/togetherai`, `@ai-sdk/fireworks`, `@ai-sdk/perplexity`, `@ai-sdk/cohere`, `@ai-sdk/cerebras`, `@ai-sdk/luma`, `@ai-sdk/fal`, `@ai-sdk/deepinfra`, `@ai-sdk/google-vertex`, `@openrouter/ai-sdk-provider`, plus `ai-sdk-ollama`, `ollama-ai-provider-v2`, `workers-ai-provider`, `zhipu-ai-provider`, `sambanova-ai-provider`, `vercel-minimax-ai-provider`, `@aihubmix/ai-sdk-provider`, `ai-gateway-provider`, `@friendliai/ai-provider`, `@helicone/ai-sdk-provider`, and `ai-sdk-provider-opencode-sdk`.

## Config

Show where your config files live:

```bash
gityo config
```

Config is edited by hand in a JSON file. Project config goes in:

```text
.gityo.json
```

Global config goes in:

```text
~/.config/gityo.json
```

You can also add repo-specific writing instructions in:

```text
.gityo.md
```

That file is useful when you want commit messages in a certain tone or format for one project.

Set `$schema` in your config file for editor autocomplete and validation:

```text
https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json
```

Example:

```json
{
  "$schema": "https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json",
  "models": {
    "default": {
      "npm": "@ai-sdk/openai",
      "apiKeyEnv": "OPENAI_API_KEY",
      "model": "gpt-5-nano"
    }
  },
  "style": "concise",
  "styles": {
    "team": "Use conventional commits. Keep the subject under 72 characters.",
    "release": {
      "path": ".gityo/release-style.md"
    }
  },
  "autoAcceptMessage": false,
  "postCommand": "push",
  "autoRunPostCommand": false,
  "instructions": "Write short, clear commit messages.",
  "prTitleInstructions": "Use conventional commit style for the title.",
  "prBodyInstructions": "Keep the description to two short paragraphs.",
  "maxDiffTokens": 24000,
  "perFileCap": 400
}
```

### Commit message styles

Styles control the base commit-message convention sent to the model. Built-in
styles are `default`, `concise`, `explanatory`, `plain`, and `gitmoji`.

- `default` uses conventional commits and adds a body only for substantial,
  multi-part changes that benefit from more context.
- `concise` uses conventional commits and adds a body only when it is essential.
- `explanatory` uses conventional commits and encourages a useful explanatory
  body.
- `plain` produces a short, non-conventional imperative subject line.
- `gitmoji` prefixes a conventional subject with a relevant gitmoji.

Choose a default with `style`, or select one for a command with `--style`:

```bash
gityo --style team --generate
```

Custom `styles` extend the built-ins. A custom style with the same name replaces
the built-in style. A style can be inline text or an object with a `path` to a
prompt file. File paths are passed to Node's `path.resolve()`, so relative paths
resolve from the directory where you run `gityo`.

Style selection priority is `--style`, then config `style`, then `default`.

`instructions` uses the same format. Set it to a string or `{ "path": "..." }`
to load additional instructions from a file.

### Pull request descriptions

`prTitleInstructions` and `prBodyInstructions` guide the generated PR title and
body. Each accepts a string or `{ "path": "..." }`.

gityo also looks for a pull request template at `.github/pull_request_template.md`
and the other standard locations, then asks the model to fill in its sections.
The generated body explains what the change does and why. It does not list
changed files or commits, since that list is already on the GitHub Changes tab.

### Large changes

For a small diff, gityo sends it to the model as-is. When the diff is too large for one request, gityo minimizes it first:

- regenerates the diff with minimal context lines
- drops lock files and minified/generated files from the payload
- caps each file's patch and lists every changed file with its line counts so the model still sees the full picture

If the minimized diff is still too large, gityo summarizes each remaining part in parallel and generates a final commit message from the summaries.

Two optional config knobs control this:

- `maxDiffTokens`: estimated token budget for the diff sent to the model (default `24000`)
- `perFileCap`: max diff lines kept per file when minimizing (default `400`)

Example instructions file:

```md
Use imperative commit messages.
Mention the user-facing change first.
Keep the subject line under 72 characters.
```

Priority is simple:

- `.gityo.md` for repo-specific instructions
- `.gityo.json` for project config
- `~/.config/gityo.json` for your defaults
