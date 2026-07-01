export type OptimisticOrderSubmitState<T> = {
  pending: boolean;
  error: string | null;
  result: T | null;
};

export type OptimisticOrderSubmitOptions<T> = {
  onOptimistic?: () => void;
  submit: () => Promise<T>;
  onSuccess: (result: T) => void;
  onRollback?: () => void;
  onError?: (message: string) => void;
};

/** Run guest order submit with optimistic UI + rollback on failure. */
export async function runOptimisticOrderSubmit<T>({
  onOptimistic,
  submit,
  onSuccess,
  onRollback,
  onError,
}: OptimisticOrderSubmitOptions<T>): Promise<T | null> {
  onOptimistic?.();

  try {
    const result = await submit();
    onSuccess(result);
    return result;
  } catch (error) {
    onRollback?.();
    const message =
      error instanceof Error ? error.message : "Order could not be placed.";
    onError?.(message);
    return null;
  }
}
