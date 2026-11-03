# Offline event evaluator

This small local utility scores detector events against a reviewed annotation file. It does not inspect video, label movement as an error, select thresholds, or establish model accuracy on its own.

## Dataset format

Keep the JSON and any source videos on the evaluator's local machine. Use anonymized `subjectGroup` IDs. Every clip belongs to exactly one `train`, `validation`, or `test` split; clips from the same person must remain in one split.

A `reviewedIntervals` entry means the entire interval was reviewed and all target events in it were exhaustively annotated. Events outside reviewed intervals are not scored. Omit intervals that are disputed, occluded, or otherwise not assessable. Only expert-confirmed positive events belong in `annotations`; an empty list means no target event was found in the reviewed intervals.

```json
{
  "schemaVersion": 1,
  "clips": [
    {
      "id": "anonymous-clip-01",
      "subjectGroup": "person-01",
      "split": "test",
      "durationSeconds": 12.0,
      "reviewedIntervals": [[0.0, 8.5]],
      "annotations": [
        { "type": "candidate-id", "label": "error", "start": 3.2, "end": 3.8 }
      ],
      "predictions": [
        { "type": "candidate-id", "start": 3.1, "end": 3.9 }
      ]
    }
  ]
}
```

Times are seconds from the original clip. `type` is a stable detector/annotation class ID. Predictions whose midpoint falls outside a reviewed interval are excluded and counted as skipped. An unmatched prediction inside reviewed footage is a false alert.

## Run

Choose the split and temporal intersection-over-union (tIoU) threshold explicitly:

```sh
node scripts/evaluate-events.mjs ./private-annotations.json --split validation --tiou 0.5
```

Use `train` to explore rules, `validation` to select settings, and keep the final `test` set frozen until the protocol, matching threshold, and detector settings are fixed. The evaluator requires a threshold argument so it is visible in the report.

Output includes one-to-one event matches, TP/FP/FN, precision/recall/F1 by type, mean start/end boundary error, reviewed footage coverage, skipped predictions, and false alerts per reviewed minute. Duplicate predictions cannot match the same annotation twice. By default, 1,000 seeded cluster-bootstrap resamples produce percentile 95% intervals for overall precision, recall, F1, and false alerts per reviewed minute. Resampling is by anonymized subject group, not by repetition; intervals are withheld for fewer than two groups. Use `--bootstrap 0` to turn resampling off, or `--bootstrap 5000 --seed 42` to set a reproducible run.

## Limits

The intervals describe sampling variability across the provided subject groups only. They do not prove annotation quality, guarantee performance on new populations, or measure pose visibility. Very small samples and rare events can yield unstable or undefined intervals; inspect `validReplicates` and report the number of independent subject groups. Do not describe a small or non-independent sample as validated accuracy. Those steps still require the annotation and evaluation protocol in Issue #2 and an independently split, rights-cleared dataset in Issue #3.