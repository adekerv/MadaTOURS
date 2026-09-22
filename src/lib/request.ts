// Works in older supported mobile WebViews without AbortSignal.any/timeout.
export async function withRequestSignal<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal | null,
  timeout = 15000,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) controller.abort();
  const timer = setTimeout(abort, timeout);
  let onAbort: () => void = () => {};
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => {
        onAbort = () =>
          reject(new DOMException('The request was cancelled or timed out.', 'AbortError'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
      }),
      controller.signal.aborted
        ? Promise.reject(new DOMException('Request cancelled.', 'AbortError'))
        : operation(controller.signal),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
