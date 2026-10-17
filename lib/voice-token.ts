import {createHash,createHmac,randomUUID,timingSafeEqual} from 'crypto';

function secret() {
  const value=process.env.TTS_SIGNING_SECRET;
  if(!value || value.length<32) throw new Error('TTS signing secret unavailable');
  return value;
}
function digest(text:string) {return createHash('sha256').update(text).digest('hex');}
export function voiceToken(text:string) {
  const payload=Buffer.from(JSON.stringify({v:1,id:randomUUID(),digest:digest(text)})).toString('base64url');
  const signature=createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function validVoiceToken(text:string,token:string) {
  try {
    const [payload,signature,extra]=token.split('.');
    if(extra || !payload || !signature || token.length>500)return false;
    const expected=createHmac('sha256',secret()).update(payload).digest();
    const supplied=Buffer.from(signature,'base64url');
    if(expected.length!==supplied.length || !timingSafeEqual(expected,supplied))return false;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return data.v===1 && data.digest===digest(text) && typeof data.id==='string';
  }catch{return false;}
}
