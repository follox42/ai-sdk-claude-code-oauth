/**
 * Claude Code OAuth Provider for Vercel AI SDK
 * 
 * Uses OAuth tokens from Claude Code CLI instead of API keys
 */

import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1CallWarning,
  LanguageModelV1FinishReason,
  LanguageModelV1StreamPart,
  LanguageModelV1FunctionToolCall,
} from '@ai-sdk/provider';

import { getValidAccessToken } from './credentials.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';

export interface ClaudeCodeModelSettings {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export type ClaudeCodeModelId = 
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'claude-haiku-3-5-20241022'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-20240229'
  | (string & {});

export class ClaudeCodeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly provider = 'claude-code-oauth';
  readonly defaultObjectGenerationMode = 'json' as const;
  readonly supportsImageUrls = true;
  readonly supportsStructuredOutputs = true;

  readonly modelId: ClaudeCodeModelId;
  readonly settings: ClaudeCodeModelSettings;

  constructor(modelId: ClaudeCodeModelId, settings: ClaudeCodeModelSettings = {}) {
    this.modelId = modelId;
    this.settings = settings;
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<{
    text?: string;
    toolCalls?: LanguageModelV1FunctionToolCall[];
    finishReason: LanguageModelV1FinishReason;
    usage: { promptTokens: number; completionTokens: number };
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    rawResponse?: { headers?: Record<string, string> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const accessToken = await getValidAccessToken();
    
    const { prompt, mode, maxTokens, temperature, topP, topK, abortSignal } = options;
    
    // Convert AI SDK prompt to Anthropic format
    const messages = this.convertPrompt(prompt);
    const systemMessage = this.extractSystemMessage(prompt);
    
    // Build request body
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      max_tokens: maxTokens ?? this.settings.maxTokens ?? 4096,
    };
    
    if (systemMessage) {
      body.system = systemMessage;
    }
    
    if (temperature !== undefined) {
      body.temperature = temperature;
    } else if (this.settings.temperature !== undefined) {
      body.temperature = this.settings.temperature;
    }
    
    if (topP !== undefined) {
      body.top_p = topP;
    } else if (this.settings.topP !== undefined) {
      body.top_p = this.settings.topP;
    }
    
    if (topK !== undefined) {
      body.top_k = topK;
    } else if (this.settings.topK !== undefined) {
      body.top_k = this.settings.topK;
    }
    
    // Handle tools
    if (mode?.type === 'object-tool' && mode.tool) {
      body.tools = [{
        name: mode.tool.name,
        description: mode.tool.description,
        input_schema: mode.tool.parameters,
      }];
      body.tool_choice = { type: 'tool', name: mode.tool.name };
    } else if (mode?.type === 'regular' && mode.tools && mode.tools.length > 0) {
      body.tools = mode.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
      
      if (mode.toolChoice?.type === 'tool') {
        body.tool_choice = { type: 'tool', name: mode.toolChoice.toolName };
      } else if (mode.toolChoice?.type === 'required') {
        body.tool_choice = { type: 'any' };
      } else if (mode.toolChoice?.type === 'none') {
        body.tool_choice = { type: 'none' };
      }
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      id: string;
      type: string;
      role: string;
      content: Array<{
        type: 'text' | 'tool_use';
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    };

    // Extract text and tool calls
    let text: string | undefined;
    const toolCalls: LanguageModelV1FunctionToolCall[] = [];
    
    for (const block of data.content) {
      if (block.type === 'text') {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          toolCallType: 'function',
          toolCallId: block.id!,
          toolName: block.name!,
          args: JSON.stringify(block.input),
        });
      }
    }

    // Map stop reason
    let finishReason: LanguageModelV1FinishReason = 'other';
    if (data.stop_reason === 'end_turn') {
      finishReason = 'stop';
    } else if (data.stop_reason === 'tool_use') {
      finishReason = 'tool-calls';
    } else if (data.stop_reason === 'max_tokens') {
      finishReason = 'length';
    }

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
      },
      rawCall: {
        rawPrompt: prompt,
        rawSettings: body,
      },
    };
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> };
    rawResponse?: { headers?: Record<string, string> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    const accessToken = await getValidAccessToken();
    
    const { prompt, mode, maxTokens, temperature, topP, topK, abortSignal } = options;
    
    const messages = this.convertPrompt(prompt);
    const systemMessage = this.extractSystemMessage(prompt);
    
    const body: Record<string, unknown> = {
      model: this.modelId,
      messages,
      max_tokens: maxTokens ?? this.settings.maxTokens ?? 4096,
      stream: true,
    };
    
    if (systemMessage) {
      body.system = systemMessage;
    }
    
    if (temperature !== undefined) body.temperature = temperature;
    if (topP !== undefined) body.top_p = topP;
    if (topK !== undefined) body.top_k = topK;

    // Handle tools (same as doGenerate)
    if (mode?.type === 'object-tool' && mode.tool) {
      body.tools = [{
        name: mode.tool.name,
        description: mode.tool.description,
        input_schema: mode.tool.parameters,
      }];
      body.tool_choice = { type: 'tool', name: mode.tool.name };
    } else if (mode?.type === 'regular' && mode.tools && mode.tools.length > 0) {
      body.tools = mode.tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const stream = this.createStreamTransformer(response.body!);

    return {
      stream,
      rawCall: {
        rawPrompt: prompt,
        rawSettings: body,
      },
    };
  }

  private createStreamTransformer(body: ReadableStream<Uint8Array>): ReadableStream<LanguageModelV1StreamPart> {
    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let currentToolCallId = '';
    let currentToolCallName = '';
    let currentToolCallArgs = '';

    return new ReadableStream({
      async start(controller) {
        const reader = body.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              
              try {
                const event = JSON.parse(data);
                
                if (event.type === 'message_start') {
                  inputTokens = event.message?.usage?.input_tokens ?? 0;
                } else if (event.type === 'content_block_start') {
                  if (event.content_block?.type === 'tool_use') {
                    currentToolCallId = event.content_block.id;
                    currentToolCallName = event.content_block.name;
                    currentToolCallArgs = '';
                  }
                } else if (event.type === 'content_block_delta') {
                  if (event.delta?.type === 'text_delta') {
                    controller.enqueue({
                      type: 'text-delta',
                      textDelta: event.delta.text,
                    });
                  } else if (event.delta?.type === 'input_json_delta') {
                    currentToolCallArgs += event.delta.partial_json;
                  }
                } else if (event.type === 'content_block_stop') {
                  if (currentToolCallId) {
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallType: 'function',
                      toolCallId: currentToolCallId,
                      toolName: currentToolCallName,
                      args: currentToolCallArgs,
                    });
                    currentToolCallId = '';
                    currentToolCallName = '';
                    currentToolCallArgs = '';
                  }
                } else if (event.type === 'message_delta') {
                  outputTokens = event.usage?.output_tokens ?? outputTokens;
                  
                  let finishReason: LanguageModelV1FinishReason = 'other';
                  if (event.delta?.stop_reason === 'end_turn') {
                    finishReason = 'stop';
                  } else if (event.delta?.stop_reason === 'tool_use') {
                    finishReason = 'tool-calls';
                  } else if (event.delta?.stop_reason === 'max_tokens') {
                    finishReason = 'length';
                  }
                  
                  controller.enqueue({
                    type: 'finish',
                    finishReason,
                    usage: {
                      promptTokens: inputTokens,
                      completionTokens: outputTokens,
                    },
                  });
                }
              } catch {
                // Ignore parse errors for non-JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      },
    });
  }

  private convertPrompt(prompt: LanguageModelV1CallOptions['prompt']): Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; source?: unknown }>;
  }> {
    const messages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<{ type: string; text?: string; source?: unknown }>;
    }> = [];
    
    for (const part of prompt) {
      if (part.role === 'user') {
        const content: Array<{ type: string; text?: string; source?: unknown }> = [];
        
        for (const item of part.content) {
          if (item.type === 'text') {
            content.push({ type: 'text', text: item.text });
          } else if (item.type === 'image') {
            if (item.image instanceof URL) {
              content.push({
                type: 'image',
                source: {
                  type: 'url',
                  url: item.image.toString(),
                },
              });
            } else {
              // Base64 encoded image
              const base64 = Buffer.from(item.image).toString('base64');
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: item.mimeType ?? 'image/png',
                  data: base64,
                },
              });
            }
          }
        }
        
        messages.push({
          role: 'user',
          content: content.length === 1 && content[0].type === 'text' 
            ? content[0].text! 
            : content,
        });
      } else if (part.role === 'assistant') {
        const textParts = part.content
          .filter(item => item.type === 'text')
          .map(item => (item as { type: 'text'; text: string }).text)
          .join('');
        
        if (textParts) {
          messages.push({ role: 'assistant', content: textParts });
        }
      } else if (part.role === 'tool') {
        // Tool results go as user messages with tool_result content
        for (const item of part.content) {
          if (item.type === 'tool-result') {
            messages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: item.toolCallId,
                content: typeof item.result === 'string' 
                  ? item.result 
                  : JSON.stringify(item.result),
              }] as unknown as Array<{ type: string; text?: string }>,
            });
          }
        }
      }
    }
    
    return messages;
  }

  private extractSystemMessage(prompt: LanguageModelV1CallOptions['prompt']): string | undefined {
    for (const part of prompt) {
      if (part.role === 'system') {
        return part.content;
      }
    }
    return undefined;
  }
}
