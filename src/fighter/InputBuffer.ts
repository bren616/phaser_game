import { InputAction } from '../config/Inputs';

export interface BufferedInput {
  action: InputAction;
  frame: number;
  pressed: boolean; // true = press, false = release
}

export class InputBuffer {
  private buffer: BufferedInput[] = [];
  private currentFrame = 0;
  private maxAgeFrames: number;

  constructor(maxAgeFrames: number) {
    this.maxAgeFrames = maxAgeFrames;
  }

  tick() {
    this.currentFrame++;
    // Drop entries older than the buffer window
    const cutoff = this.currentFrame - this.maxAgeFrames;
    this.buffer = this.buffer.filter(b => b.frame >= cutoff);
  }

  record(action: InputAction, pressed: boolean) {
    this.buffer.push({ action, frame: this.currentFrame, pressed });
  }

  getRecent(): BufferedInput[] {
    return [...this.buffer];
  }

  get frame() { return this.currentFrame; }
}