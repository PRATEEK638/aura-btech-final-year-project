// Schedules streamed mono PCM in order; never waits for a complete audio file.
export class PcmPlayer {
  constructor({ onStart, onEnd, onError, cleanup = () => {} }) {
    this.context = new AudioContext({ sampleRate: 24000 });
    this.next = this.context.currentTime + 0.08;
    this.pending = new Uint8Array();
    this.sources = new Set();
    this.ended = false;
    this.closed = false;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.onError = onError;
    this.cleanup = cleanup;
    this.context.resume().catch(onError);
  }
  push(bytes) {
    if (this.closed) return;
    try {
      const all = new Uint8Array(this.pending.length + bytes.length);
      all.set(this.pending);
      all.set(bytes, this.pending.length);
      const size = all.length - (all.length % 2);
      this.pending = all.slice(size);
      if (!size) return;
      const buffer = this.context.createBuffer(1, size / 2, 24000),
        data = buffer.getChannelData(0),
        view = new DataView(all.buffer);
      for (let i = 0; i < data.length; i++)
        data[i] = view.getInt16(i * 2, true) / 32768;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        this.finish();
      };
      const at = Math.max(this.next, this.context.currentTime + 0.025);
      source.start(at);
      this.next = at + buffer.duration;
      if (!this.started) {
        this.started = true;
        this.onStart();
      }
    } catch (e) {
      this.onError(e);
      this.pause();
    }
  }
  done() {
    this.ended = true;
    this.finish();
  }
  finish() {
    if (this.ended && !this.sources.size && !this.closed) {
      this.pause();
      this.onEnd();
    }
  }
  pause() {
    if (this.closed) return;
    this.closed = true;
    for (const s of this.sources) s.stop();
    this.sources.clear();
    this.context.close().catch(() => {});
    this.cleanup();
  }
}
