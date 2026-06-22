// AudioWorklet processor that forwards mic PCM (Float32 @ context rate) to the
// main thread in ~2048-sample blocks. Used instead of the deprecated
// ScriptProcessorNode, which delivers silent buffers on iOS Safari.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(2048);
    this.idx = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const ch = input[0];
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.idx++] = ch[i];
        if (this.idx >= this.buf.length) {
          this.port.postMessage(this.buf.slice(0));
          this.idx = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
