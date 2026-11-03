import { readFile } from 'node:fs/promises';
import { evaluateEventDataset, runEventEvaluator } from './event-evaluator.mjs';

try {
  const options = runEventEvaluator(process.argv.slice(2));
  const data = JSON.parse(await readFile(options.path, 'utf8'));
  const report = evaluateEventDataset(data, options);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`Event evaluation failed: ${error.message}\n`);
  process.exitCode = 1;
}
