import {NextRequest} from 'next/server';
import {GoogleGenAI} from '@google/genai';
import {error,originAllowed} from '../../../lib/api';
import {providerQuotaTripped,release,reserve,tripProviderQuota} from '../../../lib/limits';
import {validVoiceToken} from '../../../lib/voice-token';

export const runtime='nodejs';
export const maxDuration=45;
function wav(pcm:Buffer) {
  const header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);
  header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
  header.write('data',36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
export async function POST(request:NextRequest) {
  if(!originAllowed(request))return error('INVALID_REQUEST',403);
  if(Number(request.headers.get('content-length')||0)>3000)return error('INVALID_REQUEST',413);
  let text:string,token:string,requestId:string;
  try {
    const raw=await request.text();if(raw.length>3000)return error('INVALID_REQUEST',413);
    const body=JSON.parse(raw);
    text=body.text;token=body.audioToken;requestId=body.requestId;
    if(typeof text!=='string'||!text.trim()||text.length>600||typeof token!=='string'||!validVoiceToken(text,token))return error('INVALID_REQUEST',400);
  }catch{return error('INVALID_REQUEST',400);}
  let hash='';
  try {
    if(await providerQuotaTripped('tts'))return error('PROVIDER_QUOTA_EXCEEDED',429);
    const slot=await reserve(request,requestId);
    if(slot.code===1)return error('RATE_LIMITED',429,slot.retryAfterSeconds);
    if(slot.code===3)return error('RATE_LIMITED',409);
    hash=slot.hash;
    const key=process.env.GEMINI_API_KEY;
    if(!key)return error('AI_SERVICE_UNAVAILABLE',503);
    const ai=new GoogleGenAI({apiKey:key});
    const response=await ai.models.generateContent({model:process.env.GEMINI_TTS_MODEL||'gemini-2.5-flash-preview-tts',contents:[{role:'user',parts:[{text}]}],config:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}}}});
    const data=response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if(!data)return error('AI_SERVICE_UNAVAILABLE',502);
    const pcm=Buffer.from(data,'base64');
    if(!pcm.length||pcm.length>4_000_000||pcm.length%2)return error('AI_SERVICE_UNAVAILABLE',502);
    const audio=wav(pcm);
    return new Response(new Uint8Array(audio),{headers:{'Content-Type':'audio/wav','Content-Length':String(audio.length),'Cache-Control':'no-store'}});
  }catch(cause){
    const e=cause as {status?:number;message?:string};
    console.error('Gemini TTS failed',{status:e.status??null,name:cause instanceof Error?cause.name:null});
    if(e.status===429||/quota|resource.exhausted/i.test(e.message||'')){await tripProviderQuota('tts');return error('PROVIDER_QUOTA_EXCEEDED',429);}
    if(/timeout|abort/i.test(e.message||''))return error('REQUEST_TIMEOUT',504);
    return error(e.status===401||e.status===403?'AI_ACCESS_DENIED':e.status===404?'AI_MODEL_UNAVAILABLE':'AI_SERVICE_UNAVAILABLE',e.status===401||e.status===403||e.status===404?503:502);
  }finally{if(hash)await release(hash);}
}
