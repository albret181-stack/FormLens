# Компоненты и источники

- MediaPipe Tasks Vision **1.1.1**, Apache-2.0: https://github.com/google-ai-edge/mediapipe ; https://www.npmjs.com/package/@mediapipe/tasks-vision . Исходная лицензия доступна в репозитории. Компонент определяет суставы, а не технические ошибки упражнения.
- Pose Landmarker Lite, float16, версия **1**: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task . Описание и model card: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker . Модель включена в сборку без изменений.
- Документация JavaScript: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js . Используется официальный API `detectForVideo`, монотонные временные метки и отдельный worker.
- Electron **45.0.0**, MIT; Chromium и другие компоненты имеют собственные лицензии. `LICENSE` и `LICENSES.chromium.html` поставляются рядом с готовой `.app`: https://github.com/electron/electron .
- @electron/packager **20.3.0**, BSD-2-Clause, только для сборки: https://github.com/electron/packager .
- Контрольное фото для технического теста: https://storage.googleapis.com/mediapipe-assets/pose.jpg . Не относится к пользователю, не является видео тренажёра и исключено из готовой `.app`.

Демо-иллюстрация создана программно внутри проекта. Правила FormLens — отдельные экспериментальные эвристики; они не являются частью и не сертифицированы MediaPipe.

Выбор инструмента: MediaPipe подходит для первого локального прототипа без Python/PyTorch. RTMPose (https://github.com/open-mmlab/mmpose) и Sports2D (https://github.com/davidpagnon/Sports2D) не включены и в этой версии не использовались.
