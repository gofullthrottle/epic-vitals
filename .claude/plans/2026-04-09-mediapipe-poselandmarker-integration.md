# MediaPipe PoseLandmarker Integration — Implementation Plan

## Date: 2026-04-09

## Objective

Connect `@mediapipe/tasks-vision` PoseLandmarker to the Camera screen's video element and wire the full real-time engine pipeline: pose detection → smoothing → angle calculation → rep detection → phase segmentation → scoring → deviation-colored skeleton overlay.

## Context

The Phase 1 MVP scaffold was completed with all engine modules stubbed and working (scoring, angles, rep detection, phase segmentation, skeleton coloring), but the Camera screen had a `TODO` placeholder at `src/routes/Camera.tsx:69-75` where MediaPipe needed to be connected. The engine modules were tested in isolation but not yet wired to live pose data.

## Approach

### 1. Install `@mediapipe/tasks-vision`
- npm package for MediaPipe's web SDK
- Provides `PoseLandmarker`, `FilesetResolver` for WASM-based inference
- Models loaded from Google's CDN at runtime

### 2. Create `usePoseDetection` hook (`src/hooks/usePoseDetection.ts`)
Encapsulates the entire pipeline in a single React hook to keep the Camera component clean:

**Initialization:**
- Load WASM fileset via `FilesetResolver.forVisionTasks()` from jsDelivr CDN
- Create `PoseLandmarker` with:
  - Model: `pose_landmarker_lite` (float16) — smallest/fastest for real-time
  - Running mode: `VIDEO` (frame-by-frame with timestamps)
  - GPU delegate for hardware acceleration
  - Single pose detection (numPoses: 1)
  - Confidence thresholds: 0.5 for detection, presence, and tracking

**Per-frame processing loop (requestAnimationFrame):**
1. `PoseLandmarker.detectForVideo(videoElement, timestamp)` → 33 normalized landmarks + world landmarks
2. Convert MediaPipe landmark arrays → `Record<JointId, Landmark>` (our type)
   - Use normalized landmarks for x/y screen positions
   - Use world landmarks' z for metric depth (better than normalized z)
3. `PoseProcessor.processLandmarks()` → EMA-smoothed frame
4. `computeAngles()` → 6 critical angles (knee flexion, hip flexion, torso lean, knee valgus, lumbar flexion, ankle dorsiflexion)
5. Compute deviations from reference midpoint keyframe
6. When recording:
   - Accumulate angles for current rep
   - `RepDetector.processFrame()` → detect rep boundaries
   - `PhaseSegmenter.processFrame()` → track eccentric/pause/concentric
   - On rep completion: `scoreRep()` → RepScore with deviations and coaching cues

**Hook return value:**
```typescript
interface PoseDetectionState {
  landmarks: Record<JointId, Landmark> | null  // For skeleton overlay
  angles: Record<string, number>                // Live angle values
  deviations: Record<string, number>            // Angular deviations from reference
  tolerances: Record<string, number>            // Per-angle tolerance bands
  currentPhase: RepPhase                        // eccentric/pause/concentric
  repCount: number                              // Completed reps in current set
  lastRepScore: RepScore | null                 // Most recent rep score
  isReady: boolean                              // Model loaded?
  error: string | null                          // Init failure message
}
```

### 3. Update Camera screen (`src/routes/Camera.tsx`)
- Replace TODO stub with `usePoseDetection(videoRef, isRecording)` hook call
- Pass `pose.landmarks`, `pose.deviations`, `pose.tolerances` to `SkeletonOverlay`
- Pass `pose.lastRepScore` and `pose.repCount` to HUD
- Add loading indicator while model downloads
- Add phase indicator (eccentric/pause/concentric) during recording
- Disable "Start Set" until model is ready
- Sync detected reps to Zustand session store via `recordRep()`

### 4. Key design decisions
- **requestAnimationFrame loop** (not setInterval): Ensures we process exactly one frame per render cycle, matching the browser's refresh rate
- **Strictly increasing timestamps**: MediaPipe requires monotonically increasing timestamps; skip frames where `performance.now()` hasn't advanced
- **World landmarks for z-depth**: MediaPipe provides both normalized (screen-space) and world (metric) landmarks; we use world z for angle calculations since it represents actual depth from hip midpoint
- **Silent frame skip on error**: Individual frame failures don't crash the loop; important for robustness during camera transitions
- **Engine reset on recording toggle**: All stateful engines (PoseProcessor, RepDetector, PhaseSegmenter) reset when recording starts, preventing stale state from prior sets

## Files to create
- `src/hooks/usePoseDetection.ts` — New hook

## Files to modify
- `src/routes/Camera.tsx` — Replace TODO with hook integration
- `package.json` / `package-lock.json` — Add `@mediapipe/tasks-vision` dependency

## Verification
1. `npx tsc -b` — No type errors
2. `npm run build` — Clean production build
3. `npx vitest run` — All 26 existing tests still pass
4. Manual: Camera screen shows loading state → model loads → skeleton overlay appears on body → angles update in real-time → rep detection triggers on squat cycles → scores display
