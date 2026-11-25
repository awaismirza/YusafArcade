/** World size in pixels (16:9 play area). */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const RUNWAY_HEIGHT = 56;
export const FLOOR_BOTTOM_Y = GAME_HEIGHT;
/** Track sits in the lower third, with apron below and sky above. */
export const GROUND_SURFACE_Y = 450;
export const FALL_DEATH_Y = GAME_HEIGHT + 36;
/** Screen position of the runner: a small gap in from the left edge. */
export const PLAYER_RUN_X = 88;

export const PHYSICS = {
  gravityY: 2100,
  fallGravityY: 3400,
  walkSpeed: 160,
  /** Same pace on every stage: the level 2 run from before the walk slowdown. */
  autoRunSpeed: 300,
  /** Tap is the short hop. Hold is the long jump. */
  jumpMin: -520,
  jumpMax: -880,
  jumpHoldMs: 150,
  coyoteMs: 90,
  jumpBufferMs: 100,
} as const;

export const WORLD = {
  chunkWidth: 64,
  spawnAhead: GAME_WIDTH + 80,
  despawnBehind: 240,
  minObstacleGap: 260,
  maxObstacleGap: 420,
} as const;

export const HERO = {
  frameW: 88,
  frameH: 138,
  bodyW: 36,
  bodyH: 96,
  /** One size on every stage, a little under the obstacle height. */
  scale: 0.3,
} as const;

/** Distance on the counter before level 2 begins. */
export const STAGE_DISTANCE = 500;

export const COMBAT = {
  hp: 3,
  swordMs: 140,
  swordCooldownMs: 340,
  gunCooldownMs: 220,
  bulletSpeed: 640,
  fireballSpeed: 240,
  monsterShotMs: 1700,
} as const;
