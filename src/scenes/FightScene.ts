import Phaser from 'phaser';
import { Fighter } from '../fighter/Fighter';
import { Projectile } from '../fighter/Projectile';
import { GAME_WIDTH, GROUND_Y } from '../config/GameConfig';
import { P1_KEYS, P2_KEYS } from '../config/Inputs';

const BAR_W    = 480;
const BAR_H    = 28;
const BAR_Y    = 20;
const P1_BAR_X = 20;
const P2_BAR_X = GAME_WIDTH - 20;

const WINS_TO_MATCH    = 2;
const ROUND_OVER_DELAY = 180;
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

  private roundState: 'fighting' | 'roundOver' | 'matchOver' = 'fighting';
  private roundTimer = 0;
  private p1Wins = 0;
  private p2Wins = 0;

  constructor() { super('FightScene'); }

  create() {
    const ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 60, GAME_WIDTH, 120, 0x333333);
    this.physics.add.existing(ground, true);

    this.player1 = new Fighter(this, P1_START_X, START_Y, 0xff5555, P1_KEYS,  1);
    this.player2 = new Fighter(this, P2_START_X, START_Y, 0x5555ff, P2_KEYS, -1);

    this.physics.add.collider(this.player1.sprite, ground);
    this.physics.add.collider(this.player2.sprite, ground);

    this.hudGraphics   = this.add.graphics();
    this.debugGraphics = this.add.graphics();

    this.debugText = this.add.text(20, 60, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
    });

    this.koText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF, 'K.O.!', {
      fontFamily: 'Arial Black', fontSize: '96px', color: '#ffff00',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setVisible(false);

    this.winnerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT_HALF + 100, '', {
      fontFamily: 'Arial Black', fontSize: '48px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setVisible(false);

    this.winsText = this.add.text(GAME_WIDTH / 2, BAR_Y, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5, 0);
  }

  update() {
    if (this.roundState === 'fighting') {
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

  private updateFighting() {
    const p1FacesRight = this.player1.sprite.x <= this.player2.sprite.x;
    this.player1.setFacing(p1FacesRight ? 1 : -1);
    this.player2.setFacing(p1FacesRight ? -1 : 1);

    this.player1.update();
    this.player2.update();

    // Spawn any projectiles requested by fighters this frame.
    this.spawnPendingProjectiles(this.player1);
    this.spawnPendingProjectiles(this.player2);

    // Update and cull out-of-bounds projectiles.
    for (const p of this.projectiles) p.update(GAME_WIDTH);
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Fighter vs fighter hit detection.
    this.checkFighterHits(this.player1, this.player2);
    this.checkFighterHits(this.player2, this.player1);

    // Projectile vs fighter hit detection.
    this.checkProjectileHits(this.player1, this.player2);
    this.checkProjectileHits(this.player2, this.player1);

    if (this.player1.isDead() || this.player2.isDead()) this.endRound();

    this.debugText.setText([
      `P1  state: ${this.player1.state}  hp: ${this.player1.hp}`,
      `P2  state: ${this.player2.state}  hp: ${this.player2.hp}`,
    ]);
  }

  private spawnPendingProjectiles(fighter: Fighter) {
    const req = fighter.consumeProjectileRequest();
    if (req) {
      this.projectiles.push(
        new Projectile(this, req.x, req.y, req.vx, fighter)
      );
    }
  }

  private checkFighterHits(attacker: Fighter, defender: Fighter) {
    if (!attacker.canHit()) return;
    const fd       = attacker.getActiveFrameData();
    const damage   = fd?.damage    ?? 10;
    const hitstun  = fd?.hitstun   ?? 15;
    const knockdown = fd?.knockdown ?? false;

    for (const hit of attacker.getWorldHitboxes()) {
      for (const hurt of defender.getWorldHurtboxes()) {
        if (overlaps(hit, hurt)) {
          attacker.registerHit();
          defender.receiveHit(300 * attacker.facing, hitstun, damage, knockdown);
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
          target.receiveHit(200 * owner.facing, proj.hitstun, proj.damage);
          return;
        }
      }
    }
  }

  private endRound() {
    this.roundState = 'roundOver';
    this.roundTimer = ROUND_OVER_DELAY;

    const p1Dead = this.player1.isDead();
    const winner = p1Dead ? 'P2' : 'P1';
    if (p1Dead) this.p2Wins++; else this.p1Wins++;

    this.koText.setVisible(true);

    if (this.p1Wins >= WINS_TO_MATCH || this.p2Wins >= WINS_TO_MATCH) {
      this.roundState = 'matchOver';
      this.winnerText.setText(`${winner} Wins the Match!`).setVisible(true);
    } else {
      this.winnerText.setText(`${winner} wins the round`).setVisible(true);
    }
  }

  private startNewRound() {
    for (const p of this.projectiles) p.destroy();
    this.projectiles = [];

    this.player1.resetForRound(P1_START_X, START_Y);
    this.player2.resetForRound(P2_START_X, START_Y);
    this.player1.setFacing(1);
    this.player2.setFacing(-1);

    this.koText.setVisible(false);
    this.winnerText.setVisible(false);
    this.roundState = 'fighting';
  }

  private drawHud() {
    this.hudGraphics.clear();

    const p1Ratio = this.player1.hp / this.player1.maxHp;
    this.hudGraphics.fillStyle(0x333333).fillRect(P1_BAR_X, BAR_Y, BAR_W, BAR_H);
    this.hudGraphics.fillStyle(0x22cc22).fillRect(P1_BAR_X, BAR_Y, BAR_W * p1Ratio, BAR_H);

    const p2Ratio = this.player2.hp / this.player2.maxHp;
    const p2FillW = BAR_W * p2Ratio;
    this.hudGraphics.fillStyle(0x333333).fillRect(P2_BAR_X - BAR_W, BAR_Y, BAR_W, BAR_H);
    this.hudGraphics.fillStyle(0x2222cc).fillRect(P2_BAR_X - p2FillW, BAR_Y, p2FillW, BAR_H);

    this.winsText.setText(
      pips(this.p1Wins, WINS_TO_MATCH) + '   vs   ' + pips(this.p2Wins, WINS_TO_MATCH)
    );
  }

  private drawBoxes(fighter: Fighter) {
    const frame = fighter.getActiveFrameData();
    if (!frame) return;

    const bx   = fighter.sprite.x;
    const by   = fighter.sprite.y + fighter.sprite.height / 2;
    const flip = fighter.facing === -1;

    for (const box of frame.hurtboxes) {
      const wx = flip ? bx - box.x - box.w : bx + box.x;
      this.debugGraphics.lineStyle(2, 0x00ff00, 1);
      this.debugGraphics.strokeRect(wx, by + box.y, box.w, box.h);
    }
    for (const box of frame.hitboxes) {
      const wx = flip ? bx - box.x - box.w : bx + box.x;
      this.debugGraphics.lineStyle(2, 0xff0000, 1);
      this.debugGraphics.strokeRect(wx, by + box.y, box.w, box.h);
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
