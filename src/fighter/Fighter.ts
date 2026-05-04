import Phaser from 'phaser';
import { InputAction } from '../config/Inputs';
import { InputBuffer } from './InputBuffer';
import { FighterStateName } from './FighterState';
import { FIGHTER, INPUT_BUFFER_FRAMES } from '../config/GameConfig';
import { Box, FrameData } from './BoxDef';
import { FIGHTER_ANIMS } from '../data/FighterAnimations';
import { MOTIONS, MotionDetector } from './MotionDetector';
import { InputSource } from './InputSource';

export class Fighter {
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Rectangle; // placeholder until you have art
  body: Phaser.Physics.Arcade.Body;
  buffer: InputBuffer;
  facing: 1 | -1 = 1; // 1 = facing right

  // Set by FightScene each frame so Fighter can do proximity checks without a direct reference.
  opponentX = 0;
  // True for exactly one frame when the throw animation starts; read by FightScene.
  justStartedThrow = false;

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
    if (next === FighterStateName.AttackThrow) {
      this.justStartedThrow = true;
    }
    // Returning to neutral ends any combo being done to this fighter.
    if (next === FighterStateName.Idle) {
      this.comboCount = 0;
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
    if (this.isInvincible()) return;
    if (this.isBlocking()) {
      // Blocked hits don't extend a combo.
      // Block absorbs knockdown — just applies chip + blockstun.
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

  // Can this fighter be grabbed right now?
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
    // Reposition to the throw output point, then launch into knockdown
    this.body.reset(landX, this.sprite.y);
    this.setState(FighterStateName.KnockdownFall);
    this.body.setVelocityY(-280);
    this.body.setVelocityX(220 * attackerFacing);
  }

  // Used by FightScene for corner push — adjusts both body and sprite in the same frame.
  nudge(dx: number) {
    this.body.x += dx;
    this.sprite.x = this.body.x + this.body.halfWidth;
  }

  // Briefly tint the sprite — white on hit, blue-white on block.
  flash(frames = 6, color = 0xffffff) {
    this.flashTimer = frames;
    this.sprite.setFillStyle(color);
  }

  private tickFlash() {
    if (this.flashTimer <= 0) return;
    this.flashTimer--;
    if (this.flashTimer === 0) this.sprite.setFillStyle(this.baseColor);
  }

  resetForRound(x: number, y: number) {
    this.hp                  = this.maxHp;
    this.comboCount          = 0;
    this._state              = FighterStateName.Idle;
    this.animFrameIdx        = 0;
    this.animFrameTimer      = 0;
    this.hasHit              = false;
    this.hitstunTimer        = 0;
    this.knockdownGroundTimer = 0;
    this.flashTimer          = 0;
    this.sprite.setFillStyle(this.baseColor);
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
        || this._state === FighterStateName.AttackThrow
        || this._state === FighterStateName.AttackHadouken
        || this._state === FighterStateName.AttackShoryuken;
  }

  private isInAirAttackState(): boolean {
    return this._state === FighterStateName.AttackJumpLP;
  }

  // True when hits should be ignored (backdash startup, wake-up).
  isInvincible(): boolean {
    return this._state === FighterStateName.WakeUp
        || (this._state === FighterStateName.DashBack && this.animFrameIdx === 0);
  }

  // Two presses of `action` within `windowFrames`, at least `minGap` frames apart,
  // with the second press on the frame that was just polled.
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

  // Returns true if `action` was pressed on the frame that was just polled.
  private justPressed(action: InputAction): boolean {
    const lastFrame = this.buffer.frame - 1;
    return this.buffer.getRecent().some(
      b => b.action === action && b.pressed && b.frame === lastFrame
    );
  }

  readonly maxHp = 200;
  hp = 200;

  comboCount                   = 0; // hits received in the current combo; reset on recovery
  private hasHit               = false;
  private hitstunTimer         = 0;
  private knockdownGroundTimer = 0;
  private flashTimer = 0;
  private baseColor  = 0xffffff;

  // Set by advanceAnim when a Hadouken enters its recovery frame; consumed by FightScene.
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
    color: number,
    inputSource: InputSource,
    facing: 1 | -1 = 1,
  ) {
    this.scene       = scene;
    this.inputSource = inputSource;
    this.facing      = facing;
    this.buffer      = new InputBuffer(INPUT_BUFFER_FRAMES);

    this.baseColor = color;
    this.sprite = scene.add.rectangle(x, y, FIGHTER.width, FIGHTER.height, color);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setGravityY(FIGHTER.gravity);
    this.body.setCollideWorldBounds(true);
  }

  update() {
    this.justStartedThrow = false; // reset one-frame flag before this frame's logic
    this.pollInputs();
    this.buffer.tick();
    this.updateState();
    this.advanceAnim();
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
    // Convert facing-relative action to the raw (physical) action the source understands.
    const raw = (this.facing === -1 && action === InputAction.Forward) ? InputAction.Back
              : (this.facing === -1 && action === InputAction.Back)    ? InputAction.Forward
              : action;
    return this.inputSource.isDown(raw);
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

    // KnockdownGround: lying on the ground, count down then enter wake-up.
    if (this._state === FighterStateName.KnockdownGround) {
      this.knockdownGroundTimer--;
      if (this.knockdownGroundTimer <= 0) this.setState(FighterStateName.WakeUp);
      return;
    }

    // WakeUp: invincible rising frames — wait for animation to finish then go idle.
    if (this._state === FighterStateName.WakeUp) {
      if (this.isAnimComplete()) this.setState(FighterStateName.Idle);
      return;
    }

    // Dashes: apply velocity during active phase, run to completion.
    if (this._state === FighterStateName.DashForward || this._state === FighterStateName.DashBack) {
      const dir = this._state === FighterStateName.DashForward ? 1 : -1;
      this.body.setVelocityX(this.animFrameIdx === 1 ? FIGHTER.dashSpeed * dir * this.facing : 0);
      if (this.isAnimComplete()) this.setState(FighterStateName.Idle);
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
      // Dashes checked before specials/normals; double-tap won't conflict with DP because
      // our DP uses held-direction for the final Forward step (only one press event).
      if (this.justDoubleTapped(InputAction.Forward)) {
        this.setState(FighterStateName.DashForward);
        return;
      }
      if (this.justDoubleTapped(InputAction.Back)) {
        this.setState(FighterStateName.DashBack);
        return;
      }

      // Throw: LP+LK on the same frame while close enough — unblockable, bypasses normals.
      if (this.justPressed(InputAction.LP) && this.justPressed(InputAction.LK)) {
        if (Math.abs(this.sprite.x - this.opponentX) <= FIGHTER.throwRange) {
          this.setState(FighterStateName.AttackThrow);
          return;
        }
        // Out of range — fall through to LP normal so the input isn't wasted.
      }

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
