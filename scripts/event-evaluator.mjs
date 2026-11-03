const SPLITS = new Set(['train', 'validation', 'test']);

function assert(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finiteTime(value, label) {
  assert(Number.isFinite(value) && value >= 0, `${label} must be a non-negative number`);
}

function insideInterval(event, intervals) {
  return intervals.some(([start, end]) => event.start >= start && event.end <= end);
}

export function validateEventDataset(data) {
  assert(data && typeof data === 'object' && data.schemaVersion === 1, 'schemaVersion must be 1');
  assert(Array.isArray(data.clips), 'clips must be an array');
  const clipIds = new Set();
  const subjectSplits = new Map();
  for (const [index, clip] of data.clips.entries()) {
    const prefix = `clips[${index}]`;
    assert(clip && typeof clip.id === 'string' && clip.id.trim(), `${prefix}.id is required`);
    assert(!clipIds.has(clip.id), `duplicate clip id: ${clip.id}`);
    clipIds.add(clip.id);
    assert(typeof clip.subjectGroup === 'string' && clip.subjectGroup.trim(), `${prefix}.subjectGroup is required (use an anonymized ID)`);
    assert(SPLITS.has(clip.split), `${prefix}.split must be train, validation, or test`);
    const priorSplit = subjectSplits.get(clip.subjectGroup);
    assert(priorSplit === undefined || priorSplit === clip.split, `subjectGroup ${clip.subjectGroup} appears in multiple splits`);
    subjectSplits.set(clip.subjectGroup, clip.split);
    finiteTime(clip.durationSeconds, `${prefix}.durationSeconds`);
    assert(clip.durationSeconds > 0, `${prefix}.durationSeconds must be greater than zero`);
    assert(Array.isArray(clip.reviewedIntervals), `${prefix}.reviewedIntervals must be an array`);
    let previousEnd = -1;
    for (const [j, interval] of clip.reviewedIntervals.entries()) {
      assert(Array.isArray(interval) && interval.length === 2, `${prefix}.reviewedIntervals[${j}] must be [start, end]`);
      const [start, end] = interval;
      finiteTime(start, `${prefix}.reviewedIntervals[${j}][0]`);
      finiteTime(end, `${prefix}.reviewedIntervals[${j}][1]`);
      assert(start < end && end <= clip.durationSeconds, `${prefix}.reviewedIntervals[${j}] is outside the clip or empty`);
      assert(start >= previousEnd, `${prefix}.reviewedIntervals must be sorted and non-overlapping`);
      previousEnd = end;
    }
    for (const key of ['annotations', 'predictions']) {
      assert(Array.isArray(clip[key]), `${prefix}.${key} must be an array`);
      for (const [j, event] of clip[key].entries()) {
        const label = `${prefix}.${key}[${j}]`;
        assert(event && typeof event.type === 'string' && event.type.trim(), `${label}.type is required`);
        finiteTime(event.start, `${label}.start`);
        finiteTime(event.end, `${label}.end`);
        assert(event.start < event.end && event.end <= clip.durationSeconds, `${label} is outside the clip or empty`);
        if (key === 'annotations') {
          assert(event.label === 'error', `${label}.label must be error; only confirmed positives belong in annotations`);
          assert(insideInterval(event, clip.reviewedIntervals), `${label} must be inside a reviewed interval`);
        }
      }
    }
  }
  return data;
}

function intersectionOverUnion(a, b) {
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const union = Math.max(a.end, b.end) - Math.min(a.start, b.start);
  return union > 0 ? intersection / union : 0;
}

function matchEvents(annotations, predictions, threshold) {
  const edges = predictions.map((prediction, predictionIndex) => annotations
    .map((annotation, annotationIndex) => ({ annotationIndex, iou: prediction.type === annotation.type ? intersectionOverUnion(prediction, annotation) : 0 }))
    .filter(edge => edge.iou >= threshold)
    .sort((a, b) => b.iou - a.iou || a.annotationIndex - b.annotationIndex));
  const annotationOwner = new Map();
  const assigned = new Map();
  function assign(predictionIndex, seen) {
    for (const edge of edges[predictionIndex]) {
      if (seen.has(edge.annotationIndex)) continue;
      seen.add(edge.annotationIndex);
      const owner = annotationOwner.get(edge.annotationIndex);
      if (owner === undefined || assign(owner, seen)) {
        annotationOwner.set(edge.annotationIndex, predictionIndex);
        assigned.set(predictionIndex, edge);
        return true;
      }
    }
    return false;
  }
  for (let i = 0; i < predictions.length; i++) assign(i, new Set());
  return [...assigned.entries()].map(([predictionIndex, edge]) => ({ predictionIndex, annotationIndex: edge.annotationIndex, iou: edge.iou }));
}

function summarizeClass(type, annotations, predictions, matched) {
  const tp = matched.length;
  const fp = predictions.length - tp;
  const fn = annotations.length - tp;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? 2 * precision * recall / (precision + recall) : null;
  const startError = matched.length ? matched.reduce((sum, pair) => sum + Math.abs(predictions[pair.predictionIndex].start - annotations[pair.annotationIndex].start), 0) / matched.length : null;
  const endError = matched.length ? matched.reduce((sum, pair) => sum + Math.abs(predictions[pair.predictionIndex].end - annotations[pair.annotationIndex].end), 0) / matched.length : null;
  return { type, tp, fp, fn, precision, recall, f1, meanStartErrorSeconds: startError, meanEndErrorSeconds: endError };
}

export function evaluateEventDataset(input, { split, tiou } = {}) {
  const data = validateEventDataset(input);
  assert(SPLITS.has(split), 'split must be explicitly set to train, validation, or test');
  assert(Number.isFinite(tiou) && tiou > 0 && tiou <= 1, 'tiou must be explicitly set in (0, 1]');
  const clips = data.clips.filter(clip => clip.split === split);
  assert(clips.length > 0, `no clips found for split: ${split}`);
  let totalDuration = 0;
  let reviewedDuration = 0;
  let skippedPredictions = 0;
  const allAnnotations = [];
  const allPredictions = [];
  for (const clip of clips) {
    totalDuration += clip.durationSeconds;
    reviewedDuration += clip.reviewedIntervals.reduce((sum, [start, end]) => sum + end - start, 0);
    allAnnotations.push(...clip.annotations.map(event => ({ ...event, clipId: clip.id })));
    for (const prediction of clip.predictions) {
      const midpoint = (prediction.start + prediction.end) / 2;
      if (clip.reviewedIntervals.some(([start, end]) => midpoint >= start && midpoint <= end)) allPredictions.push({ ...prediction, clipId: clip.id });
      else skippedPredictions++;
    }
  }
  const types = [...new Set([...allAnnotations, ...allPredictions].map(event => event.type))].sort();
  const byType = types.map(type => {
    const annotations = allAnnotations.filter(event => event.type === type);
    const predictions = allPredictions.filter(event => event.type === type);
    const matched = [];
    for (const clip of clips) {
      const clipAnnotations = annotations.filter(event => event.clipId === clip.id);
      const clipPredictions = predictions.filter(event => event.clipId === clip.id);
      matched.push(...matchEvents(clipAnnotations, clipPredictions, tiou).map(pair => ({ ...pair,
        predictionIndex: predictions.indexOf(clipPredictions[pair.predictionIndex]),
        annotationIndex: annotations.indexOf(clipAnnotations[pair.annotationIndex])
      })));
    }
    return summarizeClass(type, annotations, predictions, matched);
  });
  const tp = byType.reduce((sum, row) => sum + row.tp, 0);
  const fp = byType.reduce((sum, row) => sum + row.fp, 0);
  const fn = byType.reduce((sum, row) => sum + row.fn, 0);
  const totalReviewedMinutes = reviewedDuration / 60;
  return {
    schemaVersion: 1, split, tiou, clips: clips.length,
    reviewedCoverage: totalDuration ? reviewedDuration / totalDuration : 0,
    reviewedMinutes: totalReviewedMinutes,
    skippedPredictions,
    overall: {
      tp, fp, fn,
      precision: tp + fp ? tp / (tp + fp) : null,
      recall: tp + fn ? tp / (tp + fn) : null,
      falseAlertsPerReviewedMinute: totalReviewedMinutes ? fp / totalReviewedMinutes : null
    },
    byType
  };
}

export function runEventEvaluator(args) {
  const splitIndex = args.indexOf('--split');
  const tiouIndex = args.indexOf('--tiou');
  const path = args.find(arg => !arg.startsWith('--') && arg !== args[splitIndex + 1] && arg !== args[tiouIndex + 1]);
  if (!path || splitIndex < 0 || tiouIndex < 0) throw new Error('Usage: node scripts/evaluate-events.mjs <dataset.json> --split <train|validation|test> --tiou <0..1>');
  return { path, split: args[splitIndex + 1], tiou: Number(args[tiouIndex + 1]) };
}
