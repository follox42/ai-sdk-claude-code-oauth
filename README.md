# ai-sdk-claude-code-oauth

🔐 Vercel AI SDK provider that uses **Claude Code OAuth tokens** for free API access.

Use Claude's API without paying for API credits - leverages the same OAuth tokens that Claude Code CLI uses.

## Installation

```bash
npm install ai-sdk-claude-code-oauth ai
```

## Prerequisites

1. **Install Claude Code CLI**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Log in to Claude Code**
   ```bash
   claude login
   ```
   
   This creates `~/.claude/.credentials.json` with your OAuth tokens.

## Usage

```typescript
import { claudeCode } from 'ai-sdk-claude-code-oauth';
import { generateText, streamText } from 'ai';

// Simple text generation
const { text } = await generateText({
  model: claudeCode('claude-sonnet-4-20250514'),
  prompt: 'Explain quantum computing in simple terms.',
});

console.log(text);

// Streaming
const result = await streamText({
  model: claudeCode('claude-sonnet-4-20250514'),
  prompt: 'Write a short story about a robot.',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

## Available Models

- `claude-sonnet-4-20250514` (recommended)
- `claude-opus-4-20250514`
- `claude-haiku-3-5-20241022`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`

## Model Settings

```typescript
const model = claudeCode('claude-sonnet-4-20250514', {
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
});
```

## Advanced Usage

### Direct Token Access

```typescript
import { getValidAccessToken, readCredentials } from 'ai-sdk-claude-code-oauth';

// Get a valid access token (auto-refreshes if expired)
const token = await getValidAccessToken();

// Read raw credentials
const creds = readCredentials();
console.log(creds.claudeAiOauth.expiresAt);
```

### With Tool Calling

```typescript
import { claudeCode } from 'ai-sdk-claude-code-oauth';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { text, toolCalls } = await generateText({
  model: claudeCode('claude-sonnet-4-20250514'),
  tools: {
    weather: tool({
      description: 'Get the weather for a location',
      parameters: z.object({
        location: z.string(),
      }),
      execute: async ({ location }) => {
        return `The weather in ${location} is sunny!`;
      },
    }),
  },
  prompt: 'What is the weather in Paris?',
});
```

## How It Works

1. Reads OAuth tokens from `~/.claude/.credentials.json`
2. Auto-refreshes expired tokens using the refresh token
3. Makes requests to Anthropic API with Bearer authentication
4. Implements full Vercel AI SDK `LanguageModelV1` interface

## Rate Limits

This uses your Claude Code subscription limits. Check your usage at [console.anthropic.com](https://console.anthropic.com).

## ⚠️ Disclaimer

This package uses Claude Code's OAuth tokens in a way that may not be officially supported by Anthropic. Use at your own risk.

## License

MIT
