Pose Landmarker Lite float16 v1
Source: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
SHA256: 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a
Documentation and model card: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
Downloaded 2026-10-26, included without modification.


## FormLens 0.9.2

Production builds include Pose Landmarker Full float16 version 1. `scripts/setup-model.mjs` downloads the official Google model at build time and verifies its pinned SHA-256; analysis on the user's device stays offline. The Lite source asset is retained for development but excluded from the production bundle. Model distribution and documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker . A model confidence score is not a guarantee that an occluded joint was located correctly; the UI reports observations and recognition limits separately from possible technique remarks.
