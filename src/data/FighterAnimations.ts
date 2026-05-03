import { AnimDef } from '../fighter/BoxDef';
import { FighterStateName } from '../fighter/FighterState';

// Fighter sprite: 80 × 180, origin at bottom-center.
// Boxes are tuned to cover the visual rectangle with a small inset.

const STAND_HURTBOX  = [{ x: -28, y: -172, w: 56, h: 172 }];
const CROUCH_HURTBOX = [{ x: -28, y: -100, w: 56, h: 100 }];
const AIR_HURTBOX    = [{ x: -28, y: -172, w: 56, h: 172 }];

// Hitboxes — all x values are facing-relative (positive = toward opponent).
const LP_HITBOX        = [{ x: 25, y: -148, w: 50, h: 28  }]; // standing LP fist
const CROUCH_LP_HITBOX = [{ x: 22, y: -32,  w: 46, h: 22  }]; // low poke near the ground
const HP_HITBOX        = [{ x: 24, y: -158, w: 66, h: 38  }]; // heavy punch: wider, taller
const SHORYUKEN_HITBOX = [{ x:  8, y: -230, w: 38, h: 120 }]; // tall vertical uppercut arc
const JUMP_LP_HITBOX   = [{ x: 10, y: -150, w: 42, h: 55  }]; // diving jab — forward and downward reach

// Single-frame "forever" duration for states driven by input, not frame count.
const HOLD = 9999;

export const FIGHTER_ANIMS: Partial<Record<FighterStateName, AnimDef>> = {
  [FighterStateName.Idle]:        [{ duration: HOLD, hurtboxes: STAND_HURTBOX,  hitboxes: [] }],
  [FighterStateName.WalkForward]: [{ duration: HOLD, hurtboxes: STAND_HURTBOX,  hitboxes: [] }],
  [FighterStateName.WalkBack]:    [{ duration: HOLD, hurtboxes: STAND_HURTBOX,  hitboxes: [] }],
  [FighterStateName.Crouch]:      [{ duration: HOLD, hurtboxes: CROUCH_HURTBOX, hitboxes: [] }],
  [FighterStateName.JumpStart]:   [{ duration: HOLD, hurtboxes: STAND_HURTBOX,  hitboxes: [] }],
  [FighterStateName.JumpAir]:     [{ duration: HOLD, hurtboxes: AIR_HURTBOX,    hitboxes: [] }],
  [FighterStateName.Land]:        [{ duration: HOLD, hurtboxes: STAND_HURTBOX,  hitboxes: [] }],

  // Blockstun / Hitstun: timer-controlled, single held frame.
  [FighterStateName.BlockStun]: [{ duration: HOLD, hurtboxes: STAND_HURTBOX, hitboxes: [] }],
  [FighterStateName.HitStun]:   [{ duration: HOLD, hurtboxes: STAND_HURTBOX, hitboxes: [] }],

  // Knockdown: wide flat hurtbox while airborne/grounded — timer-controlled in Fighter.
  [FighterStateName.KnockdownFall]:   [{ duration: HOLD, hurtboxes: [{ x: -28, y: -172, w: 56, h: 172 }], hitboxes: [] }],
  [FighterStateName.KnockdownGround]: [{ duration: HOLD, hurtboxes: [{ x: -50, y: -20,  w: 100, h: 20  }], hitboxes: [] }],

  // Standing LP: 4f startup | 3f active | 7f recovery
  [FighterStateName.AttackLP]: [
    { duration: 4, hurtboxes: STAND_HURTBOX, hitboxes: []        },
    { duration: 3, hurtboxes: STAND_HURTBOX, hitboxes: LP_HITBOX,        damage: 10, hitstun: 15 },
    { duration: 7, hurtboxes: STAND_HURTBOX, hitboxes: []        },
  ],

  // Crouching LP: 4f startup | 3f active | 8f recovery — low hit, crouching hurtbox throughout
  [FighterStateName.AttackCrouchLP]: [
    { duration: 4, hurtboxes: CROUCH_HURTBOX, hitboxes: []             },
    { duration: 3, hurtboxes: CROUCH_HURTBOX, hitboxes: CROUCH_LP_HITBOX, damage: 7, hitstun: 13 },
    { duration: 8, hurtboxes: CROUCH_HURTBOX, hitboxes: []             },
  ],

  // Jump LP: 4f startup | 6f active | 6f recovery — landing cancels remaining recovery.
  [FighterStateName.AttackJumpLP]: [
    { duration: 4, hurtboxes: AIR_HURTBOX, hitboxes: []           },
    { duration: 6, hurtboxes: AIR_HURTBOX, hitboxes: JUMP_LP_HITBOX, damage: 10, hitstun: 15 },
    { duration: 6, hurtboxes: AIR_HURTBOX, hitboxes: []           },
  ],

  // Hadouken: 13f windup | 22f recovery — projectile spawns on the frame 0→1 transition.
  // The fighter has no hitbox; damage/hitstun live on the Projectile itself.
  [FighterStateName.AttackHadouken]: [
    { duration: 13, hurtboxes: STAND_HURTBOX, hitboxes: [] }, // windup
    { duration: 22, hurtboxes: STAND_HURTBOX, hitboxes: [] }, // recovery
  ],

  // Shoryuken: 3f startup | 6f active (rising) | 16f recovery — jump velocity on entry.
  [FighterStateName.AttackShoryuken]: [
    { duration: 3,  hurtboxes: STAND_HURTBOX, hitboxes: []             }, // startup
    { duration: 6,  hurtboxes: STAND_HURTBOX, hitboxes: SHORYUKEN_HITBOX, damage: 25, hitstun: 22, knockdown: true }, // active
    { duration: 16, hurtboxes: STAND_HURTBOX, hitboxes: []             }, // recovery
  ],

  // Standing HP: 8f startup | 4f active | 14f recovery — slow but heavy
  [FighterStateName.AttackStandHP]: [
    { duration: 8,  hurtboxes: STAND_HURTBOX, hitboxes: []       },
    { duration: 4,  hurtboxes: STAND_HURTBOX, hitboxes: HP_HITBOX, damage: 20, hitstun: 20, knockdown: true },
    { duration: 14, hurtboxes: STAND_HURTBOX, hitboxes: []       },
  ],
};
