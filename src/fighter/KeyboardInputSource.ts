import Phaser from 'phaser';
import { InputAction } from '../config/Inputs';
import { InputSource, InputEvent } from './InputSource';

export class KeyboardInputSource implements InputSource {
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prevState: Record<string, boolean> = {};
  private keyMap: Record<string, InputAction>;

  constructor(scene: Phaser.Scene, keyMap: Record<string, InputAction>) {
    this.keyMap = keyMap;
    for (const key of Object.keys(keyMap)) {
      this.keys[key] = scene.input.keyboard!.addKey(key);
      this.prevState[key] = false;
    }
  }

  poll(): InputEvent[] {
    const events: InputEvent[] = [];
    for (const [key, action] of Object.entries(this.keyMap)) {
      const isDown  = this.keys[key].isDown;
      const wasDown = this.prevState[key];
      if (isDown && !wasDown)  events.push({ action, pressed: true });
      else if (!isDown && wasDown) events.push({ action, pressed: false });
      this.prevState[key] = isDown;
    }
    return events;
  }

  isDown(action: InputAction): boolean {
    for (const [key, mapped] of Object.entries(this.keyMap)) {
      if (mapped === action && this.keys[key].isDown) return true;
    }
    return false;
  }
}
