function numberEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Invalid ${name}`);
  return parsed;
}

export function config() {
  return {
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    perIp: numberEnv('LIMIT_REQUESTS_PER_IP', 30, 1, 100),
    windowSeconds: numberEnv('LIMIT_WINDOW_SECONDS', 60, 60, 86400),
    daily: numberEnv('LIMIT_DAILY_REQUESTS', 200, 1, 100000),
    messageChars: numberEnv('LIMIT_MESSAGE_CHARS', 2000, 1, 10000),
    historyMessages: numberEnv('LIMIT_HISTORY_MESSAGES', 10, 0, 30),
    audioBytes: numberEnv('LIMIT_AUDIO_BYTES', 3000000, 1000, 4000000),
    audioSeconds: numberEnv('LIMIT_AUDIO_SECONDS', 120, 1, 600),
    concurrent: numberEnv('LIMIT_CONCURRENT_PER_IP', 4, 1, 10),
  };
}
