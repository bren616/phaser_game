import Phaser from 'phaser';
import { InputAction } from '../config/Inputs';
import { InputSource, InputEvent } from './InputSource';

// Standard HTML5 Gamepad API button indices (Xbox / PS layout).
// D-pad left/right use the same Back/Forward convention as keyboard maps —
// Fighter.ts applies the facing flip, so physical left = InputAction.Back here.
const BUTTON_MAP: Partial<Record<number, InputAction>> = {
  12: InputAction.Up,       // D-pad up
  13: InputAction.Down,     // D-pad down
  14: InputAction.Back,     // D-pad left  (physical)
  15: InputAction.Forward,  // D-pad right (physical)
  2:  InputAction.LP,       // X / Square
  3:  InputAction.MP,       // Y / Triangle
  5:  InputAction.HP,       // RB / R1
  0:  InputAction.LK,       // A / Cross
  1:  InputAction.MK,       // B / Circle
  4:  InputAction.HK,       // LB / L1
};

const AXIS_DEAD = 0.5;

export class GamepadInputSource implements InputSource {
  private plugin: Phaser.Input.Gamepad.GamepadPlugin;
  private padIndex: number;

  private prevButtons: Record<number, boolean> = {};
  private prevAxisHDir: InputAction | null = null;
  private prevAxisVDir: InputAction | null = null;

  constructor(plugin: Phaser.Input.Gamepad.GamepadPlugin, padIndex: number) {
    this.plugin   = plugin;
    this.padIndex = padIndex;
  }

  private getPad(): Phaser.Input.Gamepad.Gamepad | null {
    return this.plugin.gamepads[this.padIndex] ?? null;
  }

  poll(): InputEvent[] {
    const events: InputEvent[] = [];
    const pad = this.getPad();
    if (!pad) return events;

    // Button edges
    for (const [idxStr, action] of Object.entries(BUTTON_MAP) as [string, InputAction][]) {
      const idx    = Number(idxStr);
      const isDown = (pad.buttons[idx]?.value ?? 0) > 0.5;
      const was    = this.prevButtons[idx] ?? false;
      if (isDown && !was) events.push({ action, pressed: true });
      else if (!isDown && was) events.push({ action, pressed: false });
      this.prevButtons[idx] = isDown;
    }

    // Left stick horizontal → Forward / Back
    const axH  = pad.axes[0]?.getValue() ?? 0;
    const dirH: InputAction | null = Math.abs(axH) > AXIS_DEAD
      ? (axH > 0 ? InputAction.Forward : InputAction.Back)
      : null;
    if (dirH !== this.prevAxisHDir) {
      if (this.prevAxisHDir !== null) events.push({ action: this.prevAxisHDir, pressed: false });
      if (dirH !== null)             events.push({ action: dirH,              pressed: true  });
      this.prevAxisHDir = dirH;
    }

    // Left stick vertical → Up / Down
    const axV  = pad.axes[1]?.getValue() ?? 0;
    const dirV: InputAction | null = Math.abs(axV) > AXIS_DEAD
      ? (axV < 0 ? InputAction.Up : InputAction.Down)
      : null;
    if (dirV !== this.prevAxisVDir) {
      if (this.prevAxisVDir !== null) events.push({ action: this.prevAxisVDir, pressed: false });
      if (dirV !== null)             events.push({ action: dirV,              pressed: true  });
      this.prevAxisVDir = dirV;
    }

    return events;
  }

  isDown(action: InputAction): boolean {
    const pad = this.getPad();
    if (!pad) return false;

    for (const [idxStr, mapped] of Object.entries(BUTTON_MAP) as [string, InputAction][]) {
      if (mapped === action && (pad.buttons[Number(idxStr)]?.value ?? 0) > 0.5) return true;
    }

    const axH = pad.axes[0]?.getValue() ?? 0;
    const axV = pad.axes[1]?.getValue() ?? 0;
    if (action === InputAction.Forward && axH >  AXIS_DEAD) return true;
    if (action === InputAction.Back    && axH < -AXIS_DEAD) return true;
    if (action === InputAction.Up      && axV < -AXIS_DEAD) return true;
    if (action === InputAction.Down    && axV >  AXIS_DEAD) return true;

    return false;
  }
}
