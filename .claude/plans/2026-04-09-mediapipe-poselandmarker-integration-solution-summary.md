# MediaPipe PoseLandmarker Integration — Solution Summary

## Date: 2026-04-09

## What was done

Successfully connected `@mediapipe/tasks-vision` PoseLandmarker to the Camera screen, completing the real-time pose detection → form scoring pipeline.

## Files created

### `src/hooks/usePoseDetection.ts` (220 lines)
Custom React hook encapsulating the full pipeline:

1. **MediaPipe Initialization** — Loads WASM fileset from jsDelivr CDN, creates `PoseLandmarker` with `pose_landmarker_lite` (float16), GPU delegate, VIDEO running mode
2. **Frame Processing Loop** — `requestAnimationFrame`-based loop calling `detectForVideo()` on each frame with strictly increasing timestamps
3. **Landmark Conversion** — Converts MediaPipe's `NormalizedLandmark[]` (array of 33) to our `Record<JointId, Landmark>` type, using world landmarks' z for metric depth
4. **Full Engine Pipeline** — PoseProcessor (EMA smoothing) → AngleCalculator (6 angles) → RepDetector (hip Y periodicity) → PhaseSegmenter (eccentric/pause/concentric) → ScoringEngine (weighted deviation scoring)
5. **State Management** — Returns `PoseDetectionState` with landmarks, angles, deviations, tolerances, phase, rep count, last rep score, readiness, and error state

### Updated `src/routes/Camera.tsx`
- Replaced TODO stub with `usePoseDetection(videoRef, isRecording)` hook
- Skeleton overlay now receives live deviation data and tolerance bands
- HUD displays real-time rep scores and coaching cues from pose analysis
- Added loading indicator ("Loading pose detection model...")
- Added phase indicator pill (eccentric = blue, concentric = green, pause = yellow)
- "Start Set" button disabled until model loads
- Error state displayed if initialization fails
- Rep scores auto-synced to Zustand session store via `useEffect` watching `pose.repCount`

## Pipeline data flow (runtime)

```
Camera video element (30fps)
  ↓ requestAnimationFrame
PoseLandmarker.detectForVideo()
  ↓ 33 normalized landmarks + 33 world landmarks
convertLandmarks() → Record<JointId, Landmark>
  ↓ (normalized x,y + world z for depth)
PoseProcessor.processLandmarks() → smoothed PoseFrame
  ↓ (EMA α=0.5, ~3-frame window)
computeAngles() → { kneeFlexion, hipFlexion, torsoLean, kneeValgus, lumbarFlexion, ankleDorsiflexion }
  ↓
Compare against reference midpoint keyframe → deviations per angle
  ↓
SkeletonOverlay renders colored segments (green/yellow/orange/red)
  ↓ (parallel, when recording)
RepDetector.processFrame() → rep boundary detection
PhaseSegmenter.processFrame() → eccentric/pause/concentric
  ↓ (on rep completion)
scoreRep() → RepScore { formScore, depthScore, deviations[], ... }
  ↓
HUD displays score + letter grade + coaching cue
Session store updated via recordRep()
```

## Key decisions made

| Decision | Rationale |
|----------|-----------|
| `pose_landmarker_lite` model | Fastest inference for real-time; user can swap to `_full` or `_heavy` in one line |
| GPU delegate | Hardware acceleration; falls back gracefully if unavailable |
| `requestAnimationFrame` (not `setInterval`) | Syncs with browser render cycle; avoids wasted work |
| World landmarks z over normalized z | Metric depth from hip midpoint; better for 3D angle computation |
| Silent frame skip on error | Individual frame failures don't crash the loop |
| Hook pattern (not component) | Keeps Camera.tsx clean; pipeline logic fully encapsulated |
| `useEffect` for rep sync | Decouples pose detection from session state updates |

## Verification results

- **TypeScript**: `npx tsc -b` — clean, no errors
- **Build**: `npm run build` — 51 modules, 401KB gzipped to 125KB, built in 274ms
- **Tests**: `npx vitest run` — 26/26 passing (3 test files)
- **Bundle**: `@mediapipe/tasks-vision` adds ~150KB to the bundle; WASM + model loaded separately from CDN at runtime (~4MB one-time download)

## What this enables

With the pipeline connected, the app now:
- Detects the user's body in real-time via the device camera
- Draws a color-coded skeleton overlay (green = good form, red = form breakdown)
- Automatically detects individual squat reps
- Scores each rep on form quality (0-100 with letter grade)
- Provides real-time coaching cues ("Push knees out", "Go deeper", etc.)
- Tracks eccentric/pause/concentric phases
- Saves rep scores to session history

## Remaining gaps for production

1. **Auto-alignment** — `computeAlignment()` is implemented but not yet called in the frame loop (would rotate reference to match camera angle)
2. **Full rep report** — `CombinedRepReport` partially populated (tempo/velocity fields zeroed out — Phase 2)
3. **Model caching** — WASM + model downloaded from CDN on every page load; could be cached via service worker
4. **Performance profiling** — Needs testing on lower-end devices to confirm 30fps is achievable
5. **Camera selection UI** — Currently defaults to rear camera; no front/rear toggle
