function numberEnv(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Invalid ${name}`);
  return parsed;
}

export function config() {
  return {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    perIp: numberEnv('LIMIT_REQUESTS_PER_IP', 5, 1, 100),
    windowSeconds: numberEnv('LIMIT_WINDOW_SECONDS', 3600, 60, 86400),
    daily: numberEnv('LIMIT_DAILY_REQUESTS', 50, 1, 100000),
    safetyPercent: numberEnv('LIMIT_DAILY_SAFETY_PERCENT', 80, 1, 100),
    messageChars: numberEnv('LIMIT_MESSAGE_CHARS', 2000, 1, 10000),
    historyMessages: numberEnv('LIMIT_HISTORY_MESSAGES', 10, 0, 30),
    audioBytes: numberEnv('LIMIT_AUDIO_BYTES', 3000000, 1000, 4000000),
    audioSeconds: numberEnv('LIMIT_AUDIO_SECONDS', 120, 1, 600),
    concurrent: numberEnv('LIMIT_CONCURRENT_PER_IP', 1, 1, 10),
  };
}
