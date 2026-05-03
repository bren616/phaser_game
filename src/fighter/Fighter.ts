import Phaser from 'phaser';
import { InputAction } from '../config/Inputs';
import { InputBuffer } from './InputBuffer';
import { FighterStateName } from './FighterState';
import { FIGHTER, INPUT_BUFFER_FRAMES } from '../config/GameConfig';
import { Box, FrameData } from './BoxDef';
import { FIGHTER_ANIMS } from '../data/FighterAnimations';
import { MOTIONS, MotionDetector } from './MotionDetector';

export class Fighter {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Rectangle; // placeholder until you have art
  body: Phaser.Physics.Arcade.Body;
  buffer: InputBuffer;
  facing: 1 | -1 = 1; // 1 = facing right

  private _state: FighterStateName = FighterStateName.Idle;
  private animFrameIdx  = 0;
  private animFrameTimer = 0;

  get state(): FighterStateName { return this._state; }

  private setState(next: FighterStateName) {
    if (this._state === next) return;
    this._state         = next;
    this.animFrameIdx   = 0;
    this.animFrameTimer = 0;
    this.hasHit         = false;

    if (next === FighterStateName.AttackShoryuken) {
      this.body.setVelocityY(-850);
      this.body.setVelocityX(150 * this.facing);
    }
  }

  // --- Hit detection API (called by the scene) ---

  canHit(): boolean { return !this.hasHit; }

  registerHit() { this.hasHit = true; }

  // True when grounded and holding Back — the defender can block incoming hits.
  isBlocking(): boolean {
    const grounded = this.body.blocked.down || this.body.touching.down;
    return grounded && this.isHeld(InputAction.Back);
  }

  receiveHit(knockbackVx: number, hitstunFrames = 15, damage = 10, knockdown = false) {
    if (this.isBlocking()) {
      // Block absorbs knockdown — just applies chip + blockstun.
      const chip = Math.max(1, Math.round(damage * 0.1));
      this.hp = Math.max(1, this.hp - chip);
      this.setState(FighterStateName.BlockStun);
      this.hitstunTimer = Math.round(hitstunFrames * 0.65);
      this.body.setVelocityX(knockbackVx * 0.4);
    } else if (knockdown) {
      this.hp = Math.max(0, this.hp - damage);
      this.setState(FighterStateName.KnockdownFall);
      this.body.setVelocityY(-380);
      this.body.setVelocityX(knockbackVx * 1.4);
    } else {
      this.hp = Math.max(0, this.hp - damage);
      this.setState(FighterStateName.HitStun);
      this.hitstunTimer = hitstunFrames;
      this.body.setVelocityX(knockbackVx);
    }
  }

  isDead(): boolean { return this.hp <= 0; }

  resetForRound(x: number, y: number) {
    this.hp           = this.maxHp;
    this._state       = FighterStateName.Idle;
    this.animFrameIdx = 0;
    this.animFrameTimer = 0;
    this.hasHit       = false;
    this.hitstunTimer = 0;
    this.body.reset(x, y);
  }

  // Returns hitboxes/hurtboxes transformed into world space.
  private toWorld(box: Box): Box {
    const bx   = this.sprite.x;
    const by   = this.sprite.y + this.sprite.height / 2;
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

      // Spawn Hadouken projectile exactly when windup transitions to recovery.
      if (this._state === FighterStateName.AttackHadouken && prevIdx === 0) {
        this._projectileRequest = {
          x:  this.sprite.x + 50 * this.facing,
          y:  this.sprite.y - 55, // roughly chest height
          vx: 420 * this.facing,
        };
      }
    }
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
        || this._state === FighterStateName.AttackHadouken
        || this._state === FighterStateName.AttackShoryuken;
  }

  private isInAirAttackState(): boolean {
    return this._state === FighterStateName.AttackJumpLP;
  }

  private isAnimComplete(): boolean {
    const anim = FIGHTER_ANIMS[this._state];
    if (!anim || anim.length === 0) return true;
    const last = anim.length - 1;
    return this.animFrameIdx >= last && this.animFrameTimer >= anim[last].duration;
  }

  // Returns true if `action` was pressed on the frame that was just polled.
  private justPressed(action: InputAction): boolean {
    const lastFrame = this.buffer.frame - 1;
    return this.buffer.getRecent().some(
      b => b.action === action && b.pressed && b.frame === lastFrame
    );
  }

  readonly maxHp = 200;
  hp = 200;

  private hasHit              = false;
  private hitstunTimer        = 0;
  private knockdownGroundTimer = 0;

  // Set by advanceAnim when a Hadouken enters its recovery frame; consumed by FightScene.
  private _projectileRequest: { x: number; y: number; vx: number } | null = null;
  consumeProjectileRequest() {
    const r = this._projectileRequest;
    this._projectileRequest = null;
    return r;
  }

  private keyMap: Record<string, InputAction>;
  keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private prevKeyState: Record<string, boolean> = {};

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    color: number,
    keyMap: Record<string, InputAction>,
    facing: 1 | -1 = 1,
  ) {
    this.scene   = scene;
    this.keyMap  = keyMap;
    this.facing  = facing;
    this.buffer  = new InputBuffer(INPUT_BUFFER_FRAMES);

    this.sprite = scene.add.rectangle(x, y, FIGHTER.width, FIGHTER.height, color);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(FIGHTER.gravity);
    this.body.setCollideWorldBounds(true);

    for (const key of Object.keys(keyMap)) {
      this.keys[key] = scene.input.keyboard!.addKey(key);
      this.prevKeyState[key] = false;
    }
  }

  update() {
    this.pollInputs();
    this.buffer.tick();
    this.updateState();
    this.advanceAnim();
  }

  private pollInputs() {
    for (const [key, action] of Object.entries(this.keyMap)) {
      const isDown  = this.keys[key].isDown;
      const wasDown = this.prevKeyState[key];

      // Translate Forward/Back based on facing direction
      let resolved = action;
      if (this.facing === -1) {
        if (action === InputAction.Forward) resolved = InputAction.Back;
        else if (action === InputAction.Back) resolved = InputAction.Forward;
      }

      if (isDown && !wasDown)  this.buffer.record(resolved, true);
      else if (!isDown && wasDown) this.buffer.record(resolved, false);
      this.prevKeyState[key] = isDown;
    }
  }

  private isHeld(action: InputAction): boolean {
    for (const [key, mapped] of Object.entries(this.keyMap)) {
      let resolved = mapped;
      if (this.facing === -1) {
        if (mapped === InputAction.Forward) resolved = InputAction.Back;
        else if (mapped === InputAction.Back) resolved = InputAction.Forward;
      }
      if (resolved === action && this.keys[key].isDown) return true;
    }
    return false;
  }

  private updateState() {
    const grounded = this.body.blocked.down || this.body.touching.down;

    // Hitstun / Blockstun: locked until timer expires, with decaying knockback.
    if (this._state === FighterStateName.HitStun ||
        this._state === FighterStateName.BlockStun) {
      this.body.setVelocityX(this.body.velocity.x * 0.75);
      this.hitstunTimer--;
      if (this.hitstunTimer <= 0) this.setState(FighterStateName.Idle);
      return;
    }

    // KnockdownFall: airborne — physics handles movement; wait for landing.
    if (this._state === FighterStateName.KnockdownFall) {
      if (grounded) {
        this.body.setVelocityX(0);
        this.setState(FighterStateName.KnockdownGround);
        this.knockdownGroundTimer = 50;
      }
      return;
    }

    // KnockdownGround: lying on the ground, count down then stand up.
    if (this._state === FighterStateName.KnockdownGround) {
      this.knockdownGroundTimer--;
      if (this.knockdownGroundTimer <= 0) this.setState(FighterStateName.Idle);
      return;
    }

    // Ground attacks: freeze horizontal movement; allow cancel into specials after a hit connects.
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

    // Air attacks: preserve momentum; landing or anim end cancels to Idle.
    if (this.isInAirAttackState()) {
      if (grounded || this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    if (grounded) {
      // Specials are checked before normals so QCF+LP doesn't also fire a standing LP.
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
      // Air — check for jump attack before falling back to JumpAir.
      if (this.justPressed(InputAction.LP)) {
        this.setState(FighterStateName.AttackJumpLP);
      } else {
        this.setState(FighterStateName.JumpAir);
      }
    }
  }

  getHeldDirections(): Set<InputAction> {
    const held = new Set<InputAction>();
    for (const [key, mapped] of Object.entries(this.keyMap)) {
      if (this.keys[key].isDown) {
        let resolved = mapped;
        if (this.facing === -1) {
          if (mapped === InputAction.Forward) resolved = InputAction.Back;
          else if (mapped === InputAction.Back) resolved = InputAction.Forward;
        }
        held.add(resolved);
      }
    }
    return held;
  }

  setFacing(dir: 1 | -1) { this.facing = dir; }
}
