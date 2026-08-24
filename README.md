# gityo

`gityo` is a CLI that writes or generates a commit message for your changes, stages them, creates the commit, and optionally runs a post-commit git action.

It is built for people who want a faster commit flow without turning git into a wall of commands.

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

1. Write a commit message or generate one (from staged files if any, otherwise all changes)
2. Stage everything if nothing is staged
3. Create the commit
4. Optionally run the configured post-commit action

If you already staged files before running `gityo`, only those are used for the message and committed — your other changes are left alone.

## Common commands

```bash
gityo
gityo --generate
gityo --model fast --generate
gityo --style concise --generate
gityo --input "fix login redirect bug"
gityo --yolo
```

## AI setup

A configured model is required — gityo won't run without one, and the API key must be resolvable from your environment even when you pass `--input`. Models live in a `models` map in your config file. Each key is a name you can pick with `--model`; the `default` key is used when you don't pass `--model`:

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

- `npm` — the provider package, one of 30 supported AI SDK providers (autocompleted by the schema). Optional; defaults to `@ai-sdk/openai-compatible`
- `apiKeyEnv` — environment variable(s) holding the API key, tried in order
- `model` — the model ID
- `apiUrl` — optional base URL (required when `npm` is `@ai-sdk/openai-compatible`)
- `options` — extra provider options passed to the provider factory

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
.gityo.config.json
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
  "maxDiffTokens": 24000,
  "perFileCap": 400
}
```

### Commit message styles

Styles control the base commit-message convention sent to the model. Built-in
styles are `default`, `concise`, and `explanatory`. `default` uses conventional
commits with an optional explanatory body, `concise` always produces a single
subject line, and `explanatory` allows a longer subject and explanatory body.

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

### Large changes

When the diff is small, it is sent to the model as-is. When it is too large for one request, gityo minimizes it first:

- regenerates the diff with minimal context lines
- drops lock files and minified/generated files from the payload
- caps each file's patch and lists every changed file with its line counts so the model still sees the full picture

If the minimized diff is still too large, each remaining part is summarized in parallel and a final commit message is generated from those summaries.

Two optional config knobs control this:

- `maxDiffTokens` — estimated token budget for the diff sent to the model (default `24000`)
- `perFileCap` — max diff lines kept per file when minimizing (default `400`)

Example instructions file:

```md
Use imperative commit messages.
Mention the user-facing change first.
Keep the subject line under 72 characters.
```

Priority is simple:

- `.gityo.md` for repo-specific instructions
- `.gityo.config.json` for project config
- `~/.config/gityo.json` for your defaults
