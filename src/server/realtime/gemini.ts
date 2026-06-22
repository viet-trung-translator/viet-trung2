import WebSocket from 'ws';
import { config } from '../config.js';
import { Language } from '../auth/types.js';

export interface SessionCallbacks {
  /** Transcript of what the speaker actually said (source language). */
  onSourceText?: (text: string, final: boolean) => void;
  /** Transcript of the translation (target language). */
  onTranslatedText?: (text: string, final: boolean) => void;
  /** Translated speech as PCM16 mono @24kHz. */
  onTranslatedAudio?: (pcm: Buffer) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
}

export interface SessionOptions {
  /** 'auto' lets the model detect the language (used by single-device mode). */
  source: Language | 'auto';
  /** Target language, or 'auto' for the "the other one of the pair" behaviour. */
  target: Language | 'auto';
  mode: 'solo' | 'call';
}

export interface TranslationSession {
  /** Feed mic audio: PCM16 mono @16kHz. */
  sendAudio(pcm: Buffer): void;
  /** Signal the current utterance is complete (optional helper). */
  endTurn?(): void;
  close(): void;
}

const LANG_NAME: Record<Language, string> = { vi: 'Vietnamese', zh: 'Chinese (Mandarin)' };

const STRICT_RULES = [
  'You are a simultaneous interpreter MACHINE, not an assistant.',
  'You must NEVER answer, reply to, react to, or have a conversation about the content.',
  'If the speaker asks a question, translate the question itself — do NOT answer it.',
  'Output ONLY the verbatim translation of what was said — nothing else: no greetings,',
  'no commentary, no extra words. Preserve the speaker’s tone and keep it natural.',
].join(' ');

const DOMAIN_CONTEXT = [
  'Context: the conversation happens in a factory / manufacturing / office / business',
  'setting (e.g. a Chinese manager speaking with Vietnamese workers). Prefer accurate,',
  'standard terminology for manufacturing, production lines, quality control, logistics,',
  'HR, and workplace/business topics. Translate numbers, quantities, prices, dates, and',
  'product/part codes exactly and carefully.',
].join(' ');

function glossaryBlock(): string {
  if (!config.glossary) return '';
  return [
    'ALWAYS use these preferred company translations for the listed terms exactly and',
    'consistently (format "Vietnamese = Chinese"):\n' + config.glossary,
  ].join(' ');
}

function buildSystemInstruction(opts: SessionOptions): string {
  const core =
    opts.source === 'auto' || opts.target === 'auto'
      ? [
          'You translate spoken language between Vietnamese and Chinese (Mandarin).',
          'Detect the language of each utterance: if it is Vietnamese, output its Chinese',
          'translation; if it is Chinese, output its Vietnamese translation.',
        ].join(' ')
      : `You translate ${LANG_NAME[opts.source]} speech into ${LANG_NAME[opts.target]}.`;

  return [core, STRICT_RULES, DOMAIN_CONTEXT, glossaryBlock()].filter(Boolean).join(' ');
}

const GEMINI_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';

/**
 * Live session backed by Google's Gemini Live (BidiGenerateContent) WebSocket API.
 * Audio in: PCM16 mono 16kHz. Audio out: PCM16 mono 24kHz.
 */
class GeminiLiveSession implements TranslationSession {
  private ws: WebSocket;
  private ready = false;
  private queue: Buffer[] = [];
  private closed = false;

  constructor(private opts: SessionOptions, private cb: SessionCallbacks) {
    const url = `${GEMINI_WS_URL}?key=${encodeURIComponent(config.gemini.apiKey)}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      const setup = {
        setup: {
          model: `models/${config.gemini.model}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            temperature: 0,
          },
          systemInstruction: {
            parts: [{ text: buildSystemInstruction(opts) }],
          },
          // Snappier turn detection: translate almost immediately after a short
          // pause (~0.4s) instead of waiting for a long silence (~0.8s default),
          // so it feels near real-time. Mic is still gated client-side while the
          // translation plays, to avoid echo.
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
              endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
              prefixPaddingMs: 60,
              silenceDurationMs: 400,
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };
      this.ws.send(JSON.stringify(setup));
    });

    this.ws.on('message', (data: WebSocket.RawData) => this.handleMessage(data));
    this.ws.on('unexpected-response', (_req, res) => {
      const msg = `gemini http ${res.statusCode} ${res.statusMessage ?? ''}`.trim();
      console.error('[gemini]', msg);
      this.cb.onError?.(new Error(msg));
    });
    this.ws.on('error', (err) => {
      console.error('[gemini] ws error:', (err as Error).message);
      this.cb.onError?.(err as Error);
    });
    this.ws.on('close', (code: number, reason: Buffer) => {
      this.closed = true;
      const r = reason?.toString().slice(0, 160) ?? '';
      console.error(`[gemini] closed code=${code} reason=${r} ready=${this.ready}`);
      if (!this.ready && code !== 1000) {
        this.cb.onError?.(new Error(`gemini closed before ready: ${code} ${r}`));
      }
      this.cb.onClose?.();
    });

    // Watchdog: report if the Gemini handshake never completes.
    setTimeout(() => {
      if (!this.ready && !this.closed) {
        console.error('[gemini] setup did not complete within 8s');
        this.cb.onError?.(new Error('gemini setup timeout (no setupComplete in 8s)'));
      }
    }, 8000);
  }

  private handleMessage(data: WebSocket.RawData): void {
    let msg: any;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.setupComplete) {
      this.ready = true;
      console.log(`[gemini] setupComplete (model=${config.gemini.model}), flushing ${this.queue.length} queued chunks`);
      for (const buf of this.queue) this.pushAudio(buf);
      this.queue = [];
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.inputTranscription?.text) {
      this.cb.onSourceText?.(sc.inputTranscription.text, Boolean(sc.turnComplete));
    }
    if (sc.outputTranscription?.text) {
      this.cb.onTranslatedText?.(sc.outputTranscription.text, Boolean(sc.turnComplete));
    }
    const parts = sc.modelTurn?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data && String(inline.mimeType ?? '').startsWith('audio/')) {
        this.cb.onTranslatedAudio?.(Buffer.from(inline.data, 'base64'));
      }
    }
  }

  private pushAudio(pcm: Buffer): void {
    const payload = {
      realtimeInput: {
        audio: { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
      },
    };
    this.ws.send(JSON.stringify(payload));
  }

  sendAudio(pcm: Buffer): void {
    if (this.closed) return;
    if (!this.ready) {
      this.queue.push(pcm);
      return;
    }
    this.pushAudio(pcm);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Fallback used when GEMINI_API_KEY is not configured. It does NOT translate;
 * it echoes mic audio back and emits placeholder transcripts so the full
 * client↔server audio pipeline can be exercised locally.
 */
class EchoSession implements TranslationSession {
  private closed = false;
  constructor(private cb: SessionCallbacks) {
    setTimeout(() => {
      this.cb.onSourceText?.('(echo mode — no GEMINI_API_KEY set)', true);
      this.cb.onTranslatedText?.('(echo mode — audio is played back untranslated)', true);
    }, 200);
  }
  sendAudio(pcm: Buffer): void {
    if (this.closed) return;
    // Echo straight back (16k -> client plays at 24k, so it will sound high-pitched;
    // this is only a connectivity sanity check, not real translation).
    this.cb.onTranslatedAudio?.(pcm);
  }
  close(): void {
    this.closed = true;
    this.cb.onClose?.();
  }
}

export function createTranslationSession(
  opts: SessionOptions,
  cb: SessionCallbacks,
): TranslationSession {
  if (!config.gemini.apiKey) {
    return new EchoSession(cb);
  }
  return new GeminiLiveSession(opts, cb);
}
