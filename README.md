# ai-sdk-claude-code-oauth

> Vercel AI SDK provider that uses Claude Code's OAuth tokens for free Claude API access.

## How It Works

This provider reads the OAuth tokens stored by Claude Code CLI (`~/.claude/.credentials.json`) and uses them to make API calls. It mimics Claude Code's exact headers to authenticate with Anthropic's OAuth endpoint.

**Requirements:**
- Claude Code CLI installed and logged in ([claude.ai/code](https://claude.ai/code))
- Node.js 18+

## Installation

```bash
npm install ai-sdk-claude-code-oauth
```

Or use directly from the repo:
```bash
npm install github:follox42/ai-sdk-claude-code-oauth
```

## Usage

### With Vercel AI SDK

```ts
import { claudeCode } from 'ai-sdk-claude-code-oauth';
import { generateText } from 'ai';

const result = await generateText({
  model: claudeCode('claude-sonnet-4-20250514'),
  prompt: 'Hello, how are you?',
});

console.log(result.text);
```

### Streaming

```ts
import { claudeCode } from 'ai-sdk-claude-code-oauth';
import { streamText } from 'ai';

const result = await streamText({
  model: claudeCode('claude-sonnet-4-20250514'),
  prompt: 'Write a haiku about coding',
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### With Tools

```ts
import { claudeCode } from 'ai-sdk-claude-code-oauth';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: claudeCode('claude-sonnet-4-20250514'),
  tools: {
    weather: tool({
      description: 'Get the weather in a location',
      parameters: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => ({
        location,
        temperature: 22,
        unit: 'celsius',
      }),
    }),
  },
  prompt: 'What is the weather in Paris?',
});
```

## Available Models

```ts
// Latest models
claudeCode('claude-sonnet-4-20250514')
claudeCode('claude-opus-4-20250514')
claudeCode('claude-haiku-3-5-20241022')

// Older models
claudeCode('claude-3-5-sonnet-20241022')
claudeCode('claude-3-5-haiku-20241022')
claudeCode('claude-3-opus-20240229')

// Any model string works
claudeCode('any-model-id')
```

## Model Settings

```ts
claudeCode('claude-sonnet-4-20250514', {
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  includeClaudeCodeIdentity: true, // Default: true (recommended for OAuth)
});
```

## Credential Management

```ts
import { 
  readCredentials, 
  getValidAccessToken, 
  isTokenExpired,
  refreshToken 
} from 'ai-sdk-claude-code-oauth';

// Read credentials
const creds = readCredentials();
console.log('Expires:', new Date(creds.claudeAiOauth.expiresAt));
console.log('Scopes:', creds.claudeAiOauth.scopes);

// Check expiration
if (isTokenExpired(creds)) {
  console.log('Token expired, will auto-refresh');
}

// Get valid token (auto-refreshes if needed)
const token = await getValidAccessToken();
```

## How It Works (Technical)

1. **Reads OAuth tokens** from `~/.claude/.credentials.json` (created by Claude Code)
2. **Auto-refreshes expired tokens** using Anthropic's OAuth endpoint
3. **Mimics Claude Code headers** exactly:
   - `anthropic-beta: claude-code-20250219,oauth-2025-04-20,...`
   - `user-agent: claude-cli/X.X.X (external, cli)`
   - `x-app: cli`
   - `anthropic-dangerous-direct-browser-access: true`
4. **Includes Claude Code identity** in system prompt for compatibility

## Troubleshooting

### "Claude Code credentials not found"
Make sure Claude Code is installed and you're logged in:
```bash
claude --version
claude login  # if not logged in
```

### "Token expired"
Tokens auto-refresh, but if issues persist:
```bash
claude logout
claude login
```

### Rate Limits
OAuth tokens share Claude Code's rate limits (Pro/Max subscription limits apply).

## Credits

- Inspired by how [Moltbot](https://github.com/moltbot/moltbot) handles OAuth via `@mariozechner/pi-ai`
- OAuth header discovery from the pi-ai package's Anthropic provider

## License

MIT
