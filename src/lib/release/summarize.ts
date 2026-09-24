import { generateText, type LanguageModel } from 'ai'

const MAP_CONCURRENCY = 3

export async function summarizeChunks(
  languageModel: LanguageModel,
  instructions: string,
  chunks: string[]
) {
  const summaries = new Array<string>(chunks.length)
  let nextChunk = 0

  async function worker() {
    while (nextChunk < chunks.length) {
      const index = nextChunk++
      const result = await generateText({
        model: languageModel,
        instructions,
        messages: [{ role: 'user', content: chunks[index] }],
      })
      summaries[index] = result.text.trim()
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAP_CONCURRENCY, chunks.length) }, worker)
  )

  return summaries
    .map((summary, index) => `Part ${index + 1}:\n${summary}`)
    .join('\n\n')
}
