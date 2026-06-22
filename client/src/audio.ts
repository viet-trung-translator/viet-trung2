import { AUDIO_INPUT_SAMPLE_RATE, AUDIO_OUTPUT_SAMPLE_RATE } from './types';

// Frames quieter than this (RMS of the Float32 mic signal) are treated as
// non-speech and sent as silence, to avoid the model hallucinating on noise.
const SPEECH_RMS_THRESHOLD = 0.015;

/**
 * Handles mic capture (PCM16 mono @16kHz) and playback of translated audio
 * (PCM16 mono @24kHz). Implements half-duplex gating: while translated audio
 * is playing, mic frames are suppressed to avoid echo/feedback loops.
 *
 * iOS/Safari notes:
 *  - A single AudioContext is created and resumed *synchronously inside the
 *    user gesture* (before any await), otherwise audio playback stays muted.
 *  - We do NOT force a 24kHz context (older Safari rejects the sampleRate
 *    option). Playback buffers are created at 24kHz and the AudioBufferSource
 *    resamples them to the context's native rate automatically.
 */
export class AudioEngine {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  private playhead = 0;
  private onChunk: ((pcm: ArrayBuffer) => void) | null = null;
  private gateWhilePlaying = true;

  setHalfDuplex(enabled: boolean): void {
    this.gateWhilePlaying = enabled;
  }

  /**
   * Must be called synchronously from the click/tap handler (before any await)
   * so iOS treats the AudioContext as user-activated and allows playback.
   */
  prime(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
        window.AudioContext;
      this.ctx = new Ctor();
      this.playhead = this.ctx.currentTime;
    }
    // resume() kicks the context out of the "suspended" state on iOS.
    void this.ctx.resume();
  }

  get isPlaying(): boolean {
    if (!this.ctx) return false;
    return this.playhead > this.ctx.currentTime + 0.02;
  }

  /** True once mic capture has actually started. */
  get started(): boolean {
    return this.processor !== null || this.worklet !== null;
  }

  async start(onChunk: (pcm: ArrayBuffer) => void): Promise<void> {
    this.onChunk = onChunk;
    this.prime(); // ensure context exists (no-op if prime() already called in gesture)

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const ctx = this.ctx!;
    await ctx.resume();
    this.source = ctx.createMediaStreamSource(this.stream);
    const inRate = ctx.sampleRate;

    const handleSamples = (input: Float32Array) => {
      if (!this.onChunk) return;
      if (this.gateWhilePlaying && this.isPlaying) return; // half-duplex
      // Noise gate: when the frame is quieter than speech (background hum,
      // machine noise, silence), send clean silence instead of the raw noise.
      // This stops the model from "hearing" noise and hallucinating phantom
      // sentences, while still streaming so end-of-turn is detected.
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      const pcm = downsampleToInt16(input, inRate, AUDIO_INPUT_SAMPLE_RATE);
      if (rms < SPEECH_RMS_THRESHOLD) pcm.fill(0);
      if (pcm.byteLength > 0) this.onChunk(pcm.buffer as ArrayBuffer);
    };

    // Muted sink so the mic is never looped back to the speakers but the
    // processing node stays in an active graph.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    sink.connect(ctx.destination);

    // Prefer AudioWorklet (reliable on iOS). Fall back to ScriptProcessor.
    let workletReady = false;
    if (ctx.audioWorklet) {
      try {
        await ctx.audioWorklet.addModule('/pcm-worklet.js');
        const node = new AudioWorkletNode(ctx, 'pcm-processor');
        node.port.onmessage = (e) => handleSamples(e.data as Float32Array);
        this.source.connect(node);
        node.connect(sink);
        this.worklet = node;
        workletReady = true;
      } catch {
        workletReady = false;
      }
    }

    if (!workletReady) {
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = (e) => handleSamples(e.inputBuffer.getChannelData(0));
      this.source.connect(proc);
      proc.connect(sink);
      this.processor = proc;
    }
  }

  /** Enqueue translated PCM16 audio (mono, 24kHz) for playback. */
  playPcm(data: ArrayBuffer): void {
    if (!this.ctx) this.prime();
    const ctx = this.ctx!;
    void ctx.resume();
    const int16 = new Int16Array(data);
    if (int16.length === 0) return;
    // Buffer declared at 24kHz; the source node resamples to ctx.sampleRate.
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
    if (this.worklet) {
      this.worklet.port.onmessage = null;
      this.worklet.disconnect();
      this.worklet = null;
    }
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.playhead = 0;
  }
}

function downsampleToInt16(input: Float32Array, inRate: number, outRate: number): Int16Array {
  if (outRate >= inRate) {
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
