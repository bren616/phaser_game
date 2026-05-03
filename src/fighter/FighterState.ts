export enum FighterStateName {
  Idle = 'idle',
  WalkForward = 'walkForward',
  WalkBack = 'walkBack',
  Crouch = 'crouch',
  JumpStart = 'jumpStart',
  JumpAir = 'jumpAir',
  Land = 'land',
  AttackLP        = 'attackLP',
  AttackCrouchLP  = 'attackCrouchLP',
  AttackStandHP   = 'attackStandHP',
  AttackJumpLP    = 'attackJumpLP',
  AttackHadouken  = 'attackHadouken',
  AttackShoryuken = 'attackShoryuken',
  HitStun          = 'hitstun',
  BlockStun        = 'blockstun',
  KnockdownFall    = 'knockdownFall',    // airborne after knockdown hit
  KnockdownGround  = 'knockdownGround',  // lying on the ground
}