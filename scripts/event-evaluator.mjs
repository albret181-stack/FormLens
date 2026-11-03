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

function scoreClips(clips, tiou) {
  const typeStats = new Map();
  const subjectStats = new Map();
  let totalDuration = 0;
  let reviewedDuration = 0;
  let skippedPredictions = 0;
  for (const clip of clips) {
    totalDuration += clip.durationSeconds;
    const clipReviewed = clip.reviewedIntervals.reduce((sum, [start, end]) => sum + end - start, 0);
    reviewedDuration += clipReviewed;
    const subject = subjectStats.get(clip.subjectGroup) || { tp: 0, fp: 0, fn: 0, reviewedMinutes: 0 };
    subject.reviewedMinutes += clipReviewed / 60;
    subjectStats.set(clip.subjectGroup, subject);
    const annotations = clip.annotations;
    const predictions = [];
    for (const prediction of clip.predictions) {
      const midpoint = (prediction.start + prediction.end) / 2;
      if (clip.reviewedIntervals.some(([start, end]) => midpoint >= start && midpoint <= end)) predictions.push(prediction);
      else skippedPredictions++;
    }
    const types = new Set([...annotations, ...predictions].map(event => event.type));
    for (const type of types) {
      const typeAnnotations = annotations.filter(event => event.type === type);
      const typePredictions = predictions.filter(event => event.type === type);
      const matched = matchEvents(typeAnnotations, typePredictions, tiou);
      const row = typeStats.get(type) || { type, tp: 0, fp: 0, fn: 0, boundaryPairs: [] };
      const tp = matched.length;
      const fp = typePredictions.length - tp;
      const fn = typeAnnotations.length - tp;
      row.tp += tp;
      row.fp += fp;
      row.fn += fn;
      for (const pair of matched) row.boundaryPairs.push({
        start: Math.abs(typePredictions[pair.predictionIndex].start - typeAnnotations[pair.annotationIndex].start),
        end: Math.abs(typePredictions[pair.predictionIndex].end - typeAnnotations[pair.annotationIndex].end)
      });
      typeStats.set(type, row);
      subject.tp += tp;
      subject.fp += fp;
      subject.fn += fn;
    }
  }
  const byType = [...typeStats.values()].sort((a, b) => a.type.localeCompare(b.type)).map(row => {
    const matched = row.boundaryPairs;
    const precision = row.tp + row.fp ? row.tp / (row.tp + row.fp) : null;
    const recall = row.tp + row.fn ? row.tp / (row.tp + row.fn) : null;
    const f1 = precision !== null && recall !== null && precision + recall > 0 ? 2 * precision * recall / (precision + recall) : null;
    return {
      type: row.type, tp: row.tp, fp: row.fp, fn: row.fn, precision, recall, f1,
      meanStartErrorSeconds: matched.length ? matched.reduce((sum, pair) => sum + pair.start, 0) / matched.length : null,
      meanEndErrorSeconds: matched.length ? matched.reduce((sum, pair) => sum + pair.end, 0) / matched.length : null
    };
  });
  const tp = byType.reduce((sum, row) => sum + row.tp, 0);
  const fp = byType.reduce((sum, row) => sum + row.fp, 0);
  const fn = byType.reduce((sum, row) => sum + row.fn, 0);
  const totalReviewedMinutes = reviewedDuration / 60;
  return {
    totalDuration, reviewedDuration, skippedPredictions, subjectStats,
    reviewedCoverage: totalDuration ? reviewedDuration / totalDuration : 0,
    reviewedMinutes: totalReviewedMinutes,
    overall: {
      tp, fp, fn,
      precision: tp + fp ? tp / (tp + fp) : null,
      recall: tp + fn ? tp / (tp + fn) : null,
      falseAlertsPerReviewedMinute: totalReviewedMinutes ? fp / totalReviewedMinutes : null
    },
    byType
  };
}

function metricValues(counts) {
  const precision = counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null;
  const recall = counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null;
  const f1 = precision !== null && recall !== null && precision + recall > 0 ? 2 * precision * recall / (precision + recall) : null;
  const falseAlertsPerReviewedMinute = counts.reviewedMinutes > 0 ? counts.fp / counts.reviewedMinutes : null;
  return { precision, recall, f1, falseAlertsPerReviewedMinute };
}

function percentile(sorted, p) {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function clusterBootstrap(subjectStats, replicates, seed) {
  const groups = [...subjectStats.values()];
  if (groups.length < 2) return {
    method: 'subject-cluster percentile bootstrap',
    subjectGroups: groups.length,
    requestedReplicates: replicates,
    seed,
    intervals95: null,
    reason: 'At least two independent subject groups are required'
  };
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const draws = { precision: [], recall: [], f1: [], falseAlertsPerReviewedMinute: [] };
  for (let i = 0; i < replicates; i++) {
    const sample = { tp: 0, fp: 0, fn: 0, reviewedMinutes: 0 };
    for (let j = 0; j < groups.length; j++) {
      const group = groups[Math.floor(random() * groups.length)];
      sample.tp += group.tp;
      sample.fp += group.fp;
      sample.fn += group.fn;
      sample.reviewedMinutes += group.reviewedMinutes;
    }
    const values = metricValues(sample);
    for (const [key, value] of Object.entries(values)) if (value !== null) draws[key].push(value);
  }
  const intervals95 = Object.fromEntries(Object.entries(draws).map(([key, values]) => {
    const sorted = values.sort((a, b) => a - b);
    return [key, sorted.length ? {
      low: percentile(sorted, 0.025),
      high: percentile(sorted, 0.975),
      validReplicates: sorted.length
    } : null];
  }));
  return {
    method: 'subject-cluster percentile bootstrap',
    subjectGroups: groups.length,
    requestedReplicates: replicates,
    seed,
    intervals95
  };
}

export function evaluateEventDataset(input, { split, tiou, bootstrapReplicates = 1000, seed = 1 } = {}) {
  const data = validateEventDataset(input);
  assert(SPLITS.has(split), 'split must be explicitly set to train, validation, or test');
  assert(Number.isFinite(tiou) && tiou > 0 && tiou <= 1, 'tiou must be explicitly set in (0, 1]');
  assert(Number.isInteger(bootstrapReplicates) && bootstrapReplicates >= 0 && bootstrapReplicates <= 50000, 'bootstrapReplicates must be an integer from 0 to 50000');
  assert(Number.isSafeInteger(seed) && seed >= 0 && seed <= 4294967295, 'seed must be a non-negative safe integer');
  const clips = data.clips.filter(clip => clip.split === split);
  assert(clips.length > 0, `no clips found for split: ${split}`);
  const score = scoreClips(clips, tiou);
  return {
    schemaVersion: 1,
    split,
    tiou,
    clips: clips.length,
    reviewedCoverage: score.reviewedCoverage,
    reviewedMinutes: score.reviewedMinutes,
    skippedPredictions: score.skippedPredictions,
    overall: score.overall,
    byType: score.byType,
    confidenceIntervals95: bootstrapReplicates > 0
      ? clusterBootstrap(score.subjectStats, bootstrapReplicates, seed)
      : null
  };
}

export function runEventEvaluator(args) {
  const splitIndex = args.indexOf('--split');
  const tiouIndex = args.indexOf('--tiou');
  const bootstrapIndex = args.indexOf('--bootstrap');
  const seedIndex = args.indexOf('--seed');
  const valueIndexes = new Set([splitIndex, tiouIndex, bootstrapIndex, seedIndex].filter(index => index >= 0).map(index => index + 1));
  const path = args.find((arg, i) => !arg.startsWith('--') && !valueIndexes.has(i));
  if (!path || splitIndex < 0 || tiouIndex < 0) throw new Error('Usage: node scripts/evaluate-events.mjs <dataset.json> --split <train|validation|test> --tiou <0..1> [--bootstrap <0..50000>] [--seed <integer>]');
  return {
    path,
    split: args[splitIndex + 1],
    tiou: Number(args[tiouIndex + 1]),
    bootstrapReplicates: bootstrapIndex >= 0 ? Number(args[bootstrapIndex + 1]) : 1000,
    seed: seedIndex >= 0 ? Number(args[seedIndex + 1]) : 1
  };
}
