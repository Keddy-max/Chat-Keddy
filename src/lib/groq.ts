const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';


export type GroqChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type GroqChatOptions = {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
};

function toOpenAIMessages(messages: GroqChatMessage[]) {
  return messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
}

export async function* groqChatStream({ model, messages, temperature = 0.7, signal }: GroqChatOptions) {
  const apiKey = (typeof window === 'undefined')
    ? process.env.GROQ_API_KEY
    : (import.meta as any).env?.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model,
      messages: toOpenAIMessages(messages),
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GROQ_HTTP_${response.status}${text ? `: ${text.slice(0, 500)}` : ''}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!line.startsWith('data:')) continue;

      const data = line.replace(/^data:\s*/, '');
      if (data === '[DONE]') return;

      try {
        const chunk = JSON.parse(data) as any;
        const delta = chunk?.choices?.[0]?.delta;
        const token = delta?.content;
        if (token) yield token as string;
      } catch {
        // ignore malformed chunk lines
      }
    }
  }
}

