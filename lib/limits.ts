import { NextRequest } from 'next/server';
import { clientIp } from './api';
import { config } from './config';
import { createHash } from 'crypto';

const script = `
local existing = redis.call('SET', KEYS[1], '1', 'NX', 'EX', 86400)
if not existing then return {3, 0} end
local rate = tonumber(redis.call('GET', KEYS[2]) or '0')
if rate >= tonumber(ARGV[1]) then redis.call('DEL', KEYS[1]); return {1, redis.call('TTL', KEYS[2])} end
local daily = tonumber(redis.call('GET', KEYS[3]) or '0')
if daily >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return {2, redis.call('TTL', KEYS[3])} end
local active = tonumber(redis.call('GET', KEYS[4]) or '0')
if active >= tonumber(ARGV[3]) then redis.call('DEL', KEYS[1]); return {1, redis.call('TTL', KEYS[4])} end
redis.call('INCR', KEYS[2]); if rate == 0 then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
redis.call('INCR', KEYS[3]); if daily == 0 then redis.call('EXPIRE', KEYS[3], 86400) end
redis.call('INCR', KEYS[4]); redis.call('EXPIRE', KEYS[4], 90)
return {0, 0}
`;
async function redis(command: unknown[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Storage unavailable');
  const response = await fetch(url, {method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}, body:JSON.stringify(command), cache:'no-store', signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw new Error('Storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Storage unavailable');
  return data.result;
}
export async function reserve(request: NextRequest, requestId: string) {
  const ip = clientIp(request);
  if (!ip || !/^[a-zA-Z0-9:._-]{3,80}$/.test(ip) || !/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error('Identity unavailable');
  const hash = createHash('sha256').update(ip).digest('hex');
  const c = config();
  const result = await redis(['EVAL',script,4,`convico:req:${hash}:${requestId}`,`convico:rate:v2:${hash}`,'convico:daily:v2',`convico:active:${hash}`,c.perIp,c.daily,c.concurrent,c.windowSeconds]);
  return {code:Number(result[0]), retryAfterSeconds:Math.max(1,Number(result[1]) || 60), hash};
}
export async function release(hash: string) {
  try { await redis(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>0 then redis.call('DECR',KEYS[1]) end; return 1",1,`convico:active:${hash}`]); } catch { /* 90-second TTL releases a stale slot. */ }
}
export async function tripProviderQuota(kind: 'chat'|'tts' = 'chat') {
  try { await redis(['SET',`convico:provider-quota:${kind}`,'1']); } catch { /* Redis failure already fails closed on next reservation. */ }
}
export async function providerQuotaTripped(kind: 'chat'|'tts' = 'chat') {
  if(kind==='chat' && await redis(['GET','convico:provider-quota'])) return true;
  return Boolean(await redis(['GET',`convico:provider-quota:${kind}`]));
}
