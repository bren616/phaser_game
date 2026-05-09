import Phaser from 'phaser';
import { InputAction } from '../config/Inputs';
import { InputBuffer } from './InputBuffer';
import { FighterStateName } from './FighterState';
import { FIGHTER, INPUT_BUFFER_FRAMES } from '../config/GameConfig';
import { Box, FrameData } from './BoxDef';
import { FIGHTER_ANIMS } from '../data/FighterAnimations';
import { MOTIONS, MotionDetector } from './MotionDetector';
import { InputSource } from './InputSource';

const LOOPING_FRAME_COUNTS: Partial<Record<FighterStateName, number>> = {
  [FighterStateName.Idle]:        4,
  [FighterStateName.WalkForward]: 4,
  [FighterStateName.WalkBack]:    4,
  [FighterStateName.JumpAir]:     3,
};

// Game frames between visual frame advances for idle/walk (≈ 5 fps at 60 fps).
const VISUAL_FRAME_DURATION = 12;
// Game frames between visual frame advances for jump (≈ 5 fps at 60 fps).
const JUMP_FRAME_DURATION = 32;

export class Fighter {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;
  body: Phaser.Physics.Arcade.Body;
  buffer: InputBuffer;
  facing: 1 | -1 = 1;

  opponentX = 0;
  justStartedThrow = false;

  private _state: FighterStateName = FighterStateName.Idle;
  private animFrameIdx  = 0;
  private animFrameTimer = 0;

  // Visual frame cycling for looping states (idle, walk, jump).
  private visualFrameIdx   = 0;
  private visualFrameTimer = 0;

  get state(): FighterStateName { return this._state; }

  private setState(next: FighterStateName) {
    if (this._state === next) return;
    this._state         = next;
    this.animFrameIdx   = 0;
    this.animFrameTimer = 0;
    this.visualFrameIdx   = 0;
    this.visualFrameTimer = 0;
    this.hasHit         = false;

    if (next === FighterStateName.AttackShoryuken) {
      this.body.setVelocityY(-850);
      this.body.setVelocityX(150 * this.facing);
    }
    if (next === FighterStateName.AttackThrow) {
      this.justStartedThrow = true;
    }
    if (next === FighterStateName.Idle) {
      this.comboCount = 0;
    }
  }

  // --- Hit detection API ---

  canHit(): boolean { return !this.hasHit; }
  registerHit() { this.hasHit = true; }

  isBlocking(): boolean {
    const grounded = this.body.blocked.down || this.body.touching.down;
    return grounded && this.isHeld(InputAction.Back);
  }

  receiveHit(knockbackVx: number, hitstunFrames = 15, damage = 10, knockdown = false) {
    if (this.isInvincible()) return;
    if (this.isBlocking()) {
      const chip = Math.max(1, Math.round(damage * 0.1));
      this.hp = Math.max(1, this.hp - chip);
      this.setState(FighterStateName.BlockStun);
      this.hitstunTimer = Math.round(hitstunFrames * 0.65);
      this.body.setVelocityX(knockbackVx * 0.4);
    } else if (knockdown) {
      this.comboCount++;
      this.hp = Math.max(0, this.hp - damage);
      this.setState(FighterStateName.KnockdownFall);
      this.body.setVelocityY(-380);
      this.body.setVelocityX(knockbackVx * 1.4);
    } else {
      this.comboCount++;
      this.hp = Math.max(0, this.hp - damage);
      this.setState(FighterStateName.HitStun);
      this.hitstunTimer = hitstunFrames;
      this.body.setVelocityX(knockbackVx);
    }
  }

  isDead(): boolean { return this.hp <= 0; }

  isThrowable(): boolean {
    const grounded = this.body.blocked.down || this.body.touching.down;
    return grounded
      && this._state !== FighterStateName.HitStun
      && this._state !== FighterStateName.KnockdownFall
      && this._state !== FighterStateName.KnockdownGround
      && this._state !== FighterStateName.WakeUp
      && this._state !== FighterStateName.AttackThrow;
  }

  receiveThrow(landX: number, attackerFacing: number) {
    if (this._state === FighterStateName.WakeUp) return;
    this.comboCount++;
    this.hp = Math.max(0, this.hp - 15);
    this.body.reset(landX, this.sprite.y);
    this.setState(FighterStateName.KnockdownFall);
    this.body.setVelocityY(-280);
    this.body.setVelocityX(220 * attackerFacing);
  }

  nudge(dx: number) {
    this.body.x += dx;
    this.sprite.x += dx;
  }

  flash(frames = 6, color = 0xffffff) {
    this.flashTimer = frames;
    this.sprite.setTint(color);
  }

  private tickFlash() {
    if (this.flashTimer <= 0) return;
    this.flashTimer--;
    if (this.flashTimer === 0) this.sprite.clearTint();
  }

  resetForRound(x: number, y: number) {
    this.hp                   = this.maxHp;
    this.comboCount           = 0;
    this._state               = FighterStateName.Idle;
    this.animFrameIdx         = 0;
    this.animFrameTimer       = 0;
    this.visualFrameIdx       = 0;
    this.visualFrameTimer     = 0;
    this.hasHit               = false;
    this.hitstunTimer         = 0;
    this.knockdownGroundTimer = 0;
    this.flashTimer           = 0;
    this.sprite.clearTint();
    this.body.reset(x, y);
  }

  // Returns hitboxes/hurtboxes transformed into world space.
  // Uses body coordinates directly so it works regardless of sprite canvas size.
  private toWorld(box: Box): Box {
    const bx   = this.body.x + this.body.halfWidth;
    const by   = this.body.y + this.body.height;
    const flip = this.facing === -1;
    return { x: flip ? bx - box.x - box.w : bx + box.x, y: by + box.y, w: box.w, h: box.h };
  }

  getWorldHitboxes():  Box[] { return (this.getActiveFrameData()?.hitboxes  ?? []).map(b => this.toWorld(b)); }
  getWorldHurtboxes(): Box[] { return (this.getActiveFrameData()?.hurtboxes ?? []).map(b => this.toWorld(b)); }

  private advanceAnim() {
    const anim = FIGHTER_ANIMS[this._state];
    if (!anim || this.animFrameIdx >= anim.length) return;
    this.animFrameTimer++;
    if (this.animFrameTimer >= anim[this.animFrameIdx].duration &&
        this.animFrameIdx < anim.length - 1) {
      const prevIdx = this.animFrameIdx;
      this.animFrameIdx++;
      this.animFrameTimer = 0;

      if (this._state === FighterStateName.AttackHadouken && prevIdx === 0) {
        this._projectileRequest = {
          x:  this.sprite.x + 50 * this.facing,
          y:  this.body.y + this.body.halfHeight,
          vx: 420 * this.facing,
        };
      }
    }
  }

  // Advance the visual frame counter for looping states (idle, walk, jump).
  private advanceVisualFrame() {
    const count = LOOPING_FRAME_COUNTS[this._state];
    if (!count) return;
    const duration = this._state === FighterStateName.JumpAir ? JUMP_FRAME_DURATION : VISUAL_FRAME_DURATION;
    this.visualFrameTimer++;
    if (this.visualFrameTimer >= duration) {
      this.visualFrameTimer = 0;
      this.visualFrameIdx = (this.visualFrameIdx + 1) % count;
    }
  }

  // Return the texture key and frame index for the current state.
  private currentTexture(): { key: string; frame: number } {
    switch (this._state) {
      case FighterStateName.WalkForward:
        return { key: 'fighter-walk', frame: this.visualFrameIdx };
      case FighterStateName.WalkBack:
        return { key: 'fighter-walk', frame: (LOOPING_FRAME_COUNTS[FighterStateName.WalkForward]! - 1) - this.visualFrameIdx };
      case FighterStateName.JumpAir:
        return { key: 'fighter-jumpair', frame: this.visualFrameIdx };
      case FighterStateName.AttackLP:
        return { key: 'fighter-attackLP', frame: Math.min(this.animFrameIdx, 2) };
      default:
        return { key: 'fighter-idle', frame: this.visualFrameIdx };
    }
  }

  // Set the sprite frame and resize the physics body to match the canvas.
  // Assumes the character's feet sit at the bottom-center of each source canvas.
  private applySpriteFrame() {
    const { key, frame } = this.currentTexture();
    this.sprite.setTexture(key, frame);
    this.sprite.setFlipX(this.facing === -1);

    const f   = this.sprite.frame;
    const srcW = f.realWidth;
    const srcH = f.realHeight;
    this.body.setSize(FIGHTER.width, FIGHTER.height, false);
    this.body.setOffset(
      (srcW - FIGHTER.width)  / 2,
      srcH - FIGHTER.height - 50,
    );
  }

  getActiveFrameData(): FrameData | null {
    const anim = FIGHTER_ANIMS[this._state];
    if (!anim || anim.length === 0) return null;
    return anim[Math.min(this.animFrameIdx, anim.length - 1)];
  }

  private isInGroundAttackState(): boolean {
    return this._state === FighterStateName.AttackLP
        || this._state === FighterStateName.AttackCrouchLP
        || this._state === FighterStateName.AttackStandHP
        || this._state === FighterStateName.AttackThrow
        || this._state === FighterStateName.AttackHadouken
        || this._state === FighterStateName.AttackShoryuken;
  }

  private isInAirAttackState(): boolean {
    return this._state === FighterStateName.AttackJumpLP;
  }

  isInvincible(): boolean {
    return this._state === FighterStateName.WakeUp
        || (this._state === FighterStateName.DashBack && this.animFrameIdx === 0);
  }

  private justDoubleTapped(action: InputAction, windowFrames = 12, minGap = 3): boolean {
    const lastFrame = this.buffer.frame - 1;
    const presses = this.buffer.getRecent()
      .filter(b => b.action === action && b.pressed && b.frame >= lastFrame - windowFrames);
    if (presses.length < 2) return false;
    const prev = presses[presses.length - 2];
    const last = presses[presses.length - 1];
    return last.frame === lastFrame && (last.frame - prev.frame) >= minGap;
  }

  private isAnimComplete(): boolean {
    const anim = FIGHTER_ANIMS[this._state];
    if (!anim || anim.length === 0) return true;
    const last = anim.length - 1;
    return this.animFrameIdx >= last && this.animFrameTimer >= anim[last].duration;
  }

  private justPressed(action: InputAction): boolean {
    const lastFrame = this.buffer.frame - 1;
    return this.buffer.getRecent().some(
      b => b.action === action && b.pressed && b.frame === lastFrame
    );
  }

  readonly maxHp = 200;
  hp = 200;

  comboCount                   = 0;
  private hasHit               = false;
  private hitstunTimer         = 0;
  private knockdownGroundTimer = 0;
  private flashTimer           = 0;

  private _projectileRequest: { x: number; y: number; vx: number } | null = null;
  consumeProjectileRequest() {
    const r = this._projectileRequest;
    this._projectileRequest = null;
    return r;
  }

  private inputSource: InputSource;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    _color: number,
    inputSource: InputSource,
    facing: 1 | -1 = 1,
  ) {
    this.scene       = scene;
    this.inputSource = inputSource;
    this.facing      = facing;
    this.buffer      = new InputBuffer(INPUT_BUFFER_FRAMES);

    this.sprite = scene.add.sprite(x, y, 'fighter-idle', 0);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(FIGHTER.gravity);
    this.body.setCollideWorldBounds(true);
    this.applySpriteFrame(); // size body to match initial frame
  }

  update() {
    this.justStartedThrow = false;
    this.pollInputs();
    this.buffer.tick();
    this.updateState();
    this.advanceAnim();
    this.advanceVisualFrame();
    this.applySpriteFrame();
    this.tickFlash();
  }

  private pollInputs() {
    for (const { action, pressed } of this.inputSource.poll()) {
      let resolved = action;
      if (this.facing === -1) {
        if (action === InputAction.Forward) resolved = InputAction.Back;
        else if (action === InputAction.Back) resolved = InputAction.Forward;
      }
      this.buffer.record(resolved, pressed);
    }
  }

  private isHeld(action: InputAction): boolean {
    const raw = (this.facing === -1 && action === InputAction.Forward) ? InputAction.Back
              : (this.facing === -1 && action === InputAction.Back)    ? InputAction.Forward
              : action;
    return this.inputSource.isDown(raw);
  }

  private updateState() {
    const grounded = this.body.blocked.down || this.body.touching.down;

    if (this._state === FighterStateName.HitStun ||
        this._state === FighterStateName.BlockStun) {
      this.body.setVelocityX(this.body.velocity.x * 0.75);
      this.hitstunTimer--;
      if (this.hitstunTimer <= 0) this.setState(FighterStateName.Idle);
      return;
    }

    if (this._state === FighterStateName.KnockdownFall) {
      if (grounded) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.KnockdownGround);
        this.knockdownGroundTimer = 50;
      }
      return;
    }

    if (this._state === FighterStateName.KnockdownGround) {
      this.knockdownGroundTimer--;
      if (this.knockdownGroundTimer <= 0) this.setState(FighterStateName.WakeUp);
      return;
    }

    if (this._state === FighterStateName.WakeUp) {
      if (this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    if (this._state === FighterStateName.DashForward || this._state === FighterStateName.DashBack) {
      const dir = this._state === FighterStateName.DashForward ? 1 : -1;
      this.body.setVelocityX(this.animFrameIdx === 1 ? FIGHTER.dashSpeed * dir * this.facing : 0);
      if (this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    if (this.isInGroundAttackState()) {
      this.body.setVelocityX(0);
      if (this.hasHit) {
        const held = this.getHeldDirections();
        if (MotionDetector.detect(this.buffer, MOTIONS.QCF, InputAction.LP, 15, held)) {
          this.setState(FighterStateName.AttackHadouken);
          return;
        }
        if (MotionDetector.detect(this.buffer, MOTIONS.DP, InputAction.HP, 15, held)) {
          this.setState(FighterStateName.AttackShoryuken);
          return;
        }
      }
      if (this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    if (this.isInAirAttackState()) {
      if (grounded || this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    if (grounded) {
      if (this.justDoubleTapped(InputAction.Forward)) {
        this.setState(FighterStateName.DashForward);
        return;
      }
      if (this.justDoubleTapped(InputAction.Back)) {
        this.setState(FighterStateName.DashBack);
        return;
      }

      if (this.justPressed(InputAction.LP) && this.justPressed(InputAction.LK)) {
        if (Math.abs(this.sprite.x - this.opponentX) <= FIGHTER.throwRange) {
          this.setState(FighterStateName.AttackThrow);
          return;
        }
      }

      const held = this.getHeldDirections();
      if (MotionDetector.detect(this.buffer, MOTIONS.QCF, InputAction.LP, 15, held)) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.AttackHadouken);
      } else if (MotionDetector.detect(this.buffer, MOTIONS.DP, InputAction.HP, 15, held)) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.AttackShoryuken);
      } else if (this.justPressed(InputAction.LP)) {
        this.body.setVelocityX(0);
        this.setState(this.isHeld(InputAction.Down)
          ? FighterStateName.AttackCrouchLP
          : FighterStateName.AttackLP);
      } else if (this.justPressed(InputAction.HP) && !this.isHeld(InputAction.Down)) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.AttackStandHP);
      } else if (this.isHeld(InputAction.Up)) {
        this.body.setVelocityY(FIGHTER.jumpVelocity);
        this.setState(FighterStateName.JumpAir);
      } else if (this.isHeld(InputAction.Down)) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.Crouch);
      } else if (this.isHeld(InputAction.Forward)) {
        this.body.setVelocityX(FIGHTER.walkSpeed * this.facing);
        this.setState(FighterStateName.WalkForward);
      } else if (this.isHeld(InputAction.Back)) {
        this.body.setVelocityX(-FIGHTER.backWalkSpeed * this.facing);
        this.setState(FighterStateName.WalkBack);
      } else {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.Idle);
      }
    } else {
      if (this.justPressed(InputAction.LP)) {
        this.setState(FighterStateName.AttackJumpLP);
      } else {
        this.setState(FighterStateName.JumpAir);
      }
    }
  }

  getHeldDirections(): Set<InputAction> {
    const held = new Set<InputAction>();
    const all: InputAction[] = [
      InputAction.Up, InputAction.Down, InputAction.Forward, InputAction.Back,
      InputAction.LP, InputAction.MP, InputAction.HP,
      InputAction.LK, InputAction.MK, InputAction.HK,
    ];
    for (const action of all) {
      if (this.isHeld(action)) held.add(action);
    }
    return held;
  }

  setFacing(dir: 1 | -1) { this.facing = dir; }
}
