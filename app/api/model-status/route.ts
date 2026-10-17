import { GoogleGenAI } from '@google/genai';
import { config } from '../../../lib/config';

export const runtime = 'nodejs';

export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({getStatus:503, listStatus:null, models:[]}, {status:503, headers:{'Cache-Control':'no-store'}});
  const ai = new GoogleGenAI({apiKey:key});
  let getStatus = 200;
  try {
    await ai.models.get({model:config().model});
  } catch (cause) {
    const status = (cause as {status?:number}).status;
    getStatus = Number.isInteger(status) ? status! : 502;
  }
  let listStatus = 200;
  let models: string[] = [];
  try {
    const page = await ai.models.list();
    models = page.page.map(model => model.name || '').filter(name => /^models\/gemini-/.test(name)).slice(0,100);
  } catch (cause) {
    const status = (cause as {status?:number}).status;
    listStatus = Number.isInteger(status) ? status! : 502;
  }
  return Response.json({getStatus,listStatus,models}, {headers:{'Cache-Control':'no-store'}});
}
