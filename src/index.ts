/**
 * Claude Code OAuth Provider for Vercel AI SDK
 * 
 * Use Claude Code's OAuth tokens to access Anthropic API without an API key.
 * 
 * @example
 * ```ts
 * import { claudeCode } from 'ai-sdk-claude-code-oauth';
 * import { generateText } from 'ai';
 * 
 * const result = await generateText({
 *   model: claudeCode('claude-sonnet-4-20250514'),
 *   prompt: 'Hello, how are you?',
 * });
 * ```
 */

import { ClaudeCodeLanguageModel, type ClaudeCodeModelId, type ClaudeCodeModelSettings } from './provider.js';
export { getValidAccessToken, readCredentials, refreshToken, isTokenExpired } from './credentials.js';
export type { ClaudeCodeCredentials } from './credentials.js';
export { ClaudeCodeLanguageModel, type ClaudeCodeModelId, type ClaudeCodeModelSettings };

/**
 * Claude Code OAuth provider instance
 */
export interface ClaudeCodeProvider {
  /**
   * Create a language model instance
   * @param modelId - Model ID (e.g., 'claude-sonnet-4-20250514')
   * @param settings - Optional model settings
   */
  (modelId: ClaudeCodeModelId, settings?: ClaudeCodeModelSettings): ClaudeCodeLanguageModel;
  
  /**
   * Create a language model instance (alias for direct call)
   */
  languageModel(modelId: ClaudeCodeModelId, settings?: ClaudeCodeModelSettings): ClaudeCodeLanguageModel;
  
  /**
   * Create a chat model instance (alias for languageModel)
   */
  chat(modelId: ClaudeCodeModelId, settings?: ClaudeCodeModelSettings): ClaudeCodeLanguageModel;
}

/**
 * Create a Claude Code OAuth provider
 */
export function createClaudeCode(): ClaudeCodeProvider {
  const createModel = (modelId: ClaudeCodeModelId, settings?: ClaudeCodeModelSettings) => {
    return new ClaudeCodeLanguageModel(modelId, settings);
  };
  
  const provider = createModel as ClaudeCodeProvider;
  provider.languageModel = createModel;
  provider.chat = createModel;
  
  return provider;
}

/**
 * Default Claude Code OAuth provider instance
 * 
 * @example
 * ```ts
 * import { claudeCode } from 'ai-sdk-claude-code-oauth';
 * 
 * const model = claudeCode('claude-sonnet-4-20250514');
 * ```
 */
export const claudeCode = createClaudeCode();

// Default export for convenience
export default claudeCode;
