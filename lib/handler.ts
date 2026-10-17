import { NextRequest } from 'next/server';
import { error, history, originAllowed } from './api';
import { config } from './config';
import { generate, type Content } from './gemini';
import { providerQuotaTripped, release, reserve } from './limits';

export async function handle(request: NextRequest, kind:'chat'|'voice') {
  if (!originAllowed(request)) return error('INVALID_REQUEST',403);
  const c = config();
  const maxBody = kind === 'voice' ? c.audioBytes + 50000 : 60000;
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maxBody) return error(kind === 'voice' ? 'AUDIO_TOO_LARGE':'INVALID_REQUEST',413);
  let requestId = '';
  let contents: Content[];
  try {
    if (kind === 'chat') {
      const raw = await request.text();
      if (raw.length > maxBody) return error('INVALID_REQUEST',413);
      const body = JSON.parse(raw);
      if (typeof body.message !== 'string' || !body.message.trim()) return error('INVALID_REQUEST',400);
      if (body.message.length > c.messageChars) return error('MESSAGE_TOO_LONG',413);
      requestId = body.requestId;
      contents = [...history(body.history),{role:'user',parts:[{text:body.message.trim()}]}];
    } else {
      if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) return error('INVALID_REQUEST',415);
      const form = await request.formData();
      const audio = form.get('audio');
      if (!(audio instanceof File) || !audio.size) return error('INVALID_REQUEST',400);
      if (audio.size > c.audioBytes) return error('AUDIO_TOO_LARGE',413);
      if (!['audio/mp4','audio/m4a','audio/aac','audio/mpeg','audio/wav','audio/webm','audio/ogg','audio/3gpp'].includes(audio.type)) return error('INVALID_REQUEST',415);
      const seconds = Number(form.get('durationSeconds'));
      if (!Number.isFinite(seconds) || seconds < 0.5 || seconds > c.audioSeconds) return error('INVALID_REQUEST',400);
      requestId = String(form.get('requestId') || '');
      const context = form.get('history');
      contents = [...history(context ? JSON.parse(String(context)) : undefined),{role:'user',parts:[{text:'Respond to this voice message.'},{inlineData:{mimeType:audio.type,data:Buffer.from(await audio.arrayBuffer()).toString('base64')}}]}];
    }
  } catch { return error('INVALID_REQUEST',400); }
  let hash = '';
  try {
    if (await providerQuotaTripped()) return error('PROVIDER_QUOTA_EXCEEDED',429);
    const slot = await reserve(request, requestId);
    if (slot.code === 1) return error('RATE_LIMITED',429,slot.retryAfterSeconds);
    if (slot.code === 2) return error('APP_USAGE_LIMIT_REACHED',429,slot.retryAfterSeconds);
    if (slot.code === 3) return error('RATE_LIMITED',409);
    hash = slot.hash;
    return await generate(contents);
  } catch { return error('AI_SERVICE_UNAVAILABLE',503); }
  finally { if (hash) await release(hash); }
}
