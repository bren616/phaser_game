import Phaser from 'phaser';
import { Fighter } from '../fighter/Fighter';
import { Projectile } from '../fighter/Projectile';
import { FIGHTER, GAME_WIDTH, GROUND_Y } from '../config/GameConfig';
import { P1_KEYS, P2_KEYS } from '../config/Inputs';
import { CompositeInputSource } from '../fighter/InputSource';
import { KeyboardInputSource } from '../fighter/KeyboardInputSource';
import { GamepadInputSource } from '../fighter/GamepadInputSource';

const BAR_W    = 480;
const BAR_H    = 28;
const BAR_Y    = 20;
const P1_BAR_X = 20;
const P2_BAR_X = GAME_WIDTH - 20;

const WINS_TO_MATCH     = 2;
const ROUND_OVER_DELAY  = 180;
const ROUND_TIME_FRAMES = 99 * 60;
const INTRO_ROUND_FRAMES = 80;  // frames showing "ROUND X"
const INTRO_FIGHT_FRAMES = 40;  // frames showing "FIGHT!"
const INTRO_TOTAL_FRAMES = INTRO_ROUND_FRAMES + INTRO_FIGHT_FRAMES;
const P1_START_X = 350;
const P2_START_X = 930;
const START_Y    = 400;
const GAME_HEIGHT_HALF = 360;

export class FightScene extends Phaser.Scene {
  player1!: Fighter;
  player2!: Fighter;

  private projectiles: Projectile[] = [];

  private hudGraphics!:   Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!:     Phaser.GameObjects.Text;
  private koText!:        Phaser.GameObjects.Text;
  private winnerText!:    Phaser.GameObjects.Text;
  private winsText!:      Phaser.GameObjects.Text;
  private timerText!:     Phaser.GameObjects.Text;
  private roundText!:     Phaser.GameObjects.Text; // "ROUND X"
  private fightText!:     Phaser.GameObjects.Text; // "FIGHT!"
  private p1ComboText!:   Phaser.GameObjects.Text;
  private p2ComboText!:   Phaser.GameObjects.Text;

  private roundState: 'intro' | 'fighting' | 'roundOver' | 'matchOver' = 'intro';
  private roundTimer      = 0;
  private roundTimeFrames = ROUND_TIME_FRAMES;
  private introTimer      = 0;
  private roundNumber     = 0;
  private p1Wins = 0;
  private p2Wins = 0;

  constructor() { super('FightScene'); }

  preload() {
    this.load.image('bg', 'assets/killians_gotham.png');
    this.load.spritesheet('fighter-idle',     'assets/skele-idle-v2.png',     { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('fighter-walk',     'assets/skele-walk-v2.png',     { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('fighter-attackLP', 'assets/skele-attackLP-v2.png', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('fighter-jumpair',  'assets/skele-jumpair-v2.png',  { frameWidth: 256, frameHeight: 256 });
  }

  create() {
    this.add.image(GAME_WIDTH / 2, 360, 'bg').setDisplaySize(GAME_WIDTH, 720);

    const ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 60, GAME_WIDTH, 120, 0x000000, 0);
    this.physics.add.existing(ground, true);

    const gp = this.input.gamepad!;
    const p1Input = new CompositeInputSource(
      new KeyboardInputSource(this, P1_KEYS),
      new GamepadInputSource(gp, 0),
    );
    const p2Input = new CompositeInputSource(
      new KeyboardInputSource(this, P2_KEYS),
      new GamepadInputSource(gp, 1),
    );

    this.player1 = new Fighter(this, P1_START_X, START_Y, 0xff5555, p1Input,  1);
    this.player2 = new Fighter(this, P2_START_X, START_Y, 0x5555ff, p2Input, -1);

    this.physics.add.collider(this.player1.sprite, ground);
    this.physics.add.collider(this.player2.sprite, ground);

    this.hudGraphics   = this.add.graphics();
    this.debugGraphics = this.add.graphics();

    this.debugText = this.add.text(20, 60, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    });

    this.timerText = this.add.text(GAME_WIDTH / 2, BAR_Y, '99', {
      fontFamily: 'Arial Black', fontSize: '28px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0);

    this.winsText = this.add.text(GAME_WIDTH / 2, BAR_Y + BAR_H + 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5, 0);

    // Combo counters — shown below each fighter's bar on the attacker's side.
    this.p1ComboText = this.add.text(P1_BAR_X + BAR_W / 2, BAR_Y + BAR_H + 30, '', {
      fontFamily: 'Arial Black', fontSize: '22px', color: '#ffee44',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setVisible(false);

    this.p2ComboText = this.add.text(P2_BAR_X - BAR_W / 2, BAR_Y + BAR_H + 30, '', {
      fontFamily: 'Arial Black', fontSize: '22px', color: '#ffee44',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setVisible(false);

    this.koText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF, '', {
      fontFamily: 'Arial Black', fontSize: '96px', color: '#ffff00',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setVisible(false);

    this.winnerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF + 100, '', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false);

    this.roundText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF - 60, '', {
      fontFamily: 'Arial Black', fontSize: '72px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false);

    this.fightText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF, 'FIGHT!', {
      fontFamily: 'Arial Black', fontSize: '96px', color: '#ff4444',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setVisible(false);

    this.beginRoundIntro();
  }

  update() {
    if (this.roundState === 'intro') {
      this.updateIntro();
    } else if (this.roundState === 'fighting') {
      this.updateFighting();
    } else if (this.roundState === 'roundOver') {
      this.roundTimer--;
      if (this.roundTimer <= 0) this.startNewRound();
    }

    this.drawHud();
    this.debugGraphics.clear();
    this.drawBoxes(this.player1);
    this.drawBoxes(this.player2);
    this.drawProjectiles();
  }

  // --- Round intro ---

  private beginRoundIntro() {
    this.roundNumber++;
    this.introTimer = INTRO_TOTAL_FRAMES;
    this.roundState = 'intro';
    this.roundText.setText(`ROUND ${this.roundNumber}`).setVisible(true);
    this.fightText.setVisible(false);
  }

  private updateIntro() {
    this.introTimer--;
    if (this.introTimer === INTRO_FIGHT_FRAMES) {
      this.roundText.setVisible(false);
      this.fightText.setVisible(true);
    }
    if (this.introTimer <= 0) {
      this.fightText.setVisible(false);
      this.roundState = 'fighting';
    }
  }

  // --- Main fight loop ---

  private updateFighting() {
    this.roundTimeFrames--;
    if (this.roundTimeFrames <= 0) { this.endRound(true); return; }

    const p1FacesRight = this.player1.sprite.x <= this.player2.sprite.x;
    this.player1.setFacing(p1FacesRight ? 1 : -1);
    this.player2.setFacing(p1FacesRight ? -1 : 1);

    this.player1.opponentX = this.player2.sprite.x;
    this.player2.opponentX = this.player1.sprite.x;

    this.player1.update();
    this.player2.update();

    this.checkThrow(this.player1, this.player2);
    this.checkThrow(this.player2, this.player1);
    this.applyCornerPush();

    this.spawnPendingProjectiles(this.player1);
    this.spawnPendingProjectiles(this.player2);

    for (const p of this.projectiles) p.update(GAME_WIDTH);
    this.projectiles = this.projectiles.filter(p => p.alive);

    this.checkFighterHits(this.player1, this.player2);
    this.checkFighterHits(this.player2, this.player1);
    this.checkProjectileHits(this.player1, this.player2);
    this.checkProjectileHits(this.player2, this.player1);

    if (this.player1.isDead() || this.player2.isDead()) this.endRound(false);

    this.debugText.setText([
      `P1  state: ${this.player1.state}  hp: ${this.player1.hp}`,
      `P2  state: ${this.player2.state}  hp: ${this.player2.hp}`,
    ]);
  }

  // --- Hit / throw helpers ---

  private checkThrow(attacker: Fighter, defender: Fighter) {
    if (!attacker.justStartedThrow) return;
    if (!defender.isThrowable()) return;
    const landX = attacker.sprite.x + 90 * attacker.facing;
    defender.receiveThrow(landX, attacker.facing);
    attacker.flash(6, 0xffdd88);
    defender.flash(8, 0xffffff);
    this.cameras.main.shake(120, 0.005);
  }

  private applyCornerPush() {
    const b1 = this.player1.body;
    const b2 = this.player2.body;
    if (!(b1.blocked.down || b1.touching.down)) return;
    if (!(b2.blocked.down || b2.touching.down)) return;
    const cx1  = this.player1.sprite.x;
    const cx2  = this.player2.sprite.x;
    const dist = Math.abs(cx1 - cx2);
    const min  = FIGHTER.width;
    if (dist >= min) return;
    const push = (min - dist) / 2 + 0.5;
    if (cx1 < cx2) { this.player1.nudge(-push); this.player2.nudge(push);  }
    else           { this.player1.nudge(push);  this.player2.nudge(-push); }
  }

  private spawnPendingProjectiles(fighter: Fighter) {
    const req = fighter.consumeProjectileRequest();
    if (req) this.projectiles.push(new Projectile(this, req.x, req.y, req.vx, fighter));
  }

  private checkFighterHits(attacker: Fighter, defender: Fighter) {
    if (!attacker.canHit()) return;
    const fd        = attacker.getActiveFrameData();
    const damage    = fd?.damage    ?? 10;
    const hitstun   = fd?.hitstun   ?? 15;
    const knockdown = fd?.knockdown ?? false;
    for (const hit of attacker.getWorldHitboxes()) {
      for (const hurt of defender.getWorldHurtboxes()) {
        if (overlaps(hit, hurt)) {
          attacker.registerHit();
          const blocked = defender.isBlocking();
          defender.receiveHit(300 * attacker.facing, hitstun, damage, knockdown);
          defender.flash(blocked ? 4 : 6, blocked ? 0xaaddff : 0xffffff);
          this.cameras.main.shake(knockdown ? 150 : 60, knockdown ? 0.006 : 0.003);
          return;
        }
      }
    }
  }

  private checkProjectileHits(owner: Fighter, target: Fighter) {
    for (const proj of this.projectiles) {
      if (proj.owner !== owner || !proj.alive) continue;
      const hit = proj.getWorldHitbox();
      for (const hurt of target.getWorldHurtboxes()) {
        if (overlaps(hit, hurt)) {
          proj.destroy();
          const blocked = target.isBlocking();
          target.receiveHit(200 * owner.facing, proj.hitstun, proj.damage);
          target.flash(blocked ? 4 : 6, blocked ? 0xaaddff : 0xffffff);
          this.cameras.main.shake(60, 0.003);
          return;
        }
      }
    }
  }

  // --- Round management ---

  private endRound(timeover: boolean) {
    this.roundState = 'roundOver';
    this.roundTimer = ROUND_OVER_DELAY;

    let winner: string;
    if (timeover) {
      winner = this.player1.hp > this.player2.hp ? 'P1'
             : this.player2.hp > this.player1.hp ? 'P2'
             : 'DRAW';
    } else {
      winner = this.player1.isDead() ? 'P2' : 'P1';
    }

    if (winner !== 'DRAW') {
      if (winner === 'P1') this.p1Wins++; else this.p2Wins++;
    }

    this.koText.setText(timeover ? 'TIME!' : 'K.O.!').setVisible(true);

    const matchWon = winner !== 'DRAW' &&
      (this.p1Wins >= WINS_TO_MATCH || this.p2Wins >= WINS_TO_MATCH);

    if (matchWon) {
      this.roundState = 'matchOver';
      this.winnerText.setText(`${winner} Wins the Match!`).setVisible(true);
    } else {
      this.winnerText.setText(
        winner === 'DRAW' ? 'DRAW' : `${winner} wins the round`
      ).setVisible(true);
    }
  }

  private startNewRound() {
    for (const p of this.projectiles) p.destroy();
    this.projectiles     = [];
    this.roundTimeFrames = ROUND_TIME_FRAMES;

    this.player1.resetForRound(P1_START_X, START_Y);
    this.player2.resetForRound(P2_START_X, START_Y);
    this.player1.setFacing(1);
    this.player2.setFacing(-1);

    this.koText.setVisible(false);
    this.winnerText.setVisible(false);
    this.beginRoundIntro();
  }

  // --- HUD ---

  private drawHud() {
    this.hudGraphics.clear();

    const p1Ratio = this.player1.hp / this.player1.maxHp;
    this.hudGraphics.fillStyle(0x333333).fillRect(P1_BAR_X, BAR_Y, BAR_W, BAR_H);
    this.hudGraphics.fillStyle(0x22cc22).fillRect(P1_BAR_X, BAR_Y, BAR_W * p1Ratio, BAR_H);

    const p2Ratio = this.player2.hp / this.player2.maxHp;
    const p2FillW = BAR_W * p2Ratio;
    this.hudGraphics.fillStyle(0x333333).fillRect(P2_BAR_X - BAR_W, BAR_Y, BAR_W, BAR_H);
    this.hudGraphics.fillStyle(0x2222cc).fillRect(P2_BAR_X - p2FillW, BAR_Y, p2FillW, BAR_H);

    const secs = Math.ceil(this.roundTimeFrames / 60);
    this.timerText.setText(this.roundState === 'fighting' ? String(secs) : '');
    this.winsText.setText(
      pips(this.p1Wins, WINS_TO_MATCH) + '   vs   ' + pips(this.p2Wins, WINS_TO_MATCH)
    );

    // Combo display: P1 attacking P2 shows on P1 side; P2 attacking P1 shows on P2 side.
    const p1Attack = this.player2.comboCount;
    const p2Attack = this.player1.comboCount;

    if (p1Attack >= 2) {
      this.p1ComboText.setText(`${p1Attack} HIT`).setVisible(true);
    } else {
      this.p1ComboText.setVisible(false);
    }
    if (p2Attack >= 2) {
      this.p2ComboText.setText(`${p2Attack} HIT`).setVisible(true);
    } else {
      this.p2ComboText.setVisible(false);
    }
  }

  // --- Debug rendering ---

  private drawBoxes(fighter: Fighter) {
    for (const box of fighter.getWorldHurtboxes()) {
      this.debugGraphics.lineStyle(2, 0x00ff00, 1);
      this.debugGraphics.strokeRect(box.x, box.y, box.w, box.h);
    }
    for (const box of fighter.getWorldHitboxes()) {
      this.debugGraphics.lineStyle(2, 0xff0000, 1);
      this.debugGraphics.strokeRect(box.x, box.y, box.w, box.h);
    }
  }

  private drawProjectiles() {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;
      const h = proj.getWorldHitbox();
      this.debugGraphics.lineStyle(2, 0xff8800, 1);
      this.debugGraphics.strokeRect(h.x, h.y, h.w, h.h);
    }
  }
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pips(wins: number, max: number): string {
  return Array.from({ length: max }, (_, i) => i < wins ? '●' : '○').join(' ');
}
