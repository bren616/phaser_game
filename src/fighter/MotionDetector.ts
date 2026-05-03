import { InputAction } from '../config/Inputs';
import { InputBuffer } from './InputBuffer';

// A motion is a sequence of directions that must appear in order within a window.
// We only care about press events for direction transitions.
export type Motion = InputAction[];

export const MOTIONS = {
  QCF: [InputAction.Down, InputAction.Forward], // simplified: down then forward
  QCB: [InputAction.Down, InputAction.Back],
  DP:  [InputAction.Forward, InputAction.Down, InputAction.Forward],
};

export class MotionDetector {
  // Returns true if the given motion completed within `windowFrames`
  // ending on the current frame, optionally followed by a button press.
  static detect(
    buffer: InputBuffer,
    motion: Motion,
    button: InputAction | null,
    windowFrames: number = 15,
    heldActions: Set<InputAction> = new Set()
  ): boolean {
    const recent = buffer.getRecent();
    const cutoff = buffer.frame - windowFrames;
    const relevant = recent.filter(b => b.frame >= cutoff && b.pressed);

    // Walk through the motion sequence, advancing as we find each direction in order
    let motionIdx = 0;
    let lastFrame = -1;
    for (const input of relevant) {
      if (input.action === motion[motionIdx]) {
        if (input.frame >= lastFrame) {
          lastFrame = input.frame;
          motionIdx++;
          if (motionIdx === motion.length) break;
        }
      }
    }

    // If the first direction was never found in the window but is currently held,
    // it was pressed before the window started (e.g. walking forward into a DP).
    // Treat it as if it was at the start of the window and re-scan for the rest.
    if (motionIdx === 0 && motion.length > 0 && heldActions.has(motion[0])) {
      lastFrame = cutoff;
      motionIdx = 1;
      for (const input of relevant) {
        if (motionIdx >= motion.length) break;
        if (input.action === motion[motionIdx] && input.frame >= lastFrame) {
          lastFrame = input.frame;
          motionIdx++;
        }
      }
    }

    // If only the final direction is missing, accept it being currently held.
    // This handles DP: hold Forward, press Down, hold both (df), press button —
    // the second Forward is never a new press event, but it is held at button time.
    if (motionIdx === motion.length - 1 && heldActions.has(motion[motionIdx])) {
      motionIdx++;
    }

    if (motionIdx < motion.length) return false;

    // If a button is required, it must come at or after the last direction
    if (button) {
      return relevant.some(b => b.action === button && b.frame >= lastFrame);
    }
    return true;
  }
}