import { GoogleGenAI } from '@google/genai';
import { config } from './config';
import { error } from './api';
import { tripProviderQuota } from './limits';

export type Content = {role:'user'|'model';parts:({text:string}|{inlineData:{mimeType:string;data:string}})[]};
export async function generate(contents: Content[], voiceReply=false) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return error('AI_SERVICE_UNAVAILABLE',503);
  try {
    const ai = new GoogleGenAI({apiKey:key});
    const response = await ai.models.generateContent({model:config().model, contents, config:{systemInstruction:voiceReply?'Reply helpfully in the user’s language. Keep the spoken response under 500 characters.':'Reply helpfully and concisely in the user’s language.',maxOutputTokens:voiceReply?180:1024,temperature:0.7},});
    const reply = response.text?.trim();
    if (!reply) {
      const reason=response.candidates?.[0]?.finishReason;
      console.error('Gemini returned no text',{finishReason:reason??null,outputTokens:response.usageMetadata?.candidatesTokenCount??null,thoughtTokens:response.usageMetadata?.thoughtsTokenCount??null});
      const failure=error('AI_SERVICE_UNAVAILABLE',502);
      if(typeof reason==='string' && /^[A-Z_]{2,40}$/.test(reason))failure.headers.set('X-Convico-Finish-Reason',reason);
      return failure;
    }
    if (voiceReply && reply.length>600) return error('AI_SERVICE_UNAVAILABLE',502);
    return Response.json({reply});
  } catch (cause) {
    const e = cause as {status?:number;message?:string};
    console.error('Gemini generation failed', {status:e.status ?? null});
    if (e.status === 429 || /quota|resource.exhausted/i.test(e.message || '')) { await tripProviderQuota(); return error('PROVIDER_QUOTA_EXCEEDED',429); }
    if (/timeout|abort/i.test(e.message || '')) return error('REQUEST_TIMEOUT',504);
    const failure=error('AI_SERVICE_UNAVAILABLE',e.status===401||e.status===403?503:502);
    if(Number.isInteger(e.status))failure.headers.set('X-Convico-Upstream-Status',String(e.status));
    return failure;
  }
}
