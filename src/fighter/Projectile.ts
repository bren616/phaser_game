import Phaser from 'phaser';
import { Box } from './BoxDef';
import { Fighter } from './Fighter';

export class Projectile {
  readonly sprite: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.Physics.Arcade.Body;
  readonly owner: Fighter;
  readonly damage:  number;
  readonly hitstun: number;
  alive = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    velocityX: number,
    owner: Fighter,
    damage  = 15,
    hitstun = 18,
  ) {
    this.owner   = owner;
    this.damage  = damage;
    this.hitstun = hitstun;

    this.sprite = scene.add.rectangle(x, y, 36, 24, 0xffaa00);
    scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.setVelocityX(velocityX);
  }

  update(sceneWidth: number) {
    if (!this.alive) return;
    if (this.sprite.x < -60 || this.sprite.x > sceneWidth + 60) this.destroy();
  }

  getWorldHitbox(): Box {
    return { x: this.sprite.x - 18, y: this.sprite.y - 12, w: 36, h: 24 };
  }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
  }
}
