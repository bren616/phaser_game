export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const GROUND_Y = 600;

export const FIGHTER = {
  walkSpeed: 200,
  backWalkSpeed: 150,
  dashSpeed: 600,
  jumpVelocity: -750,
  gravity: 1800,
  width: 60,
  height: 180,
  throwRange: 105, // max distance (center-to-center) for a throw to connect
};

// Must exceed the largest MotionDetector windowFrames (15) so inputs aren't
// pruned before detection can see them.
export const INPUT_BUFFER_FRAMES = 20;