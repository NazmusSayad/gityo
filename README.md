# gityo

`gityo` commits your changes with a message written by an AI model. You review the message, and gityo stages, commits, and offers to push.

## Install

```bash
npm install -g gityo
```

Or run it without a global install:

```bash
npx gityo
```

gityo needs a model in its config before the first run. See [AI setup](#ai-setup).

## Usage

Run it inside a git repository:

```bash
gityo
```

Here's what happens:

1. gityo reads your changes. If you staged files, it reads only those. Otherwise it reads every change, including untracked files.
2. The model writes a commit message. You accept it or ask for a new one.
3. If nothing was staged, gityo runs `git add -A`.
4. gityo commits.
5. gityo asks whether to run the post-commit command, which is `git push` by default.

If you staged some files before running `gityo`, it commits only those and leaves the rest of your changes alone.

Flags change how much it asks:

- `gityo --generate` commits the generated message without asking you to review it.
- `gityo --input "fix login redirect bug"` commits your own message instead.
- `gityo --post` runs the post-commit command without asking.
- `gityo --yolo` does both `--generate` and `--post`. No questions.
- `gityo --model fast` uses the `fast` model from your config.
- `gityo --style concise` uses a different message style. See [Commit message styles](#commit-message-styles).

## Pull requests

Two more commands work with GitHub pull requests. Both need the [GitHub CLI](https://cli.github.com) (`gh`) installed and logged in. They read the commits and diff from GitHub's compare API, not from your working tree, so push your branch first.

`gityo-pr-create` opens a pull request with a generated title and body:

```bash
gityo-pr-create
gityo-pr-create main feature/login
gityo-pr-create --yolo
gityo-pr-create --web
```

With no arguments, the base is the repository's default branch and the head is your current branch. Pass two branch names to set both. `--yolo` creates the pull request without showing you the title and body first. `--web` opens the pull request in your browser afterward. If one already exists for those branches, `--web` opens that one.

`gityo-pr-merge` merges a pull request and creates it first if it doesn't exist:

```bash
gityo-pr-merge
gityo-pr-merge main feature/login
gityo-pr-merge --yolo
```

Here `--yolo` skips both the title and body review and the merge confirmation.

Both commands also take `--model`, `--title-style`, and `--body-style`.

The body says what the change does and why. It doesn't list changed files or commits, because GitHub already shows those on the Changes tab.

## AI setup

gityo won't run without a model, and the model's API key must be set in your environment. This applies even when you pass `--input`.

Put models in the `models` map of your config. Each key is a name you can pass to `--model`. Without `--model`, gityo uses `default`.

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

Each model has these fields:

- `model` is the model ID.
- `apiKeyEnv` is the environment variable that holds the API key.
- `npm` is the provider package. It defaults to `@ai-sdk/openai-compatible`.
- `apiUrl` is the provider's base URL. You need it for `@ai-sdk/openai-compatible`.
- `options` is passed to the provider's create function, such as `createOpenAI()`.

`apiKeyEnv` can also be a list. gityo uses the first variable that's set:

```json
"apiKeyEnv": ["GITYO_API_KEY", "OPENROUTER_API_KEY"]
```

For any OpenAI-compatible endpoint, leave out `npm` and set `apiUrl`:

```json
"local": {
  "apiKeyEnv": "MY_API_KEY",
  "model": "my-model",
  "apiUrl": "https://my-endpoint.example.com/v1"
}
```

gityo supports 31 providers, and the schema autocompletes their names in `npm`.

The Vercel AI SDK packages are `@ai-sdk/openai`, `@ai-sdk/openai-compatible`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/google-vertex`, `@ai-sdk/xai`, `@ai-sdk/azure`, `@ai-sdk/amazon-bedrock`, `@ai-sdk/groq`, `@ai-sdk/mistral`, `@ai-sdk/deepseek`, `@ai-sdk/togetherai`, `@ai-sdk/fireworks`, `@ai-sdk/perplexity`, `@ai-sdk/cohere`, `@ai-sdk/cerebras`, `@ai-sdk/luma`, `@ai-sdk/fal`, and `@ai-sdk/deepinfra`.

The other packages are `@openrouter/ai-sdk-provider`, `ai-sdk-ollama`, `ollama-ai-provider-v2`, `workers-ai-provider`, `zhipu-ai-provider`, `sambanova-ai-provider`, `vercel-minimax-ai-provider`, `@aihubmix/ai-sdk-provider`, `ai-gateway-provider`, `@friendliai/ai-provider`, `@helicone/ai-sdk-provider`, and `ai-sdk-provider-opencode-sdk`.

## Config

gityo reads three files. You edit them by hand.

- `~/.config/gityo.json` is your global config.
- `.gityo.json` in the repository root is the project config. Its keys override the global ones.
- `.gityo.md` in the repository root holds writing instructions for that project. It replaces the `instructions` key from both JSON files.

The override is shallow. A `models` map in `.gityo.json` replaces your global `models` entirely instead of adding to it. The same goes for `styles`.

To print the config paths, run:

```bash
gityo config
```

Set `$schema` in your config for autocomplete and validation in your editor:

```text
https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json
```

Here's a config with every key:

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
  "prTitleStyle": "conventional",
  "prBodyStyle": "concise",
  "maxDiffTokens": 24000,
  "perFileCap": 400
}
```

Keys not covered in other sections:

- `autoAcceptMessage` commits the generated message without asking, like `--generate`. Defaults to `false`.
- `postCommand` is `"push"`, `"push-and-pull"`, or `null` to skip it. Defaults to `"push"`.
- `autoRunPostCommand` runs the post-commit command without asking, like `--post`. Defaults to `false`.
- `instructions` adds your own guidance to the commit prompt. Use a string or `{ "path": "..." }` to load it from a file.

A `.gityo.md` file looks like this:

```md
Use imperative commit messages.
Mention the user-facing change first.
Keep the subject line under 72 characters.
```

### Commit message styles

A style is the base commit convention gityo asks the model to follow. There are five built in:

- `default` uses conventional commits. It adds a body only for large changes with several parts.
- `concise` uses conventional commits and adds a body only when the subject can't carry the change alone.
- `explanatory` uses conventional commits and usually adds a body explaining the change.
- `plain` writes one short imperative subject line with no conventional prefix.
- `gitmoji` puts a gitmoji in front of a conventional subject.

gityo picks the style from `--style`, then the `style` key, then falls back to `default`:

```bash
gityo --style team --generate
```

Add your own under `styles`. A style is either inline text or `{ "path": "..." }` pointing to a prompt file. If you name one after a built-in, yours replaces it. gityo resolves `path` from the directory you run it in, not from the config file's location.

### Pull request styles

Pull request titles and bodies have their own styles.

Title styles:

- `default` is a short, specific imperative title.
- `conventional` uses the conventional commits format, `type(scope): subject`.

Body styles:

- `default` explains what the pull request does and why.
- `concise` uses a few short sentences or bullets.
- `verbose` goes into detail and adds headings when the change has separate parts.

Set defaults with `prTitleStyle` and `prBodyStyle`, or pick per run:

```bash
gityo-pr-create --title-style conventional --body-style concise
```

Custom styles go under `prTitleStyles` and `prBodyStyles`. They work like commit `styles`.

### Large changes

gityo sends the whole diff when it fits in `maxDiffTokens`, which defaults to 24000. gityo estimates tokens as 4 characters each.

When the diff is too big, gityo shrinks it:

- It regenerates the diff with 1 line of context instead of 3.
- It drops lock files, minified JS and CSS, and source maps.
- It cuts each file's patch to `perFileCap` lines, which defaults to 400.
- It adds a list of every changed file with its line counts, so the model still knows what the whole change touches.

If the diff still doesn't fit, gityo splits it into chunks and summarizes three at a time. The model then writes the commit message from those summaries. Expect a very large commit to take a few extra requests.
