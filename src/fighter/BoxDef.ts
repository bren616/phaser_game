// All coordinates are relative to the fighter's bottom-center.
// x: positive = toward opponent (facing-relative; flipped automatically when facing left)
// y: negative = upward  (0 = feet, -height = head)
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameData {
  duration: number;   // game frames this frame lasts; last frame holds when animation ends
  hurtboxes: Box[];   // regions that can receive a hit
  hitboxes: Box[];    // regions that deal a hit (empty on non-attack frames)
  damage?:    number;   // HP dealt on hit (only set on active frames)
  hitstun?:   number;   // frames of hitstun dealt (only set on active frames)
  knockdown?: boolean;  // true if this hit launches the defender into knockdown
}

export type AnimDef = FrameData[];
