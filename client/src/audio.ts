import { AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE } from './types';

/**
 * Handles mic capture (PCM16 mono @16kHz) and playback of translated audio
 * (PCM16 mono @24kHz). Implements half-duplex gating: while translated audio
 * is playing, mic frames are suppressed to avoid echo/feedback loops.
 */
export class AudioEngine {
  private stream: MediaStream | null = null;
  private inputCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private outputCtx: AudioContext | null = null;
  private playhead = 0;

  private onChunk: ((pcm: ArrayBuffer) => void) | null = null;
  private gateWhilePlaying = true;

  /** When true and audio is currently playing, mic frames are dropped. */
  setHalfDuplex(enabled: boolean): void {
    this.gateWhilePlaying = enabled;
  }

  get isPlaying(): boolean {
    if (!this.outputCtx) return false;
    return this.playhead > this.outputCtx.currentTime + 0.02;
  }

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    this.onChunk = onChunk;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.inputCtx = new AudioContext();
    await this.inputCtx.resume();
    this.source = this.inputCtx.createMediaStreamSource(this.stream);
    this.processor = this.inputCtx.createScriptProcessor(4096, 1, 1);

    const inRate = this.inputCtx.sampleRate;
    this.processor.onaudioprocess = (e) => {
      if (!this.onChunk) return;
      if (this.gateWhilePlaying && this.isPlaying) return; // half-duplex
      const input = e.inputBuffer.getChannelData(0);
      const pcm = downsampleToInt16(input, inRate, AUDIO_INPUT_SAMPLE_RATE);
      if (pcm.byteLength > 0) this.onChunk(pcm.buffer as ArrayBuffer);
    };

    // ScriptProcessor must be connected to the graph to fire. Route through a
    // muted gain so the mic is never looped back to the speakers.
    const sink = this.inputCtx.createGain();
    sink.gain.value = 0;
    this.source.connect(this.processor);
    this.processor.connect(sink);
    sink.connect(this.inputCtx.destination);

    this.ensureOutput();
  }

  private ensureOutput(): void {
    if (!this.outputCtx) {
      this.outputCtx = new AudioContext({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
      this.playhead = this.outputCtx.currentTime;
    }
    void this.outputCtx.resume();
  }

  /** Enqueue translated PCM16 audio (mono, 24kHz) for playback. */
  playPcm(data: ArrayBuffer): void {
    this.ensureOutput();
    const ctx = this.outputCtx!;
    const int16 = new Int16Array(data);
    if (int16.length === 0) return;
    const buffer = ctx.createBuffer(1, int16.length, AUDIO_OUTPUT_SAMPLE_RATE);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < int16.length; i++) ch[i] = int16[i] / 0x8000;

    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, this.playhead);
    node.start(startAt);
    this.playhead = startAt + buffer.duration;
  }

  stop(): void {
    this.onChunk = null;
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.inputCtx?.close().catch(() => {});
    this.inputCtx = null;
    this.outputCtx?.close().catch(() => {});
    this.outputCtx = null;
    this.playhead = 0;
  }
}

function downsampleToInt16(input: Float32Array, inRate: number, outRate: number): Int16Array {
  if (outRate >= inRate) {
    // No downsampling needed; just convert.
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = floatToInt16(input[i]);
    return out;
  }
  const ratio = inRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  let pos = 0;
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[pos++] = floatToInt16(count > 0 ? sum / count : 0);
  }
  return out;
}

function floatToInt16(v: number): number {
  const s = Math.max(-1, Math.min(1, v));
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}
