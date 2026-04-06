/** Deviation-colored skeleton colors (from spec section 8.1) */
export const COLORS = {
  GREEN: '#22C55E',
  YELLOW: '#EAB308',
  ORANGE: '#F97316',
  RED: '#EF4444',
  SKELETON_DEFAULT: '#FFFFFF',
  BACKGROUND: '#000000',
} as const

/** Overall score component weights (from spec section 6.2) */
export const SCORE_WEIGHTS = {
  form: 0.45,
  depth: 0.20,
  tempo: 0.15,
  breathing: 0.10,
  stability: 0.10,
} as const

/** Critical angle weights for barbell back squat (from spec section 3.4.3) */
export const SQUAT_ANGLE_WEIGHTS: Record<string, { weight: number; tolerance: number }> = {
  kneeFlexion: { weight: 0.25, tolerance: 5 },
  hipFlexion: { weight: 0.20, tolerance: 8 },
  torsoLean: { weight: 0.15, tolerance: 10 },
  kneeValgus: { weight: 0.20, tolerance: 5 },
  lumbarFlexion: { weight: 0.15, tolerance: 5 },
  ankleDorsiflexion: { weight: 0.05, tolerance: 8 },
} as const

/** Rep detection parameters (from spec section 3.4.1) */
export const REP_DETECTION = {
  /** Sliding window duration in seconds */
  windowDuration: 2,
  /** Minimum time between rep boundaries in seconds */
  debounceTime: 0.8,
  /** Frames per second for pose estimation */
  targetFps: 30,
} as const

/** Temporal smoothing parameters */
export const SMOOTHING = {
  /** EMA alpha for 3-frame equivalent window */
  alpha: 0.5,
  /** Re-alignment interval in seconds */
  realignInterval: 2,
} as const
