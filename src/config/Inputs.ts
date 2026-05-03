export enum InputAction {
  Up = 'up',
  Down = 'down',
  Forward = 'forward',   // direction-relative, not left/right
  Back = 'back',
  LP = 'lp', MP = 'mp', HP = 'hp',
  LK = 'lk', MK = 'mk', HK = 'hk',
}

// Player 1: WASD movement + UIO/JKL attacks
export const P1_KEYS: Record<string, InputAction> = {
  W: InputAction.Up,
  S: InputAction.Down,
  A: InputAction.Back,    // physical left key; facing flip makes it Forward when facing left
  D: InputAction.Forward,
  U: InputAction.LP, I: InputAction.MP, O: InputAction.HP,
  J: InputAction.LK, K: InputAction.MK, L: InputAction.HK,
};

// Player 2: arrow keys + numpad 1-6 attacks
// LEFT/RIGHT use same Back/Forward convention as P1; facing flip handles the rest.
export const P2_KEYS: Record<string, InputAction> = {
  UP:    InputAction.Up,
  DOWN:  InputAction.Down,
  LEFT:  InputAction.Back,
  RIGHT: InputAction.Forward,
  NUMPAD_ONE:   InputAction.LP, NUMPAD_TWO:   InputAction.MP, NUMPAD_THREE: InputAction.HP,
  NUMPAD_FOUR:  InputAction.LK, NUMPAD_FIVE:  InputAction.MK, NUMPAD_SIX:   InputAction.HK,
};