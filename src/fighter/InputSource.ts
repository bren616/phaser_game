import { InputAction } from '../config/Inputs';

export interface InputEvent {
  action: InputAction;
  pressed: boolean;
}

export interface InputSource {
  // Returns press/release edge events since last poll.
  poll(): InputEvent[];
  // Is this raw (physical) action currently held?
  isDown(action: InputAction): boolean;
}

// Merges multiple input sources — player can use keyboard or gamepad interchangeably.
export class CompositeInputSource implements InputSource {
  private sources: InputSource[];

  constructor(...sources: InputSource[]) {
    this.sources = sources;
  }

  poll(): InputEvent[] {
    const seen = new Set<string>();
    const events: InputEvent[] = [];
    for (const src of this.sources) {
      for (const e of src.poll()) {
        const key = `${e.action}:${e.pressed}`;
        if (!seen.has(key)) { seen.add(key); events.push(e); }
      }
    }
    return events;
  }

  isDown(action: InputAction): boolean {
    return this.sources.some(s => s.isDown(action));
  }
}
