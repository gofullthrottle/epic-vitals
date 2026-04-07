# FormCoach Phase 1 MVP Scaffold — Solution Summary

## Date: 2026-04-07

## Overview

Scaffolded the complete Phase 1 MVP for FormCoach — an AI-powered real-time lifting form trainer — based on the `formcoach-megaprompt-spec.md` specification. The app targets barbell back squat form analysis using MediaPipe pose estimation with deviation-colored skeleton feedback.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 + TypeScript 6 |
| Mobile | CapacitorJS (web → native iOS/Android) |
| State | Zustand |
| Storage | IndexedDB via `idb` |
| Routing | React Router v7 |
| Camera | Web Camera API + MediaPipe tasks-vision |
| Rendering | HTML5 Canvas (skeleton overlay) |
| Testing | Vitest + Testing Library |

## Architecture

```
src/
├── types/          # Core TypeScript interfaces from spec
│   ├── pose.ts     # 33-point MediaPipe landmarks, Vec3, PoseFrame
│   ├── reference.ts # ReferenceLift, NormalizedKeyframe, AngleConstraint
│   ├── scoring.ts  # RepScore, Deviation, SetScore, letter grades
│   └── session.ts  # Session, ExerciseRecord, ActiveSessionState
├── engine/         # Core processing pipeline
│   ├── angle-calculator.ts   # Joint angle computation (6 critical angles)
│   ├── auto-alignment.ts     # Shoulder orientation → reference rotation
│   ├── rep-detector.ts       # Hip center periodicity → rep boundaries
│   ├── phase-segmenter.ts    # Eccentric/pause/concentric detection
│   ├── scoring-engine.ts     # Weighted angular deviation → 0-100 score
│   ├── skeleton-colors.ts    # Deviation → green/yellow/orange/red
│   └── pose-processor.ts     # EMA smoothing, pelvis normalization
├── data/references/          # Reference trajectory JSON files
├── store/          # Zustand state management
├── db/             # IndexedDB persistence
├── components/     # Reusable UI (SkeletonOverlay, HUD, ScoreBadge, CoachingCue)
├── routes/         # App screens (Home, Camera, Review, Summary)
└── utils/          # Math (Vec3 ops, angles, rotation) + constants
```

## Key Design Decisions

1. **React + Capacitor over React Native** — User preference; web-first with native deployment via Capacitor. MediaPipe has excellent web SDK support (`@mediapipe/tasks-vision`).

2. **`const` object over `enum` for JointId** — TypeScript 6's `erasableSyntaxOnly` flag prohibits runtime enums. Used `as const` pattern with companion type.

3. **Phase-segmented comparison over DTW** — Per spec recommendation: cheaper than Dynamic Time Warping, handles tempo variation by interpolating within detected phases.

4. **Deviation-colored skeleton over ghost overlay** — During live sets, the user's own skeleton is color-coded (green/yellow/orange/red). Ghost overlay reserved for between-set review (future phase).

5. **IndexedDB over SQLite** — Web-native storage; works in both browser and Capacitor without native plugins.

## Engine Pipeline (Data Flow)

```
Camera Frame → MediaPipe PoseLandmarker (33 landmarks + z-depth)
  → PoseProcessor (EMA smoothing)
  → AutoAlignment (shoulder orientation → reference rotation)
  → AngleCalculator (6 critical angles per frame)
  → RepDetector (hip Y periodicity → rep boundaries)
  → PhaseSegmenter (eccentric/pause/concentric)
  → ScoringEngine (weighted angular deviation → 0-100)
  → SkeletonColors (deviation → segment colors)
  → Canvas render (colored skeleton overlay on camera feed)
```

## Reference Data

Sample `barbell-back-squat-high-bar.json`:
- 21 normalized keyframes (t: 0.0 → 1.0) covering full squat rep
- 6 angle constraints: knee flexion, hip flexion, knee valgus (critical), lumbar flexion (critical), torso lean, ankle dorsiflexion
- Phase timing: 55% eccentric, 5% pause, 40% concentric
- Velocity profiles per phase

## Scoring (from spec section 3.4.3)

```
formScore = 100 - Σ(weight × clamp(|observed - reference| / tolerance, 0, 1) × 100)
```

Angle weights (back squat): knee flexion 25%, hip flexion 20%, knee valgus 20%, torso lean 15%, lumbar flexion 15%, ankle dorsiflexion 5%.

Letter grades: S (95-100), A (85-94), B (70-84), C (50-69), D (<50).

## Test Coverage

- 26 unit tests passing
- `src/utils/math.test.ts` — Vec3 ops, angle3D, angleFromVertical, frontalPlaneAngle, rotateY, clamp
- `src/engine/scoring-engine.test.ts` — Perfect score, proportional penalties, deviation generation, depth scoring, valid range
- `src/engine/skeleton-colors.test.ts` — Color thresholds (green/yellow/orange/red)

## What's Next

1. **MediaPipe Integration** — Connect `@mediapipe/tasks-vision` PoseLandmarker to Camera screen video element (TODO in `src/routes/Camera.tsx`)
2. **Reference Trajectory Builder** — CLI tool for processing coach videos through Sapiens pipeline
3. **Tempo/Velocity Analysis** — Phase 2 engine modules
4. **Audio Breath Detection** — Phase 3 pipeline
5. **Gamification** — Achievement system, longitudinal analytics
