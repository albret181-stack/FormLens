// A remark belongs to a repetition interval; its peak is only the evidence frame.
export function eventWindow(event, report, duration) {
  const rep = event.type === 'swing' ? report?.reps?.find(r => r.number === event.rep) : null;
  const start = Math.max(0, Math.min(duration, rep?.start ?? event.t));
  const end = Math.max(start, Math.min(duration, event.end ?? event.t));
  return {start, end};
}

export function eventAt(time, report, duration) {
  return report?.events?.find(event => {
    if (event.type !== 'swing') return false;
    const {start, end} = eventWindow(event, report, duration);
    return time >= start && time < end;
  }) ?? null;
}

export function reviewRate(time, report, duration, baseRate, autoSlow) {
  return autoSlow && eventAt(time, report, duration) ? Math.min(baseRate, .5) : baseRate;
}
