/* Mise's voice at the stove: a neural text-to-speech call, made server-side so
   the key never reaches the browser.

   Which engine, in order:
     TTS_PROVIDER=openai|gemini|none forces one.
     Otherwise OpenAI if OPENAI_API_KEY is set (gpt-4o-mini-tts: natural, takes
     a direction for tone, low latency), else Gemini TTS on the keys the app
     already has (GEMINI_API_KEYS / GEMINI_API_KEY), else none — and the client
     falls back to the phone's built-in voice.

   Both return audio bytes the browser plays through an <audio> element. That
   matters on iPhone: speechSynthesis and Web Audio follow the ring/silent
   switch, a media element in a "playback" audio session does not. */

const VOICE_DIRECTION =
  "A warm, unhurried, friendly chef talking someone through dinner in their own kitchen. " +
  "Clear and calm, a little smile in the voice. Natural pace; never salesy.";

function geminiKeys() {
  const multi = process.env.GEMINI_API_KEYS;
  if (multi) {
    const keys = multi.split(",").map((k) => k.trim()).filter(Boolean);
    if (keys.length) return keys;
  }
  return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

export function ttsProvider() {
  const forced = (process.env.TTS_PROVIDER || "").toLowerCase();
  if (forced === "none") return null;
  if (forced === "openai") return process.env.OPENAI_API_KEY ? "openai" : null;
  if (forced === "gemini") return geminiKeys().length ? "gemini" : null;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (geminiKeys().length) return "gemini";
  return null;
}

async function openaiSpeech(text) {
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "coral",
      input: text,
      instructions: VOICE_DIRECTION,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`openai tts ${r.status}`);
  return { body: Buffer.from(await r.arrayBuffer()), type: "audio/mpeg" };
}

/* Gemini returns raw 16-bit PCM (24 kHz mono); a browser needs a container. */
function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let geminiIndex = 0;
async function geminiSpeech(text) {
  const keys = geminiKeys();
  /* gemini-3.8-flash-lite-tts, streamed: measured Oct 2026, a step's audio
     is complete in ~1.9s, against ~5.4s for gemini-2.5-flash-preview-tts
     (which also only ever returns it in one piece). */
  const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";
  let lastErr;
  for (let n = 0; n < keys.length; n++) {
    const i = (geminiIndex + n) % keys.length;
    // Streamed: the newer TTS models send audio in pieces as it's made, which
    // finishes far sooner than waiting for one big response.
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": keys[i] },
      body: JSON.stringify({
        // The 3.x TTS models read any direction aloud along with the line (and
        // reject a system instruction), so they get the line alone; their
        // default delivery is already calm. 2.5 still takes the direction.
        contents: [{ parts: [{ text: /2\.5/.test(model) ? `${VOICE_DIRECTION} Say: ${text}` : text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.GEMINI_TTS_VOICE || "Sulafat" } } },
        },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (r.status === 429 || r.status === 503) { lastErr = new Error(`gemini tts ${r.status}`); continue; }
    if (!r.ok) throw new Error(`gemini tts ${r.status}`);
    // Server-sent events: one JSON object per "data:" line, each carrying a
    // slice of raw 16-bit PCM (or, from some models, a complete WAV).
    const raw = await r.text();
    const pcm = [];
    let mime = "";
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
      for (const part of j?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) { pcm.push(Buffer.from(part.inlineData.data, "base64")); mime = part.inlineData.mimeType || mime; }
      }
    }
    if (!pcm.length) throw new Error("gemini tts: no audio");
    geminiIndex = i;
    if (/wav/i.test(mime) && pcm.length === 1) return { body: pcm[0], type: "audio/wav" };
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1]) || 24000;
    return { body: wav(Buffer.concat(pcm), rate), type: "audio/wav" };
  }
  throw lastErr || new Error("gemini tts: no key");
}

export async function synthesize(text) {
  const p = ttsProvider();
  if (p === "openai") return openaiSpeech(text);
  if (p === "gemini") return geminiSpeech(text);
  throw new Error("tts_unavailable");
}
