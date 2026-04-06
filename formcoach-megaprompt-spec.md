# FormCoach: AI-Powered Real-Time Lifting Form Trainer
## Product & Technical Megaprompt Specification v1.1
### Updated: Sapiens offline pipeline + MediaPipe real-time + auto-alignment architecture

---

## 1. PRODUCT VISION

**One-liner:** A mobile app that uses real-time pose estimation to compare your lifting form against biomechanically-optimal reference models, monitors breathing via audio analysis during music playback, evaluates tempo/velocity, and gamifies the entire rep-by-rep experience.

**Core value proposition:** Every lifter has a "form drift" problem — form degrades under fatigue, during progressive overload, and especially when training alone. FormCoach acts as a pocket biomechanics coach that scores every rep in real-time and builds a longitudinal form quality dataset.

**Target user:** Intermediate-to-advanced lifters who already know the movements but want objective feedback on execution quality. Secondary: beginners learning movement patterns for the first time.

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────────────┐
│                      MOBILE CLIENT                            │
│                                                              │
│  ┌───────────────┐          ┌──────────┐                     │
│  │ Camera        │          │ Audio    │                     │
│  │ Pipeline      │          │ Pipeline │                     │
│  └──────┬────────┘          └────┬─────┘                     │
│         │                        │                            │
│  ┌──────▼────────┐          ┌────▼─────┐                     │
│  │ MediaPipe     │          │ Breath   │                     │
│  │ Pose (33 pts  │          │ Detector │                     │
│  │ + relative z) │          │(on-device│                     │
│  │ 30fps+        │          │ ML)      │                     │
│  └──────┬────────┘          └────┬─────┘                     │
│         │                        │                            │
│  ┌──────▼────────┐               │                            │
│  │ Auto-Align    │               │                            │
│  │ (shoulder     │               │                            │
│  │ orientation → │               │                            │
│  │ ref rotation) │               │                            │
│  └──────┬────────┘               │                            │
│         │                        │                            │
│         └────────────┬───────────┘                            │
│                      │                                        │
│              ┌───────▼────────┐                                │
│              │  Fusion Engine │                                │
│              │  (Frame-sync)  │                                │
│              └───────┬────────┘                                │
│                      │                                        │
│         ┌────────────▼────────────┐                            │
│         │   Scoring & Gamification│                            │
│         │   Engine                │                            │
│         └────────────┬────────────┘                            │
│                      │                                        │
│              ┌───────▼────────┐                                │
│              │   UI / HUD     │                                │
│              │  (deviation-   │                                │
│              │  colored skel) │                                │
│              └────────────────┘                                │
│                                                              │
└──────────────┬───────────────────────────────────────────────┘
               │
      ┌────────▼────────┐
      │  Cloud Backend   │
      │  (optional)      │
      │  - Reference DB  │
      │  - User history  │
      │  - Leaderboards  │
      └─────────────────┘

┌──────────────────────────────────────────────────────────────┐
│               OFFLINE REFERENCE PIPELINE (GPU)                │
│                                                              │
│  Coach Video → Meta Sapiens (0.3-2B params, 1K res)          │
│    → Pose (308 keypoints) + Dense Depth + Surface Normals    │
│    → Rep Segmentation → Trajectory Normalization             │
│    → Canonical Reference Model (.json)                       │
│    → Ship to mobile as lightweight data file                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. PIPELINE 1: POSE ESTIMATION & FORM COMPARISON

### 3.1 On-Device Pose Model Selection

**Primary recommendation: MediaPipe Pose Landmarker (latest)**
- 33 body landmarks in 3D (x, y, z + visibility + presence confidence)
- Runs at 30fps+ on modern phones (iPhone 12+, Pixel 6+)
- Native iOS (Swift) and Android (Kotlin) SDKs
- The z-coordinate is relative depth from the hip midpoint — sufficient for sagittal plane analysis (squat depth, hip hinge angle, torso lean)

**Alternative: MoveNet Thunder (TFLite)**
- 17 keypoints, slightly faster, less granular
- Better for older devices
- No native z-depth — would need monocular depth estimation as a supplement

**Fallback: Apple Vision framework (iOS only)**
- VNHumanBodyPoseObservation — 19 joints
- Tight OS integration, very fast
- No z-coordinate — would require LiDAR or monocular depth

**Recommendation:** MediaPipe as primary, with Apple Vision as iOS fast-path fallback. MediaPipe's 33-point model includes landmarks that MoveNet misses (e.g., heel vs. toe distinction matters for squat foot position analysis).

### 3.2 Depth Estimation Strategy: Two-Tier Architecture

The key architectural insight: depth estimation is needed at two very different quality levels, and trying to run a high-fidelity depth model in real-time on-device is unnecessary.

**Tier 1 (Real-time, on-device): MediaPipe's built-in relative z-depth**

MediaPipe Pose Landmarker already outputs a z-coordinate per landmark, representing relative depth from the hip midpoint. This is NOT metric depth — it's a relative ordering (shoulder is X units closer to camera than hip). However, for the actual task at hand (computing joint angles), relative depth between joints is sufficient:

- Knee flexion angle: computed from hip→knee→ankle vectors. MediaPipe's z gives you the depth differential between these three points, which is all you need to compute the 3D angle.
- Torso lean: computed from hip→shoulder vector. The z-component tells you how far forward the shoulders are relative to hips.
- Knee valgus: requires the frontal plane relationship between hip, knee, and ankle. MediaPipe's z distinguishes a knee collapsing inward vs. tracking properly.

**Accuracy considerations:** MediaPipe's z is noisier than dedicated depth models, but for angular comparisons within a single skeleton, the relative relationships are consistent frame-to-frame. Temporal smoothing (exponential moving average, 3-frame window) eliminates most jitter without adding latency.

**When MediaPipe z is NOT sufficient:** Absolute bar path tracking in metric units (cm of forward drift). This is a nice-to-have for VBT analytics but not critical for form scoring. Can be approximated by calibrating against the user's known shoulder width in the first frame.

**Tier 2 (Offline, GPU): Meta Sapiens for reference model generation**

Meta's Sapiens model family (ECCV 2024 Oral) is purpose-built for human-centric vision tasks including monocular depth estimation. Key specs:

- Models range from 0.3B to 2B parameters
- Native 1024×1024 resolution inference
- Trained on 300M+ in-the-wild human images
- Depth model trained on 500K synthetic images from 600 high-res photogrammetry scans
- Outperforms Depth Anything by ~20% RMSE on human-specific benchmarks (Hi4D)
- Also outputs surface normals (useful for detecting subtle rotational deviations)
- Open source: github.com/facebookresearch/sapiens

**Why Sapiens for references but not real-time:** The smallest model (0.3B params) is far too large for 30fps mobile inference. But for the offline reference pipeline, you only process each coach recording once on a GPU workstation. The quality difference is massive — you get dense per-pixel depth maps and surface normals that let you build highly accurate 3D canonical trajectories.

**Pipeline split:**
- Mobile (real-time): MediaPipe 33-landmark pose with relative z → angular comparison → scoring
- Desktop/server (one-time): Sapiens 1B+ model → high-fidelity 3D reference trajectories → export as lightweight JSON → ship to mobile app

This eliminates the need for LiDAR, ARKit, or any device-specific depth hardware. Every phone with a camera can run the real-time pipeline.

### 3.2.1 Auto-Alignment via Shoulder Orientation

The biggest UX improvement from this architecture: **no AR positioning guide required.** The user just props their phone up and starts lifting.

**How it works:**

```
1. DETECT STARTING POSE
   - User stands in frame in starting position (standing with bar on back, standing at bar for deadlift, etc.)
   - MediaPipe detects 33 landmarks including left/right shoulder, left/right hip

2. COMPUTE VIEWING ANGLE
   - shoulderVector = rightShoulder - leftShoulder (3D)
   - viewingAngle = atan2(shoulderVector.z, shoulderVector.x)
   - This tells you the camera's angle relative to the lifter:
     - ~0° = pure frontal view
     - ~90° = pure side view
     - 45° = diagonal
   - Also compute: body scale factor from shoulder width or hip-to-shoulder distance

3. ROTATE REFERENCE MODEL
   - Apply rotation matrix R(viewingAngle) to all reference trajectory keyframes
   - Apply scale factor S to normalize reference skeleton to user's proportions
   - The reference "stick figure" now exists in the same camera-relative coordinate space as the user

4. LOCK AND TRACK
   - Re-compute alignment every N frames (every 2s) to handle minor phone shifts
   - Use hip center as the anchor point for translation alignment
   - All angular comparisons happen in the skeleton's LOCAL coordinate frame,
     not in camera space — this makes the comparison angle-invariant
```

**Why this works:** Joint angles are intrinsic to the skeleton. A knee flexion of 90° looks different from the front vs. the side in camera space, but in the skeleton's local coordinate frame, it's always 90°. By computing angles in local space (hip→knee→ankle vectors) rather than screen space, the camera angle becomes irrelevant for form scoring.

**What the user experiences:** They prop their phone against their water bottle, start their set, and the app just works. No "stand here," no "angle your phone at 90°," no calibration wizard. The auto-alignment handles everything.

**Edge cases:**
- Phone directly behind the lifter: MediaPipe can still detect the skeleton but z-depth estimation degrades. Suggest repositioning if shoulder z-separation falls below threshold.
- Multiple people in frame: Use the bounding box with highest confidence / largest area. Let user tap to select if ambiguous.
- Phone moves mid-set: The periodic re-alignment (every 2s) catches this. If alignment shift exceeds threshold, flag but don't interrupt the set.

### 3.3 Reference Form Model ("Gold Standard")

This is the core differentiator. The reference model is NOT a single static pose — it's a **trajectory through joint-angle space over the duration of a rep**.

#### 3.3.1 Data Structure: Reference Lift

```typescript
interface ReferenceLift {
  exerciseId: string;                    // e.g., "barbell_back_squat"
  variant: string;                       // e.g., "high_bar", "low_bar", "front_squat"
  source: "coach_recording" | "dataset" | "biomechanics_literature";

  // Normalized rep trajectory — time is 0.0 (start) to 1.0 (end)
  // This allows comparison regardless of actual rep tempo
  trajectory: NormalizedKeyframe[];

  // Per-phase timing ratios (what % of the rep should each phase occupy)
  phaseTimingRatios: {
    eccentric: number;    // e.g., 0.55 (55% of rep duration)
    pause: number;        // e.g., 0.05 (brief pause at bottom)
    concentric: number;   // e.g., 0.40 (40% of rep duration)
  };

  // Critical angle constraints (hard boundaries, not just scoring)
  constraints: AngleConstraint[];

  // Velocity profile expectations
  velocityProfile: VelocityPhase[];
}

interface NormalizedKeyframe {
  t: number;                             // 0.0 to 1.0
  joints: Record<JointId, JointState>;   // All 33 MediaPipe landmarks
  criticalAngles: Record<string, number>; // Named angles at this frame
}

interface JointState {
  position: Vec3;          // Normalized position (relative to hip center)
  velocity: Vec3;          // Instantaneous velocity vector
  acceleration: Vec3;      // Instantaneous acceleration
  confidence: number;      // How important this joint is at this phase
}

interface AngleConstraint {
  name: string;                   // e.g., "knee_valgus", "lumbar_flexion"
  jointTriple: [JointId, JointId, JointId]; // Three points defining the angle
  phase: "eccentric" | "concentric" | "pause" | "all";
  min: number;                    // Minimum acceptable angle (degrees)
  max: number;                    // Maximum acceptable angle (degrees)
  ideal: number;                  // Target angle
  severity: "warning" | "critical"; // "critical" = injury risk
  plane: "sagittal" | "frontal" | "transverse";
}
```

#### 3.3.2 Building the Reference Dataset

**Option A: Coach-recorded gold standard (highest quality, most effort)**
1. Record a qualified coach/athlete performing 10+ reps of each exercise
2. Single camera angle is sufficient — Sapiens provides dense monocular depth, eliminating the need for multi-angle recording or LiDAR. Side view recommended for sagittal-dominant exercises (squat, deadlift); front view for frontal-plane exercises (lateral raises)
3. Run full Sapiens pipeline (pose + depth + normals) on recordings
4. Expert review: a coach annotates which reps are "textbook" and flags any deviations
5. Average the top-5 reps to create the canonical trajectory
6. Manually define constraint boundaries based on biomechanics literature

**Option B: Public dataset extraction (faster bootstrap, noisier)**

Available datasets:
- **Fitness-AQA** — Exercise quality assessment with scores, multiple exercises
- **SPHERE (Simon Fraser)** — Rehabilitation exercises with quality annotations
- **InfiniteRep** — Synthetic but useful for pre-training
- **YouTube scraping** — Search "[exercise] form tutorial" from reputable channels (Jeff Nippard, Renaissance Periodization, Squat University), run pose estimation on the demo portions
- **OpenPose / H36M datasets** — General human pose, not exercise-specific but useful for model fine-tuning

**Pipeline for dataset processing (using Meta Sapiens):**

```
Raw Video → Frame Extraction (ffmpeg, 30fps)
    → Person Detection + Bounding Box (Sapiens built-in RTMPose detector)
    → Sapiens Pose Estimation (up to 308 keypoints, 1K resolution)
    → Sapiens Depth Estimation (dense per-pixel depth map)
    → Sapiens Surface Normal Estimation (for rotational deviation detection)
    → Joint Angle Calculation (per-frame, using full 3D reconstructed skeleton)
    → Rep Segmentation (detect start/end of each rep via hip vertical position periodicity)
    → Time Normalization (warp each rep to 0.0-1.0)
    → Outlier Rejection (discard reps with >2σ deviation from mean trajectory)
    → Canonical Trajectory Generation (average remaining reps)
    → Downsample keypoints (308 → 33 MediaPipe-compatible subset for mobile comparison)
    → Constraint Extraction (min/max angles observed across good reps + literature margins)
```

**Note on keypoint mapping:** Sapiens provides up to 308 keypoints. The reference model is built at this higher fidelity (capturing details like individual finger positions and fine spinal segmentation), then downsampled to the 33-point MediaPipe skeleton for mobile comparison. The higher-fidelity data is preserved in the reference file for potential future use (e.g., if on-device models improve to 100+ keypoints).

**Option C: Hybrid (recommended)**
- Bootstrap with Option B for initial coverage of major lifts
- Record Option A gold standards for the 10 most common exercises
- Use user data (high-scoring reps from advanced users) to continuously refine

#### 3.3.3 Key Exercises to Model First (Priority Order)

1. Barbell back squat (high bar + low bar)
2. Conventional deadlift
3. Romanian deadlift
4. Barbell bench press
5. Overhead press
6. Barbell row
7. Walking lunge
8. Bulgarian split squat
9. Front squat
10. Hip thrust

### 3.4 Real-Time Form Comparison Algorithm

#### 3.4.1 Rep Detection

```
Approach: Joint-angle periodicity detection

1. Track hip-center vertical position over sliding window (2s)
2. Detect local minima (bottom of squat/deadlift) and maxima (lockout)
3. Each min→max→min cycle = 1 rep
4. For exercises like bench press, track elbow angle periodicity instead
5. Debounce: minimum 0.8s between rep boundaries (prevents false positives from bar wobble)
```

#### 3.4.2 Time Warping & Comparison

The user's rep will NOT be the same duration as the reference. Use Dynamic Time Warping (DTW) or a simpler phase-segmented approach:

**Phase-segmented approach (recommended for real-time):**

```
1. Detect rep start (standing position)
2. Detect phase transition: eccentric → pause → concentric
   - Eccentric: hip center moving downward (squat) or bar moving away from lockout
   - Pause: velocity near zero at bottom position
   - Concentric: hip center moving upward / bar returning to lockout
3. Within each phase, linearly interpolate time to match reference phase keyframes
4. At each interpolated frame, compute angular deviation from reference
```

This avoids the computational cost of full DTW while handling tempo variation.

#### 3.4.3 Deviation Scoring

```typescript
interface RepScore {
  overall: number;            // 0-100

  formScore: number;          // 0-100, weighted angular deviation
  tempoScore: number;         // 0-100, how well they matched target tempo
  depthScore: number;         // 0-100, did they hit proper ROM
  breathScore: number;        // 0-100, from audio pipeline
  stabilityScore: number;     // 0-100, bar path / COM wobble

  deviations: Deviation[];    // Specific callouts
  phase: "eccentric" | "concentric" | "pause";
}

interface Deviation {
  joint: JointId;
  angle: string;              // e.g., "knee_valgus"
  observed: number;           // degrees
  expected: number;           // degrees
  delta: number;              // degrees off
  severity: "minor" | "warning" | "critical";
  cue: string;                // e.g., "Push knees out"
  timestamp: number;          // ms into rep
}
```

**Scoring formula:**

```
formScore = 100 - Σ(weight_i × clamp(|θ_observed_i - θ_reference_i| / tolerance_i, 0, 1) × 100)

Where:
- weight_i = importance of angle i for this exercise (e.g., knee angle matters more than wrist angle in squat)
- tolerance_i = acceptable deviation band (degrees) before penalty begins
- Angles are computed in the appropriate plane (sagittal, frontal, transverse)
```

**Critical angle weighting examples (barbell back squat):**

| Angle | Weight | Tolerance | Plane |
|-------|--------|-----------|-------|
| Knee flexion (depth) | 0.25 | ±5° | Sagittal |
| Hip hinge angle | 0.20 | ±8° | Sagittal |
| Torso lean | 0.15 | ±10° | Sagittal |
| Knee valgus/varus | 0.20 | ±5° | Frontal |
| Lumbar flexion (butt wink) | 0.15 | ±5° | Sagittal |
| Ankle dorsiflexion | 0.05 | ±8° | Sagittal |

---

## 4. PIPELINE 2: TEMPO & VELOCITY ANALYSIS

### 4.1 Why Tempo Matters

The BDNF / hypertrophy / strength adaptation is significantly influenced by time under tension and contraction velocity. The spec calls for detecting:

- **Controlled eccentric (negative):** Slow, steady descent. Target: 2-4 seconds depending on exercise.
- **Explosive concentric (positive):** Maximum acceleration off the bottom. Target: as fast as possible with maintained form.
- **No bounce / momentum:** Smooth transition at bottom, no elastic rebound cheating.

### 4.2 Velocity Tracking

```typescript
interface VelocityProfile {
  eccentricVelocity: number[];     // cm/s at each frame during eccentric phase
  concentricVelocity: number[];    // cm/s at each frame during concentric phase
  peakConcentricVelocity: number;  // cm/s — proxy for power output
  eccentricSteadiness: number;     // 0-1, variance of eccentric velocity (lower = more controlled)
  transitionSmoothness: number;    // 0-1, how cleanly they reversed direction

  // VBT (Velocity Based Training) metrics
  meanConcentricVelocity: number;  // Standard VBT metric
  peakVelocity: number;
  timeTopeakVelocity: number;      // ms — faster = more explosive
}
```

**Tracking approach:**
- Primary: Track bar endpoint (wrist landmark for most barbell lifts) vertical velocity
- Secondary: Track hip center vertical velocity (more stable, less noise)
- For depth: use the z-component to detect bar path deviations (e.g., bar drifting forward during squat)

### 4.3 Tempo Scoring

```
tempoScore components:
1. Eccentric control (40%): Was descent velocity steady? Low variance = high score.
2. Concentric explosiveness (30%): Was there acceleration from bottom position?
   Higher peak velocity relative to mean = more explosive = higher score.
3. Transition quality (20%): Was the eccentric-to-concentric reversal smooth?
   Jerk (derivative of acceleration) at transition point — lower = better.
4. Lockout quality (10%): Did they fully extend without hyperextension?
```

---

## 5. PIPELINE 3: BREATHING ANALYSIS VIA AUDIO

### 5.1 The Simultaneous Playback + Recording Challenge

This is the trickiest engineering problem in the entire app.

**iOS approach:**
- `AVAudioSession` category: `.playAndRecord` with options `.defaultToSpeaker` and `.allowBluetooth`
- Use `.mixWithOthers` if playing music from user's library
- Configure audio session BEFORE activating camera to avoid session conflicts
- Echo cancellation: iOS handles this natively with `.playAndRecord` — the system subtracts the known playback signal from the mic input

**Android approach:**
- `AudioManager` with `MODE_IN_COMMUNICATION` or `MODE_NORMAL`
- `OpenSL ES` or `AAudio` for low-latency simultaneous I/O
- Echo cancellation: `AcousticEchoCanceler` effect processor
- Some Android devices have poor echo cancellation — may need a model trained to be robust to music bleed

### 5.2 Breath Detection Model

**What we're detecting:**
- Inhale timing (typically during eccentric phase or at top)
- Exhale timing (typically during concentric phase or at point of max exertion)
- Valsalva maneuver detection (breath hold during heaviest portion — advanced technique)
- Breathing rate between sets

**Model architecture options:**

**Option A: Audio classification (simpler, recommended for v1)**
```
Raw audio (16kHz mono)
  → Pre-emphasis filter
  → Echo cancellation (subtract music signal)
  → MFCC extraction (13 coefficients, 25ms windows, 10ms stride)
  → Small CNN or CRNN classifier
  → Output: [inhale, exhale, hold, ambient, music] per 100ms window
```

**Option B: Spectrogram-based (more accurate, heavier)**
```
Raw audio → Mel spectrogram (128 bins)
  → U-Net style segmentation model
  → Pixel-level classification of breath events
  → Temporal smoothing (HMM or CTC)
```

**Training data for breath detection:**
- Record 50+ sessions of lifting with intentional breathing (exaggerated at first)
- Label inhale/exhale timestamps
- Augment with various music genres and gym ambient noise
- The key challenge is distinguishing a forceful exhale from a grunt, music bass hit, or plate clank
- Supplement with IMU data (chest expansion correlates with breathing if phone is chest-mounted — but usually it's propped up elsewhere, so audio-only is more practical)

**Practical shortcut for v1:**
- Instead of a custom model, use amplitude envelope analysis
- Forceful exhales during lifting produce a characteristic sharp amplitude spike in the 100-500Hz range
- Music energy tends to be more broadband and sustained
- A simple bandpass filter (100-500Hz) + onset detection + correlation with concentric phase timing can get you 70-80% accuracy without any ML
- Upgrade to ML model once you have enough labeled data from v1 users

### 5.3 Breath Scoring

```typescript
interface BreathScore {
  overall: number;              // 0-100

  timingAccuracy: number;       // Did they exhale during concentric?
  consistency: number;          // Same pattern every rep?
  breathHoldDetected: boolean;  // Valsalva — flag but don't penalize for heavy compounds

  pattern: BreathEvent[];
}

interface BreathEvent {
  type: "inhale" | "exhale" | "hold";
  startMs: number;              // Relative to rep start
  endMs: number;
  repPhase: "eccentric" | "concentric" | "pause" | "inter_rep";
  confidence: number;           // Model confidence
}
```

**Scoring rules:**
- Exhale during concentric phase: +40 points
- Inhale during eccentric phase: +30 points
- Consistent pattern across reps: +20 points
- No prolonged breath hold during light/moderate work: +10 points
- Valsalva during heavy compounds (squat, deadlift, OHP at >80% 1RM): not penalized, noted

---

## 6. FUSION ENGINE: SYNCHRONIZING ALL THREE PIPELINES

### 6.1 Frame-Level Synchronization

All three pipelines must be temporally aligned:

```
Timeline:  |----Rep 1----|----Rep 2----|----Rep 3----|
Pose:      30fps frames, each with 33 landmarks + depth
Audio:     16kHz stream, processed in 100ms windows
Velocity:  Derived from pose (inter-frame joint displacement)

Sync strategy:
- Master clock: camera frame timestamps (most reliable)
- Audio: buffer with timestamps, align to nearest camera frame
- Pose + depth: computed per camera frame
- Velocity: computed from consecutive camera frames
- Breath events: detected from audio windows, mapped to camera frame range
```

### 6.2 Combined Rep Report

```typescript
interface CombinedRepReport {
  repNumber: number;
  durationMs: number;

  // Sub-scores
  form: RepScore;            // From pose pipeline
  tempo: VelocityProfile;    // From velocity pipeline
  breath: BreathScore;       // From audio pipeline

  // Composite
  overallScore: number;      // Weighted combination

  // Coaching
  primaryCue: string;        // Single most important thing to fix
  secondaryCues: string[];   // Other notes

  // Trend
  fatigueIndicator: number;  // How much has form degraded since rep 1?

  // Raw data (for replay)
  poseFrames: PoseFrame[];
  audioSegment: AudioBuffer;
}
```

**Overall score weighting:**

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Form | 45% | Primary safety and effectiveness metric |
| Depth/ROM | 20% | Non-negotiable for proper stimulus |
| Tempo | 15% | Important for TUT and power development |
| Breathing | 10% | Supports performance, hard to measure perfectly |
| Stability | 10% | Bar path / COM wobble indicates control |

---

## 7. GAMIFICATION SYSTEM

### 7.1 Rep-Level Scoring

```
Rep Score: 0-100
  S-Tier: 95-100 (biomechanically near-perfect)
  A-Tier: 85-94  (excellent form, minor deviations)
  B-Tier: 70-84  (good form, some corrections needed)
  C-Tier: 50-69  (passable, multiple issues)
  D-Tier: <50    (significant form breakdown, consider deloading)
```

### 7.2 Set-Level Aggregation

```typescript
interface SetScore {
  reps: CombinedRepReport[];

  averageScore: number;
  consistencyBonus: number;        // Reward for maintaining form across all reps
  fatigueResistanceBonus: number;  // Reward for last rep being close to first rep

  // Fatigue curve
  formDecayRate: number;           // How fast did form degrade across reps?
  rep1Score: number;
  lastRepScore: number;

  // Achievements triggered
  achievements: Achievement[];
}
```

### 7.3 Achievement System

```
Session achievements:
  "Iron Discipline"     — All reps in a set scored A-tier or above
  "Deep Foundations"     — Hit full ROM on every squat rep
  "Breathwork Master"   — Perfect breath timing for 3+ consecutive reps
  "Tempo King"          — Eccentric control variance < 5% across set
  "Explosive Power"     — Peak concentric velocity improved over the set
  "Fatigue Fighter"     — Last rep score within 5 points of first rep

Longitudinal achievements:
  "Form Evolution"      — Average squat score improved 10+ points over 4 weeks
  "Consistency Streak"  — 10 consecutive sessions with average score > 80
  "Full Range Club"     — Hit depth on 95%+ of squat reps for 30 days
  "New PR — Clean"      — Hit a weight PR with form score > 85
```

### 7.4 Social / Competitive (Optional)

- Weekly form challenges: "Best squat form score this week"
- Anonymized leaderboards by exercise and weight class
- Share rep replays (stick figure overlay on video) to socials
- Gym-level leaderboards (if gym partnership)

---

## 8. USER INTERFACE / HUD

### 8.1 During-Set HUD (Minimal, Non-Distracting)

**Key design principle:** The user's own skeleton IS the primary visualization. No ghost overlay during the set — with good form, a ghost would be invisible anyway (it overlaps perfectly). Instead, color-code the detected skeleton segments based on real-time deviation from reference.

```
┌──────────────────────────┐
│  SQUAT  Set 2/4  Rep 3/8 │
│                          │
│     [Live Camera Feed]   │
│     [Skeleton Overlay]   │
│     Green = on track     │
│     Yellow = drifting    │
│     Red = critical       │
│                          │
│  ┌────┐                  │
│  │ 87 │ ← Last rep score │
│  │ A  │                  │
│  └────┘                  │
│                          │
│  ▼ "Push knees out"      │ ← Real-time cue (triggered by red segment)
│                          │
│  ♪ Currently Playing     │
│  ═══════════●──── 2:34   │
└──────────────────────────┘
```

**Skeleton coloring logic:**

```typescript
function getSegmentColor(jointA: JointId, jointB: JointId, deviation: number): Color {
  // deviation = angular distance from reference for the angles involving this segment
  if (deviation < tolerance * 0.5) return GREEN;   // #22C55E — within 50% of tolerance band
  if (deviation < tolerance * 0.8) return YELLOW;  // #EAB308 — approaching limit
  if (deviation < tolerance * 1.0) return ORANGE;  // #F97316 — at tolerance edge
  return RED;                                       // #EF4444 — exceeding tolerance (form breakdown)
}

// Example: during a squat, if knee valgus exceeds 5° tolerance:
// - Hip→Knee segment turns yellow/red on the affected side
// - Audio cue fires: "Push knees out"
// - The OTHER segments (torso, ankles) stay green if they're fine
```

**Why deviation-coloring beats ghost overlay:**
1. During the lift, you're watching yourself in the camera feed. A ghost overlaid on top of your body is visual noise.
2. Color changes on your own skeleton are immediately parseable — you see WHERE the problem is.
3. At full speed (2-4 second reps), you can't compare two overlapping skeletons anyway. Color is instant.
4. A ghost that's nearly identical to you (good form) provides zero information. Color provides a continuous gradient.

### 8.2 Rep Review Screen (Between Sets — where ghost overlay lives)

This is where the reference ghost overlay makes sense. Between sets, the user has time to study the comparison at their own pace.

Shows:
- Stick figure replay of the rep with color-coded joints (green = good, yellow = warning, red = critical)
- **Ghost overlay mode:** Your stick figure trajectory vs. reference trajectory overlaid, with the reference shown as a semi-transparent outline. User can scrub through the rep frame-by-frame.
- Score breakdown: form / depth / tempo / breath
- Primary coaching cue for next set
- Slowest/fastest frame highlighting (shows where eccentric control was best/worst)

### 8.3 Session Summary

- Total volume (sets × reps × weight)
- Average form score per exercise
- Form trend chart (did form improve or degrade through session?)
- Best rep highlight
- Worst rep analysis
- Breath consistency grade
- Historical comparison to last session with same exercises

---

## 9. TECHNICAL IMPLEMENTATION ROADMAP

### Phase 1: MVP (8-12 weeks)

**Scope:** Single exercise (barbell back squat), MediaPipe 3D pose (with z-depth), auto-alignment, basic scoring

- [ ] Camera integration + MediaPipe pose estimation (33 landmarks + relative z)
- [ ] Auto-alignment: shoulder orientation detection → reference model rotation
- [ ] Rep detection algorithm (hip center periodicity)
- [ ] Build reference squat trajectory using Sapiens offline pipeline (5+ coach recordings on GPU)
- [ ] Keypoint downsampling: Sapiens 308-point → 33-point MediaPipe-compatible reference
- [ ] Phase segmentation (eccentric / pause / concentric)
- [ ] Angular deviation scoring (sagittal + frontal plane: knee, hip, torso, knee valgus)
- [ ] Deviation-colored skeleton overlay (green/yellow/red per segment)
- [ ] Basic HUD with rep counter and score
- [ ] Session history storage (local SQLite)
- [ ] Score display with letter grade

**Stack:** React Native + Expo (cross-platform) OR native Swift (iOS-first, recommended for ML inference performance)

**Why iOS-first:** Better audio session control for Phase 3, more consistent ML inference performance, larger market share among fitness-focused demographics. LiDAR is NOT required (MediaPipe z-depth is sufficient), so the iOS-first argument is weaker than originally stated — cross-platform via React Native is viable from day one.

### Phase 2: Tempo, Velocity & Exercise Expansion (6-8 weeks)

- [ ] Velocity tracking (joint displacement between frames → cm/s via calibration)
- [ ] Eccentric control analysis (velocity variance scoring)
- [ ] Concentric explosiveness metrics (peak velocity, time-to-peak)
- [ ] Tempo scoring integration into overall score
- [ ] Expand to 5 exercises (deadlift, bench, OHP, row) — requires running Sapiens pipeline per exercise
- [ ] Reference trajectory builder CLI tool (batch processing for coaches)
- [ ] Rep replay with ghost overlay (between-set review screen)
- [ ] Anthropometry input: user height/limb proportions → reference angle adjustment

### Phase 3: Audio & Breath (4-6 weeks)

- [ ] Simultaneous playback + recording audio session
- [ ] Echo cancellation pipeline
- [ ] Breath detection v1 (bandpass + onset detection)
- [ ] Breath-to-phase correlation scoring
- [ ] Music integration (Apple Music / Spotify playback)
- [ ] Combined scoring (form + tempo + breath)

### Phase 4: Gamification & Social (4-6 weeks)

- [ ] Achievement system
- [ ] Longitudinal analytics (form trends over weeks/months)
- [ ] Fatigue detection (form decay rate)
- [ ] Deload recommendations based on form degradation patterns
- [ ] Shareable rep replays (stick figure video export)
- [ ] Leaderboards

### Phase 5: Dataset Flywheel (Ongoing)

- [ ] Opt-in data collection from high-scoring users
- [ ] Continuous reference model refinement
- [ ] Exercise auto-detection (classify which exercise from pose sequence)
- [ ] Custom exercise support (record your own reference)
- [ ] ML model fine-tuning on real user data

---

## 10. REFERENCE DATASET PIPELINE (DETAILED)

### 10.1 Source Video Ingestion

```bash
# Step 1: Download/collect source videos
# Acceptable sources:
#   - Self-recorded coach demonstrations (best)
#   - Licensed fitness datasets (Fitness-AQA, etc.)
#   - Creative Commons training videos

# Step 2: Extract frames
ffmpeg -i source_video.mp4 -vf fps=30 -q:v 2 frames/frame_%06d.jpg

# Step 3: Set up Sapiens (one-time)
git clone https://github.com/facebookresearch/sapiens.git
# Download checkpoints from HuggingFace:
# - sapiens_1b (pose, depth, normal) — recommended balance of speed vs accuracy
# - Or sapiens_2b for maximum fidelity if GPU allows

# Step 4: Run Sapiens pose estimation (batch, GPU)
# Using Sapiens-Lite for optimized inference (4x faster)
python sapiens_pose.py \
  --input_dir frames/ \
  --output_dir poses/ \
  --model sapiens_1b \
  --keypoints 308 \           # Full keypoint set
  --resolution 1024

# Step 5: Run Sapiens depth estimation (batch, GPU)
python sapiens_depth.py \
  --input_dir frames/ \
  --output_dir depths/ \
  --model sapiens_1b

# Step 6: Run Sapiens surface normal estimation (batch, GPU)
python sapiens_normal.py \
  --input_dir frames/ \
  --output_dir normals/ \
  --model sapiens_1b

# Step 7: Fuse pose + depth + normals into 3D skeleton
python fuse_sapiens_outputs.py \
  --poses_dir poses/ \
  --depths_dir depths/ \
  --normals_dir normals/ \
  --output fused_3d_poses.jsonl

# Step 8: Segment reps
python segment_reps.py \
  --input fused_3d_poses.jsonl \
  --exercise barbell_back_squat \
  --output reps/

# Step 9: Normalize, average, and downsample
python build_reference.py \
  --reps_dir reps/ \
  --output reference_models/barbell_back_squat_high_bar.json \
  --outlier_threshold 2.0 \      # Reject reps >2σ from mean
  --min_reps 5 \                  # Need at least 5 good reps
  --downsample_to 33 \            # MediaPipe-compatible 33-point skeleton
  --preserve_full_resolution true # Keep 308-point data in separate field
```

**Hardware requirements for reference pipeline:**
- GPU: NVIDIA RTX 3090 or better (Sapiens 1B fits in 24GB VRAM)
- For Sapiens 2B: A100 40GB+ recommended, or use bfloat16 weights
- Processing time: ~2-5 minutes per minute of source video (depends on model size)
- This runs ONCE per exercise per reference recording — not a recurring cost

### 10.2 Joint Angle Computation

```typescript
// Key angles to compute per frame

function computeAngles(landmarks: Landmark[]): Record<string, number> {
  return {
    // Sagittal plane
    kneeFlexion: angle3D(landmarks.HIP, landmarks.KNEE, landmarks.ANKLE),
    hipFlexion: angle3D(landmarks.SHOULDER, landmarks.HIP, landmarks.KNEE),
    torsoLean: angleFromVertical(landmarks.HIP, landmarks.SHOULDER),
    ankleDorsiflexion: angle3D(landmarks.KNEE, landmarks.ANKLE, landmarks.FOOT_INDEX),

    // Frontal plane
    kneeValgus: frontalPlaneAngle(landmarks.HIP, landmarks.KNEE, landmarks.ANKLE),
    hipShift: lateralDisplacement(landmarks.LEFT_HIP, landmarks.RIGHT_HIP),
    shoulderTilt: angleBetween(landmarks.LEFT_SHOULDER, landmarks.RIGHT_SHOULDER, horizontal),

    // Transverse plane
    footRotation: footAngleRelativeToHip(landmarks.HEEL, landmarks.FOOT_INDEX, landmarks.HIP),

    // Derived
    lumbarFlexion: spinalSegmentAngle(landmarks.MID_SPINE, landmarks.HIP), // "butt wink" detector
    barPath: horizontalDisplacement(landmarks.LEFT_WRIST, landmarks.RIGHT_WRIST), // Should be ~0 for back squat
  };
}
```

---

## 11. MONETIZATION MODEL

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | 1 exercise (squat), 3 sets/day, basic score |
| Pro | $9.99/mo | All exercises, unlimited sets, breath analysis, session history, achievements |
| Coach | $29.99/mo | Everything + custom reference models, client management, form report export |

---

## 12. COMPETITIVE LANDSCAPE & DIFFERENTIATION

**Existing apps:**
- **Tempo (acquired by JLab):** Had 3D pose estimation but used a depth sensor attachment. Discontinued consumer product.
- **FormCheck:** Video upload + AI review (not real-time). Async feedback.
- **Onyx:** Real-time rep counting and some form feedback. Limited scoring depth.
- **EliteHRV / PUSH Band:** Hardware-based velocity tracking. No form analysis.

**FormCoach differentiation:**
1. **Real-time deviation-colored skeleton** — nobody does angle-invariant auto-aligned form comparison with visual feedback on the user's own skeleton
2. **Sapiens-powered reference models** — highest-fidelity human-specific 3D reconstruction for the gold standard, running offline where compute is unlimited
3. **Zero-setup UX** — no AR calibration, no specific camera angle required, no LiDAR needed. Prop your phone up and go
4. **Breath integration** — completely unaddressed by competitors
5. **Gamification with longitudinal tracking** — form score trends over weeks/months, not just per-session
6. **Open reference model format** — coaches can record and distribute their own "gold standard" models

---

## 13. KNOWN RISKS & MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pose estimation accuracy in poor gym lighting | High | Medium | Run confidence check on first frame; warn user if landmark visibility drops below threshold; temporal smoothing reduces flicker |
| MediaPipe z-depth noise in frontal plane | Medium | Medium | 3-frame exponential moving average smoothing; weight frontal-plane scores lower than sagittal; allow user to specify "side view" for more accurate sagittal analysis |
| Audio breath detection false positives from gym noise | High | Low (in scoring impact) | Weight breath score at only 10%; offer "quiet mode" toggle; improve model over time with user data |
| Phone falls over mid-set | Medium | Low | Auto-detect sudden orientation change → pause scoring, resume when stable; don't lose rep data already captured |
| Reference model doesn't account for anthropometry | Medium | Medium | Phase 2: Allow user to input height, limb proportions; adjust reference angles accordingly (longer femurs = more torso lean in squat is normal) |
| Battery drain from camera + ML + audio | Medium | Medium | Offer "lite mode" (lower FPS, skip breath); session time warnings; typical set is 30-60 seconds so drain is manageable |
| Liability if user gets injured following score-driven behavior | Low | High | Prominent disclaimer; critical deviation alerts prioritize safety cues over scores; never suggest increasing weight |
| Sapiens model updates break reference pipeline | Low | Medium | Pin Sapiens checkpoint version per reference model; include model version in reference file metadata |
| Multiple people in frame | Medium | Low | Use largest bounding box by default; allow user tap-to-select; ignore secondary skeletons |

---

## 14. OPEN QUESTIONS FOR FOUNDER DECISION

1. **iOS-first or cross-platform?** With the LiDAR dependency removed (MediaPipe z-depth is sufficient), the iOS-first argument is weaker. React Native + Expo is viable from day one for broader reach. However, iOS still has better `AVAudioSession` control for the breath detection pipeline. Recommendation: React Native with iOS as primary test platform.

2. **Edge-only or cloud hybrid?** All ML inference should be on-device for latency. Cloud for: reference model distribution, achievement sync, anonymized data collection. The Sapiens reference pipeline runs on YOUR GPU (RTX 3090 in the homelab is sufficient for Sapiens 1B), so no cloud GPU costs for model generation.

3. **Consumer or B2B first?** Consumer is faster to market. B2B (gym partnerships, PT platforms) is higher ARPU but longer sales cycle. Recommend consumer launch → B2B expansion.

4. **Build the reference pipeline as a separate tool?** Yes — the "Reference Model Builder" should be a standalone CLI/desktop app that coaches can use to create and validate their own reference models. This becomes a platform play. The Sapiens dependency means coaches need GPU access — consider offering reference model generation as a cloud service ($X per exercise model).

5. **Patent potential?** The multi-modal fusion (pose + auto-alignment + audio breath detection + deviation-colored skeleton + gamified scoring) as a combined system may be patentable. The auto-alignment approach (shoulder orientation → reference rotation → angle-invariant local-space comparison) is a novel UX simplification worth including. Worth a provisional filing before public launch.

6. **Sapiens model size for reference pipeline?** 0.3B is fastest but lowest quality. 1B is the sweet spot (fits on RTX 3090, significant quality improvement). 2B requires A100+ but marginal gains over 1B for this use case. Recommend 1B as default, 2B as optional high-fidelity mode.

---

*End of specification. This document is designed to be handed to a development team (or used as a self-build roadmap) with enough detail to begin implementation immediately.*
