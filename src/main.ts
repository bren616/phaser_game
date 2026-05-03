import Phaser from 'phaser';
import { FightScene } from './scenes/FightScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config/GameConfig';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#1a1a2e',
  physics: { default: 'arcade', arcade: { debug: true } },
  scene: [FightScene],
});