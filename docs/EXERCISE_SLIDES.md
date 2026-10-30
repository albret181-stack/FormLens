# One exercise, multiple views, slide review (0.10.0)

The user uploads one video, chooses its exercise if needed, and receives a slide
review. The initial screen has one upload action and optional filming guidance.
The exercise picker includes search and an unknown-exercise option. Automatic
exercise classification is not implemented or advertised. Choosing an exercise
in the filming guide before upload skips a redundant picker.

A video remains one exercise even when it compares muscle emphasis, stance, knee
bend or range. Separate screen regions are independent views of that exercise.
No angle comparison between two variants labels either variant an error.

For automatic panel detection, three independent IMAGE probes look for consistent
pose placement in source halves. Repeated consistent evidence selects a clip
layout; otherwise per-frame detection has a short hold across detection misses.
Manual overrides cover one view, two stacked, two side-by-side, three stacked,
and four quadrants. Automatic layout inference is heuristic; dynamic collages,
inset diagrams and background people can require an override. Pose measurements
are transformed back into original frame coordinates. Each view has a tracker.

All measurements retain visibility >=0.75. Stored points are rounded to 1e-6 and
omit unused depth coordinates to keep portable projects within the manifest cap.
No missing joint is interpolated, enhanced or generated. Regions with insufficient
measurements remain explicitly unassessed. This is local MediaPipe Full inference,
not training on reference clips or a vision-language model.

The catalog includes seated row, Romanian deadlift, back extension, cable
kickback, hip thrust/KAS variants, floor bridge, leg press, split squat/lunge,
squat/Smith squat and machine chest press. Entries provide exercise-specific
filming guidance and limitations. Catalog membership does not imply complete
technique assessment.

Experimental geometric checks:
- RDL: change in knee flexion within eligible movement intervals, not a universal
  starting angle. The NSCA RDL description motivates the isometric-knee criterion:
  https://www.nsca.com/education/articles/kinetic-select/romanian-deadlift-rdl/
- Seated row / cable kickback: change in projected trunk inclination during an
  observable arm / hip movement. Intentional variations and camera motion can
  produce the same observation; an attention card is not a confirmed error.
- Machine chest press: projected elbow height relative to shoulder, plus bilateral
  elbow angle differences when both arms and an appropriate view are observable.
  These are exploratory image checks, not a validated definition of ideal form.

Checks require continuous neighbor-supported observations, >=16 samples, >=1.8s
and observable motion. Every eligible interval is evaluated; a longer clean
interval cannot suppress a shorter attention interval. Gaps and view identity
changes are not bridged. Robust 20th/80th percentiles suppress isolated spikes.
Display thresholds (15deg knee change, 18deg trunk range, 20deg elbow difference,
0.15 torso-length elbow height) are experimental engineering values, not clinical
cutoffs or measured accuracy. No muscles' activation percentages, pain diagnosis,
spinal curvature, load safety or universal correct-technique score is inferred.
Unsupported checks are stated on the first/limitation slides.

Slides show summary, attention observations, specific checked observations,
chronological source frames, unassessed scope and recording guidance. Only one
slide is displayed at a time; navigation supports buttons, keyboard and swipe.
The source player is disclosed on demand; replay uses 0.5x. HTML export preserves
the same slide content and frames. The portable format and storage schema remain
compatible; panel points, selected exercise and slide position are retained.
Existing saved projects use their stored points without a new model run.

Verification includes synthetic unit cases for visibility, motion, gaps, separate
views of one exercise, interval selection, crop mapping, export/import integrity
and escaped HTML. Browser checks use locally provided reference media; user media
and derived screenshots are not committed or published. Native update checks
cover signatures, restart, storage and bundled offline inference before latest
release promotion is retained.
