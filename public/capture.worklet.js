// Runs on the audio thread: keeps listening when the tab is hidden or the screen refresh rate
// changes. Every HOP samples it posts the latest WINDOW samples and the audio-clock time of the
// window's end, so all analysis and recording share one clock with the context.
const WINDOW = 2048;
const HOP = 1024;

class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.win = new Float32Array(WINDOW);
    this.sinceHop = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    this.win.copyWithin(0, ch.length);
    this.win.set(ch, WINDOW - ch.length);
    this.sinceHop += ch.length;
    if (this.sinceHop >= HOP) {
      this.sinceHop = 0;
      // currentFrame / sampleRate are AudioWorkletGlobalScope globals (context time).
      this.port.postMessage({ win: this.win.slice(), t: (currentFrame + ch.length) / sampleRate });
    }
    return true;
  }
}

registerProcessor('capture', Capture);
