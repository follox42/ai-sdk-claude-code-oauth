/**
 * Quick test of the Claude Code OAuth provider
 */

import { claudeCode, getValidAccessToken, readCredentials } from './dist/index.js';

async function main() {
  console.log('🔐 Testing Claude Code OAuth Provider\n');
  
  // Test 1: Read credentials
  console.log('1. Reading credentials...');
  try {
    const creds = readCredentials();
    console.log('   ✅ Credentials found');
    console.log(`   - Expires at: ${new Date(creds.claudeAiOauth.expiresAt).toISOString()}`);
    console.log(`   - Scopes: ${creds.claudeAiOauth.scopes.join(', ')}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  // Test 2: Get valid token
  console.log('\n2. Getting valid access token...');
  try {
    const token = await getValidAccessToken();
    console.log(`   ✅ Got token: ${token.slice(0, 20)}...`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test 3: Create model instance
  console.log('\n3. Creating model instance...');
  const model = claudeCode('claude-sonnet-4-20250514');
  console.log(`   ✅ Model created: ${model.provider}/${model.modelId}`);
  
  // Test 4: Make a simple API call
  console.log('\n4. Making API call...');
  try {
    const result = await model.doGenerate({
      inputFormat: 'prompt',
      mode: { type: 'regular' },
      prompt: [
        { role: 'user', content: [{ type: 'text', text: 'Say "Hello from Claude Code OAuth!" and nothing else.' }] }
      ],
    });
    console.log(`   ✅ Response: ${result.text}`);
    console.log(`   - Tokens: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n✨ Tests complete!');
}

main().catch(console.error);
