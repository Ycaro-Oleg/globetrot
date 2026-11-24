import type { AiPort } from '@globetrot/application';

export interface DeepSeekConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/**
 * Adapter: the application's `AiPort` over DeepSeek's chat completions API (OpenAI-compatible) in JSON mode.
 * The key stays on the server. Any failure answers `null` ("not available"); only the kind of failure is logged,
 * never the prompt, the answer or the key.
 */
export function createDeepSeekAi(
  config: DeepSeekConfig | null,
  options: { readonly timeoutMs?: number; readonly fetch?: typeof fetch } = {},
): AiPort {
  const call = options.fetch ?? fetch;
  return {
    async completeJson(input) {
      if (!config) return null;
      try {
        const response = await call(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: input.system },
              { role: 'user', content: input.user },
            ],
            response_format: { type: 'json_object' },
            max_tokens: input.maxTokens,
            temperature: 0.4,
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
        });
        if (!response.ok) {
          console.warn(`ai: provider answered ${response.status}`);
          return null;
        }
        const body = (await response.json()) as {
          model?: string;
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          console.warn('ai: provider answered without content');
          return null;
        }
        return {
          content,
          provider: 'deepseek',
          model: body.model ?? config.model,
          inputTokens: body.usage?.prompt_tokens ?? 0,
          outputTokens: body.usage?.completion_tokens ?? 0,
        };
      } catch (error) {
        console.warn(`ai: request failed (${error instanceof Error ? error.name : 'unknown'})`);
        return null;
      }
    },
  };
}
