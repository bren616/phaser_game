import Phaser from 'phaser';
import { FightScene } from './scenes/FightScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config/GameConfig';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: { default: 'arcade', arcade: { debug: true } },
  input: { gamepad: true },
  scene: [FightScene],
});