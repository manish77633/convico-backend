import { NextRequest, NextResponse } from 'next/server';
import { config } from './config';

export type ApiCode = 'RATE_LIMITED'|'APP_USAGE_LIMIT_REACHED'|'PROVIDER_QUOTA_EXCEEDED'|'MESSAGE_TOO_LONG'|'AUDIO_TOO_LARGE'|'REQUEST_TIMEOUT'|'AI_SERVICE_UNAVAILABLE'|'AI_ACCESS_DENIED'|'AI_MODEL_UNAVAILABLE'|'AI_RESPONSE_BLOCKED'|'AI_EMPTY_RESPONSE'|'AI_RESPONSE_INCOMPLETE'|'INVALID_REQUEST';
const messages: Record<ApiCode, string> = {
  RATE_LIMITED: "You're sending messages too quickly. Please wait a moment before trying again.",
  APP_USAGE_LIMIT_REACHED: "You've reached the current chat usage limit. Please try again later.",
  PROVIDER_QUOTA_EXCEEDED: 'AI usage limit reached. Please try again when your quota is available.',
  MESSAGE_TOO_LONG: 'Message is too long.', AUDIO_TOO_LARGE: 'Audio recording is too large.',
  REQUEST_TIMEOUT: 'AI took too long. Please retry when ready.',
  AI_SERVICE_UNAVAILABLE: 'AI is unavailable right now. Please try again later.',
  AI_ACCESS_DENIED: 'AI access is not configured correctly. Please contact support.',
  AI_MODEL_UNAVAILABLE: 'The selected AI model is unavailable. Please contact support.',
  AI_RESPONSE_BLOCKED: 'AI could not answer this request.',
  AI_EMPTY_RESPONSE: 'AI returned no answer. Please try again later.',
  AI_RESPONSE_INCOMPLETE: 'AI could not finish its answer. Please try again later.',
  INVALID_REQUEST: 'Please check your message and try again.',
};
export function error(code: ApiCode, status: number, retryAfterSeconds?: number) {
  const response = NextResponse.json({error: {code, message: messages[code], ...(retryAfterSeconds ? {retryAfterSeconds} : {})}}, {status});
  response.headers.set('X-Convico-Diagnostics','v3');
  if (retryAfterSeconds) response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}
export function originAllowed(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return (process.env.APP_ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean).includes(origin);
}
export function clientIp(request: NextRequest) {
  // Vercel overwrites this header at its trusted edge. Never use client-supplied user IDs.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
export function history(value: unknown) {
  const max = config().historyMessages;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid history');
  return value.map(item => {
    if (!item || typeof item !== 'object' || !['user','assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > config().messageChars) throw new Error('Invalid history');
    return {role: item.role === 'assistant' ? 'model' as const : 'user' as const, parts: [{text: item.content}]};
  });
}
