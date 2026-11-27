import { describe, expect, it, vi } from 'vitest';
import { createAnthropicAi, createDeepSeekAi, fallbackAi } from './ai';

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

describe('Anthropic adapter', () => {
  const claude = {
    apiKey: 'claude-key',
    baseUrl: 'https://claude.example.test',
    model: 'claude-haiku-5-5',
  };

  it('sends the key and version headers, asks for JSON in the system prompt, and reads text and usage', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        model: 'claude-haiku-5-5',
        content: [{ type: 'text', text: '```json\n{"summary":"ok","changes":[]}\n```' }],
        usage: { input_tokens: 20, output_tokens: 5 },
      }),
    );
    const ai = createAnthropicAi(claude, { fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await ai.completeJson(input)).toEqual({
      content: '{"summary":"ok","changes":[]}',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      inputTokens: 20,
      outputTokens: 5,
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://claude.example.test/v1/messages');
    const headers = init!.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('claude-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', max_tokens: 100 });
    expect(body.system).toMatch(/JSON object only/);
  });

  it('answers null without a key or on an error, never logging the key or the prompt', async () => {
    expect(await createAnthropicAi(null).completeJson(input)).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = async () => new Response('overloaded', { status: 529 });
    const ai = createAnthropicAi(claude, { fetch: failing as unknown as typeof globalThis.fetch });
    expect(await ai.completeJson(input)).toBeNull();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('claude-key');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('usr');
    warn.mockRestore();
  });
});

describe('fallback', () => {
  it('answers with the first provider that answers, and null when none does', async () => {
    const answer = { content: '{}', provider: 'b', model: 'm', inputTokens: 1, outputTokens: 1 };
    const down = { completeJson: vi.fn(async () => null) };
    const up = { completeJson: vi.fn(async () => answer) };
    expect(await fallbackAi([down, up]).completeJson(input)).toBe(answer);
    expect(down.completeJson).toHaveBeenCalledOnce();
    expect(await fallbackAi([down, down]).completeJson(input)).toBeNull();
  });
});
