import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEventDataset } from '../scripts/event-evaluator.mjs';

const dataset = (annotations, predictions, reviewedIntervals = [[0, 10]]) => ({ schemaVersion: 1, clips: [{ id: 'clip-a', subjectGroup: 'person-a', split: 'test', durationSeconds: 10, reviewedIntervals, annotations: annotations.map(event => ({ ...event, label: 'error' })), predictions }] });
const e = (start, end, type = 'trunk-motion') => ({ type, start, end });

test('exact event is a true positive with zero boundary error', () => {
  const r = evaluateEventDataset(dataset([e(1, 2)], [e(1, 2)]), { split: 'test', tiou: .5 });
  assert.deepEqual(r.overall, { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, falseAlertsPerReviewedMinute: 0 });
  assert.equal(r.byType[0].meanStartErrorSeconds, 0);
  assert.equal(r.byType[0].meanEndErrorSeconds, 0);
});

test('missed event is a false negative', () => {
  const r = evaluateEventDataset(dataset([e(1, 2)], []), { split: 'test', tiou: .5 });
  assert.equal(r.overall.fn, 1);
  assert.equal(r.overall.recall, 0);
});

test('duplicate alert is counted as a false positive, not a second match', () => {
  const r = evaluateEventDataset(dataset([e(1, 2)], [e(1, 2), e(1.1, 1.9)]), { split: 'test', tiou: .5 });
  assert.equal(r.overall.tp, 1);
  assert.equal(r.overall.fp, 1);
});

test('extra alert in a reviewed interval is false; alert outside reviewed scope is excluded', () => {
  const r = evaluateEventDataset(dataset([], [e(4, 5), e(8, 9)], [[0, 6]]), { split: 'test', tiou: .5 });
  assert.equal(r.overall.fp, 1);
  assert.equal(r.skippedPredictions, 1);
  assert.equal(r.reviewedCoverage, .6);
});

test('partial overlap passes only when it reaches the explicit temporal IoU threshold', () => {
  const d = dataset([e(1, 3)], [e(2, 4)]);
  assert.equal(evaluateEventDataset(d, { split: 'test', tiou: .5 }).overall.tp, 0);
  assert.equal(evaluateEventDataset(d, { split: 'test', tiou: .3 }).overall.tp, 1);
});

test('matching is one-to-one and preserves two possible matches', () => {
  const r = evaluateEventDataset(dataset([e(1, 2), e(2, 3)], [e(1, 3), e(1, 2)]), { split: 'test', tiou: .3 });
  assert.equal(r.overall.tp, 2);
  assert.equal(r.overall.fp, 0);
  assert.equal(r.overall.fn, 0);
});

test('same person cannot leak across evaluation splits', () => {
  const d = dataset([e(1, 2)], [e(1, 2)]);
  d.clips.push({ ...d.clips[0], id: 'clip-b', split: 'train' });
  assert.throws(() => evaluateEventDataset(d, { split: 'test', tiou: .5 }), /appears in multiple splits/);
});

test('invalid intervals and implicit split/threshold are rejected', () => {
  assert.throws(() => evaluateEventDataset(dataset([e(1, 2)], []), { tiou: .5 }), /split must be explicitly/);
  assert.throws(() => evaluateEventDataset(dataset([e(1, 2)], []), { split: 'test' }), /tiou must be explicitly/);
  assert.throws(() => evaluateEventDataset(dataset([e(1, 2)], [], [[2, 1]]), { split: 'test', tiou: .5 }), /outside the clip or empty/);
});
