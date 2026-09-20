import conciseStyle from './prompts/concise.md?raw'
import defaultStyle from './prompts/default.md?raw'
import explanatoryStyle from './prompts/explanatory.md?raw'
import gitmojiStyle from './prompts/gitmoji.md?raw'
import plainStyle from './prompts/plain.md?raw'
import prBodyConcise from './prompts/pr-body-concise.md?raw'
import prBodyDefault from './prompts/pr-body-default.md?raw'
import prBodyVerbose from './prompts/pr-body-verbose.md?raw'
import prTitleDefault from './prompts/pr-title-default.md?raw'
import prTitlePlain from './prompts/pr-title-plain.md?raw'

export type Prompt = {
  prompt: string
  description: string
}

export const COMMIT_STYLE_PROMPTS: Record<string, Prompt> = {
  default: {
    prompt: defaultStyle,
    description: 'Conventional commits, with a body for large changes',
  },
  concise: {
    prompt: conciseStyle,
    description: 'Conventional commits, with a body only when needed',
  },
  explanatory: {
    prompt: explanatoryStyle,
    description: 'Conventional commits with more detail',
  },
  plain: {
    prompt: plainStyle,
    description: 'One subject line without a prefix',
  },
  gitmoji: {
    prompt: gitmojiStyle,
    description: 'Conventional commits with an emoji',
  },
}

export const PR_TITLE_PROMPTS: Record<string, Prompt> = {
  default: {
    prompt: prTitleDefault,
    description: 'Conventional commits format, type(scope): subject',
  },
  plain: {
    prompt: prTitlePlain,
    description: 'Short imperative title without a prefix or emoji',
  },
}

export const PR_BODY_PROMPTS: Record<string, Prompt> = {
  default: {
    prompt: prBodyDefault,
    description: 'Short bullet points under relevant sections',
  },
  concise: {
    prompt: prBodyConcise,
    description: 'A few sentences or bullets',
  },
  verbose: {
    prompt: prBodyVerbose,
    description: 'Detailed explanations with headings when needed',
  },
}
