import { buildClaudePrompt } from '@/lib/claudeClient'

describe('claudeClient', () => {
  it('builds prompt with image and name', () => {
    const prompt = buildClaudePrompt('Leather Wallet', 'base64imagedata')
    expect(JSON.stringify(prompt.messages[0].content)).toContain('Leather Wallet')
    expect(JSON.stringify(prompt.messages[0].content)).toContain('base64imagedata')
  })

  it('builds prompt without image when imageBase64 is null', () => {
    const prompt = buildClaudePrompt('Leather Wallet', null)
    expect(JSON.stringify(prompt.messages[0].content)).not.toContain('image')
    expect(JSON.stringify(prompt.messages[0].content)).toContain('Leather Wallet')
  })
})
