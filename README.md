# gityo

`gityo` is a CLI that helps you stage changes, write or generate a commit message, commit, and optionally run a post-commit git action.

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

- lets you choose which changed files to stage
- lets you write your own commit message
- can generate a commit message with AI
- creates the commit for you
- can run a post-commit action like `git push`

## Quick use

Run it inside a git repository:

```bash
gityo
```

Typical flow:

1. Pick files to stage
2. Type a commit message or generate one
3. Create the commit
4. Optionally run the configured post-commit action

## Common commands

```bash
gityo
gityo --stage
gityo --generate
gityo --model fast --generate
gityo --message "fix login redirect bug"
gityo --yolo
```

## AI setup

A configured model is required — gityo won't run without one. Models live in a `models` map in your config file. Each key is a name you can pick with `--model`; the `default` key is used when you don't pass `--model`:

```json
{
  "$schema": "https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json",
  "models": {
    "default": {
      "provider": "openrouter",
      "name": "deepseek/deepseek-chat",
      "apiKeyEnv": "OPENROUTER_API_KEY"
    },
    "fast": {
      "provider": "openai",
      "name": "gpt-4.1-mini",
      "apiKeyEnv": "OPENAI_API_KEY"
    }
  }
}
```

`apiKeyEnv` accepts a single variable name or an array of names, tried in order:

```json
"apiKeyEnv": ["GITYO_API_KEY", "OPENROUTER_API_KEY"]
```

Then use:

```bash
gityo --generate
gityo --model fast --generate
```

Supported providers include OpenAI, Anthropic, Google, OpenRouter, and compatible custom endpoints (a URL as `provider`).

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
      "provider": "openai",
      "name": "gpt-4.1",
      "apiKeyEnv": "OPENAI_API_KEY"
    }
  },
  "autoAcceptMessage": false,
  "postCommand": "push",
  "autoRunPostCommand": false,
  "instructions": "Write short, clear commit messages."
}
```

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

## Good for

- quick everyday commits
- cleaner staging and commit flow
- AI-assisted commit messages without losing control

## Notes

- run it inside a git repo
- if there are no changed files, it exits early
- `--yolo` is the fastest mode and skips the usual prompts
