/**
 * Claude Code OAuth Credentials Manager
 * Reads and refreshes tokens from ~/.claude/.credentials.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface ClaudeCodeCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
    subscriptionType: string | null;
    rateLimitTier: string | null;
  };
  organizationUuid: string;
}

const CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json');
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const ANTHROPIC_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

let cachedCredentials: ClaudeCodeCredentials | null = null;
let lastReadTime = 0;
const CACHE_TTL_MS = 30_000; // Re-read file every 30s max

/**
 * Read credentials from disk with caching
 */
export function readCredentials(): ClaudeCodeCredentials {
  const now = Date.now();
  
  if (cachedCredentials && (now - lastReadTime) < CACHE_TTL_MS) {
    return cachedCredentials;
  }
  
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Claude Code credentials not found at ${CREDENTIALS_PATH}.\n` +
      `Please install Claude Code and log in: https://claude.ai/code`
    );
  }
  
  try {
    const content = readFileSync(CREDENTIALS_PATH, 'utf-8');
    cachedCredentials = JSON.parse(content) as ClaudeCodeCredentials;
    lastReadTime = now;
    return cachedCredentials;
  } catch (error) {
    throw new Error(`Failed to read Claude Code credentials: ${error}`);
  }
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpired(credentials: ClaudeCodeCredentials): boolean {
  const expiresAt = credentials.claudeAiOauth.expiresAt;
  return Date.now() >= (expiresAt - TOKEN_REFRESH_BUFFER_MS);
}

/**
 * Refresh the OAuth token using the refresh token
 */
export async function refreshToken(credentials: ClaudeCodeCredentials): Promise<ClaudeCodeCredentials> {
  const { refreshToken } = credentials.claudeAiOauth;
  
  const response = await fetch(ANTHROPIC_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${errorText}`);
  }
  
  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
  };
  
  // Update credentials
  const newCredentials: ClaudeCodeCredentials = {
    ...credentials,
    claudeAiOauth: {
      ...credentials.claudeAiOauth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: Date.now() + (data.expires_in * 1000),
    },
  };
  
  // Save to disk
  try {
    writeFileSync(CREDENTIALS_PATH, JSON.stringify(newCredentials, null, 2));
    cachedCredentials = newCredentials;
  } catch (error) {
    console.warn('Failed to save refreshed credentials to disk:', error);
  }
  
  return newCredentials;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string> {
  let credentials = readCredentials();
  
  if (isTokenExpired(credentials)) {
    console.log('[claude-code-oauth] Token expired, refreshing...');
    credentials = await refreshToken(credentials);
  }
  
  return credentials.claudeAiOauth.accessToken;
}
