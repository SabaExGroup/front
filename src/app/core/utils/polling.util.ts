import { Observable, Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

export interface PollOptions<T> {
  intervalMs: number;
  stopWhen: (value: T) => boolean;
  immediate?: boolean;
}

export function poll<T>(
  fetch: () => Observable<T>,
  options: PollOptions<T>
): Observable<T> {
  const start = options.immediate !== false ? timer(0, options.intervalMs) : timer(options.intervalMs, options.intervalMs);

  return start.pipe(
    switchMap(() => fetch()),
    takeWhile((value) => !options.stopWhen(value), true)
  );
}

export function createPollSubscription<T>(
  fetch: () => Observable<T>,
  options: PollOptions<T>,
  onValue: (value: T) => void,
  onError?: (err: unknown) => void
): Subscription {
  return poll(fetch, options).subscribe({
    next: onValue,
    error: onError,
  });
}
