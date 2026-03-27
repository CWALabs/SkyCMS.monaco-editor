import type { SkyCmsInlineCompletionProvider } from './core';

export type GitHubCopilotProxyOptions = {
  endpoint: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  maxPrefixChars?: number;
  maxSuffixChars?: number;
};

type CopilotProxyResponse = {
  completion?: string;
  completions?: string[];
};

export type CopilotProxyStatus = {
  enabled: boolean;
  configured: boolean;
  endpointConfigured: boolean;
  model?: string;
};

export type CopilotStatusRetryOptions = {
  completionEndpoint: string;
  fetchImpl?: typeof fetch;
  retries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  jitterRatio?: number;
};

export function resolveCopilotStatusEndpoint(completionEndpoint: string) {
  const trimmed = completionEndpoint.trim();
  if (trimmed.endsWith('/complete')) {
    return `${trimmed.slice(0, -'/complete'.length)}/status`;
  }

  return '/api/copilot/status';
}

export async function fetchCopilotProxyStatus(options: {
  completionEndpoint: string;
  fetchImpl?: typeof fetch;
}): Promise<CopilotProxyStatus | null> {
  const fetcher = options.fetchImpl || fetch;
  const statusEndpoint = resolveCopilotStatusEndpoint(options.completionEndpoint);

  try {
    const response = await fetcher(statusEndpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as Partial<CopilotProxyStatus>;
    return {
      enabled: !!payload.enabled,
      configured: !!payload.configured,
      endpointConfigured: !!payload.endpointConfigured,
      model: typeof payload.model === 'string' ? payload.model : undefined,
    };
  } catch {
    return null;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchCopilotProxyStatusWithRetry(
  options: CopilotStatusRetryOptions,
): Promise<CopilotProxyStatus | null> {
  const retries = options.retries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const jitterRatio = Math.max(0, options.jitterRatio ?? 0.3);

  let currentDelay = initialDelayMs;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const status = await fetchCopilotProxyStatus({
      completionEndpoint: options.completionEndpoint,
      fetchImpl: options.fetchImpl,
    });

    if (status) {
      return status;
    }

    if (attempt < retries) {
      const jitterFactor = 1 + ((Math.random() * 2) - 1) * jitterRatio;
      const jitteredDelay = Math.max(0, Math.floor(currentDelay * jitterFactor));
      await delay(jitteredDelay);
      currentDelay = Math.floor(currentDelay * backoffMultiplier);
    }
  }

  return null;
}

/**
 * Creates an inline completion provider that can be plugged into
 * `createSkyCmsEditorWithMonaco({ inlineCompletionsProvider })`.
 *
 * Note: browser clients should call a trusted backend endpoint that brokers
 * GitHub Copilot requests; do not expose Copilot credentials in the browser.
 */
export function createGitHubCopilotInlineProvider(
  options: GitHubCopilotProxyOptions,
): SkyCmsInlineCompletionProvider {
  const fetcher = options.fetchImpl || fetch;
  const maxPrefixChars = options.maxPrefixChars ?? 4000;
  const maxSuffixChars = options.maxSuffixChars ?? 1000;

  return async (context) => {
    const model = context.model;
    const position = context.position;

    const prefixRange = {
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    };

    const lastLine = model.getLineCount();
    const suffixRange = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: lastLine,
      endColumn: model.getLineMaxColumn(lastLine),
    };

    const prefix = model.getValueInRange(prefixRange).slice(-maxPrefixChars);
    const suffix = model.getValueInRange(suffixRange).slice(0, maxSuffixChars);

    if (!prefix.trim()) {
      return [];
    }

    const abortController = new AbortController();
    const cancellationListener = context.cancellationToken.onCancellationRequested(() => {
      abortController.abort();
    });

    try {
      const token = options.getAccessToken ? await options.getAccessToken() : null;
      const response = await fetcher(options.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prefix,
          suffix,
          language: context.languageId,
          fieldId: context.fieldId,
          uri: model.uri.toString(),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as CopilotProxyResponse;
      const rawSuggestions: string[] = [];

      if (typeof payload.completion === 'string') {
        rawSuggestions.push(payload.completion);
      }

      if (Array.isArray(payload.completions)) {
        for (const suggestion of payload.completions) {
          if (typeof suggestion === 'string') {
            rawSuggestions.push(suggestion);
          }
        }
      }

      const suggestions = rawSuggestions
        .map((value) => value.trimEnd())
        .filter((value, index, list) => value.length > 0 && list.indexOf(value) === index);

      if (!suggestions.length) {
        return [];
      }

      return suggestions.map((insertText) => ({
        insertText,
        range: new context.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column,
        ),
      }));
    } catch {
      return [];
    } finally {
      cancellationListener.dispose();
    }
  };
}
