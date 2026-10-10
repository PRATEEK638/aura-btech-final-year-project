function pcmWav(base64, rate = 24000) {
  const pcm = Buffer.from(base64, 'base64');
  if (!pcm.length || pcm.length % 2) throw new Error('Gemini returned invalid PCM audio.');
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  return { base64: Buffer.concat([header, pcm]).toString('base64'), mime: 'audio/wav' };
}
async function geminiSpeech(request, credentials, text) {
  if (!credentials?.length) throw new Error('Import a valid Gemini voice key first.');
  let last;
  for (const key of [...new Set(credentials)]) {
    try {
      const response = await request('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Speak naturally and warmly: ' + String(text).slice(0, 3000) }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } } }),
      });
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData;
      if (!part?.data) throw new Error('Gemini returned no speech.');
      if (!part.mimeType?.startsWith('audio/L16')) throw new Error('Unsupported Gemini audio format.');
      return pcmWav(part.data, Number(part.mimeType.match(/rate=(\d+)/)?.[1] || 24000));
    } catch (error) {
      last = error;
      if (![400, 401, 403].includes(error.httpStatus)) throw error;
    }
  }
  throw new Error('Gemini voice authentication failed. Google rejected the supplied keys; use a valid Google AI Studio key or another voice provider.');
}
module.exports = { pcmWav, geminiSpeech };
