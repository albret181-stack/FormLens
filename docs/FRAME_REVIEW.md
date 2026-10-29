# Frame review in 0.9.3

After automatic local video sampling, low-observability frames with an identified
subject are retried with the same Full model in IMAGE mode. A second attempt may
crop the original pixels around that subject. Landmarks are mapped back into the
original coordinate system. A retry is retained only if it improves available
measurements without losing a previously available one. At least two confident
shoulder/hip anchors must match; ambiguous matches are rejected. Visibility stays
at 0.75. No missing joint is interpolated, generated, or accepted by lowering its
confidence. The original VIDEO result remains the fallback.

The review derives chronological source-frame sequences from the saved samples.
For each of the first eight complete observed arm cycles it shows the start,
maximum measured elbow flexion, and return. The torso evidence timestamp is not
used as the elbow flexion timestamp. Each frame includes measurements or specific
missing-data reasons. A cycle has an explicit torso check: a measured range with
the existing experimental threshold, or an unassessed state. It never gets a
zero-degree passing range when the torso was not measured.

Without full cycles, six chronological time bins give an overview of the actual
video. Neighbor-supported measurements are preferred within each bin, while
unmeasurable source frames remain available. Up to three recognition limitation
examples have their own source images and explanations. Raw percentages are
collapsed into details. Images are not a generated reference posture.

Opening a frame seeks the source video; replay plays the relevant interval at
0.5x. HTML exports embed these same frame images and descriptions. Saved projects
retain the original video and samples, including retry provenance. Old saved
reports can be viewed without reanalysis; retry results require running again.

Scope remains the existing experimental seated-row torso-motion rule. Frame
review does not recognize the exercise, assess spinal curvature, infer loading,
or certify correct technique. Pose availability is not exercise-error accuracy.
No annotated exercise benchmark or validated technique classifier is introduced.

Verification: unit tests cover phase ordering, correct phase timestamps, missing
measurements, provenance, crop remapping, subject matching and rejection, unchanged
visibility, portable-file round trips, and escaped self-contained HTML export.
Browser checks cover actual source video inference, nonempty evidence canvases,
0.5x replay, cancellation/retry, saving and export. Native update checks remain
required before a release becomes latest.
