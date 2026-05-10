# Sprite Sheet Specification

## Recommended Frame Size

- **Per-frame canvas: 200 × 240 px**
- Character feet must sit at the **bottom-center** of each frame (the engine anchors the physics body from this point)
- Keep all frames the **same canvas size** so the feet anchor stays consistent across animations
- The physics body is 80 × 180 px — the canvas gives ~60 px of padding on each side for limbs/effects

---

## Animations Required

### Has Art (29 frames total)

| Animation | Frame count | Type |
|---|---|---|
| `idle` | 4 | Looping |
| `walkForward` | 6 | Looping |
| `jumpAir` | 3 | Looping |
| `attackLP` | 3 | Phased (startup / active / recovery) |
| `attackCrouchLP` | 3 | Phased |
| `attackStandHP` | 3 | Phased |
| `attackJumpLP` | 3 | Phased |
| `attackHadouken` | 2 | Phased |

### No Art Yet (fall back to `idle_0000`)

| Animation | Frame count | Notes |
|---|---|---|
| `walkBack` | same as `walkForward` | Mirror flip in code — no extra art needed |
| `crouch` | 2 | Transition down + held low pose |
| `attackShoryuken` | 5 | Windup, launch (2 rising poses), peak, recovery |
| `attackThrow` | 7 | Reach, grab, lift, toss, opponent airborne, land, recovery |
| `dashForward` | 4 | Lean, burst/slide, mid-slide, recover |
| `dashBack` | 4 | Recoil, airborne, descend, land |
| `hitStun` | 2 | Head-snap impact + sustained reel |
| `blockStun` | 1 | Single guard pose, held |
| `knockdownFall` | 4 | Launch, tumble, descend, impact |
| `knockdownGround` | 1 | Flat on ground, held |
| `wakeUp` | 4 | Stir, push up, kneel, stand |

---

## Frame Naming Convention

Frames must be named exactly as follows for the engine to find them:

```
{animationName}_{frameIndex}.png
```

Frame index is zero-padded to 4 digits. Examples:

```
idle_0000.png
idle_0001.png
idle_0002.png
idle_0003.png
walkForward_0000.png
attackLP_0000.png   ← startup
attackLP_0001.png   ← active (hitbox fires here)
attackLP_0002.png   ← recovery
```

---

## Phased vs Looping Animations

- **Looping** (`idle`, `walkForward`, `jumpAir`): frames cycle automatically at ~8 fps
- **Phased** (all attacks, dashes): each frame maps 1:1 to a game-logic phase (startup / active / recovery). Frame durations are defined in `src/data/FighterAnimations.ts`, not the sprite sheet.

---

## Current Sprite Sheet (old — too large)

- Sheet size: 3520 × 2570 px
- Frame size: 683–706 × 512 px per frame
- Problem: frames are ~3.5× too large for the physics body, making characters appear oversized on screen
