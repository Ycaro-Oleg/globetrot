import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekAi } from './ai';

const config = { apiKey: 'test-key', baseUrl: 'https://ai.example.test/', model: 'deepseek-chat' };
const input = { system: 'sys', user: 'usr', maxTokens: 100 };

describe('DeepSeek adapter', () => {
  it('sends JSON mode with the key in a header and reads content and usage', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        model: 'deepseek-chat',
        choices: [{ message: { content: '{"summary":"ok","changes":[]}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    );
    const ai = createDeepSeekAi(config, { fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await ai.completeJson(input)).toEqual({
      content: '{"summary":"ok","changes":[]}',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 12,
      outputTokens: 3,
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://ai.example.test/chat/completions');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer test-key');
    expect(JSON.parse(init!.body as string)).toMatchObject({
      response_format: { type: 'json_object' },
      max_tokens: 100,
    });
  });

  it('answers null without a key, on an error status, without content, or when the network fails', async () => {
    expect(await createDeepSeekAi(null).completeJson(input)).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const answers = [
      async () => new Response('nope', { status: 500 }),
      async () => Response.json({ choices: [] }),
      async () => {
        throw new TypeError('network');
      },
    ];
    for (const answer of answers) {
      const ai = createDeepSeekAi(config, { fetch: answer as unknown as typeof globalThis.fetch });
      expect(await ai.completeJson(input)).toBeNull();
    }
    // The prompt and the key never reach the logs.
    expect(JSON.stringify(warn.mock.calls)).not.toContain('test-key');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('usr');
    warn.mockRestore();
  });
});
