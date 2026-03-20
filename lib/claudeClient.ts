import Anthropic from '@anthropic-ai/sdk'

export function buildClaudePrompt(productName: string, imageBase64: string | null) {
  const textContent = {
    type: 'text' as const,
    text: `Write a compelling, professional product description for this item.
Product name: "${productName}"
Requirements: 50-80 words, focus on benefits and quality, no bullet points, no markdown.
Return ONLY the description text, nothing else.`,
  }

  const content = imageBase64
    ? [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: imageBase64 } },
        textContent,
      ]
    : [textContent]

  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user' as const, content }],
  }
}

export async function generateDescription(productName: string, imageBase64: string | null): Promise<string> {
  const client = new Anthropic()
  const params = buildClaudePrompt(productName, imageBase64)
  const response = await client.messages.create(params)
  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}
