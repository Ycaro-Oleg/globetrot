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

export interface AnthropicConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/**
 * Adapter: the application's `AiPort` over Anthropic's Messages API (ADR-0022). The Messages API has no JSON mode,
 * so the system prompt ends with the instruction to answer one JSON object; the application parses and validates
 * it as it does DeepSeek's. Same rules as above: any failure answers `null`, and only the kind of failure is logged.
 */
export function createAnthropicAi(
  config: AnthropicConfig | null,
  options: { readonly timeoutMs?: number; readonly fetch?: typeof fetch } = {},
): AiPort {
  const call = options.fetch ?? fetch;
  return {
    async completeJson(input) {
      if (!config) return null;
      try {
        const response = await call(`${config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: input.maxTokens,
            // Current Claude models refuse sampling settings (temperature) with a 400, so none is sent. Thinking is
            // on by default and shares `max_tokens` with the answer: low effort keeps it short (ADR-0033).
            output_config: { effort: 'low' },
            system: `${input.system}\n\nAnswer with one JSON object only, with no text before or after it.`,
            messages: [{ role: 'user', content: input.user }],
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
        });
        if (!response.ok) {
          console.warn(`ai: provider answered ${response.status}`);
          return null;
        }
        const body = (await response.json()) as {
          model?: string;
          content?: { type?: string; text?: string }[];
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const text = body.content?.find((block) => block.type === 'text')?.text;
        if (typeof text !== 'string') {
          console.warn('ai: provider answered without content');
          return null;
        }
        // A model can wrap the object in a code fence: keep what is between the outer braces.
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        return {
          content: start >= 0 && end > start ? text.slice(start, end + 1) : text,
          provider: 'anthropic',
          model: body.model ?? config.model,
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        };
      } catch (error) {
        console.warn(`ai: request failed (${error instanceof Error ? error.name : 'unknown'})`);
        return null;
      }
    },
  };
}

/**
 * Tries each provider in order and answers with the first that answers: Pip keeps working when one provider is
 * down or not configured. With none answering, the application says Pip is not available (503).
 */
export function fallbackAi(providers: readonly AiPort[]): AiPort {
  return {
    async completeJson(input) {
      for (const provider of providers) {
        const answer = await provider.completeJson(input);
        if (answer) return answer;
      }
      return null;
    },
  };
}
