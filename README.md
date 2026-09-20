# gityo

AI-generated commit messages and GitHub pull requests from your changes.

- Review generated commit messages, commit, and push.
- Generate PR titles and descriptions, create PRs, and merge them.
- Choose from 31 provider SDKs through the [Vercel AI SDK](https://ai-sdk.dev).

## Setup

```bash
npm install -g gityo
```

Create `~/.config/gityo.json` with your model:

```json
{
  "$schema": "https://github.com/NazmusSayad/gityo/raw/refs/heads/schema/schema.json",
  "models": {
    "default": {
      "npm": "@openrouter/ai-sdk-provider",
      "apiKeyEnv": "OPENROUTER_API_KEY",
      "model": "openai/gpt-oss-120b:nitro"
    }
  }
}
```

Set the API key in your shell:

```bash
export OPENROUTER_API_KEY="your-api-key"
```

## Supported SDKs

Set your model's `npm` field to one of these packages:

### Vercel provider packages

- `@ai-sdk/openai`
- `@ai-sdk/openai-compatible`
- `@ai-sdk/anthropic`
- `@ai-sdk/google`
- `@ai-sdk/google-vertex`
- `@ai-sdk/xai`
- `@ai-sdk/azure`
- `@ai-sdk/amazon-bedrock`
- `@ai-sdk/groq`
- `@ai-sdk/mistral`
- `@ai-sdk/togetherai`
- `@ai-sdk/cohere`
- `@ai-sdk/fireworks`
- `@ai-sdk/deepseek`
- `@ai-sdk/cerebras`
- `@ai-sdk/perplexity`
- `@ai-sdk/fal`
- `@ai-sdk/deepinfra`
- `@ai-sdk/luma`

### Community provider packages

- `@openrouter/ai-sdk-provider`
- `ollama-ai-provider-v2`
- `ai-sdk-ollama`
- `vercel-minimax-ai-provider`
- `@aihubmix/ai-sdk-provider`
- `ai-gateway-provider`
- `workers-ai-provider`
- `@friendliai/ai-provider`
- `@helicone/ai-sdk-provider`
- `ai-sdk-provider-opencode-sdk`
- `sambanova-ai-provider`
- `zhipu-ai-provider`

For an OpenAI-compatible endpoint, use `@ai-sdk/openai-compatible` and set `apiUrl` to its base URL.

## Commits

Run inside a git repository:

```bash
gityo
```

- Review the generated message before committing.
- Commit staged files, or all changes if nothing is staged.
- Choose whether to push afterward.
- Use `--yolo` to skip confirmations.

## Pull requests

Requires [GitHub CLI](https://cli.github.com) with `gh auth login` completed.

- `gityo-pr-create` generates a title and body for review, then creates the PR.
- `gityo-pr-merge` merges the PR, creating it first if needed.
- Both use the current branch and the repository's default base branch unless you specify branches.
- PRs use pushed commits. For uncommitted changes on the current head branch, gityo offers to commit and push first.

## Customization

Styles control how commit messages, PR titles, and PR bodies are written. Choose a built-in style or supply your own writing instructions, with separate defaults for each.

- Add `.gityo.json` to a repository for project-specific settings.
- Add `.gityo.md` for project-specific commit instructions.
- Run `gityo config` to see config locations.
- Use the config schema for available settings and `--help` on each command for its options.
