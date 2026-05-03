/**
 * ErrorToast
 *
 * Rendered when any SchedulerManager async hook rejects.
 * By the time this renders, the store has already been rolled back
 * automatically — this component only needs to inform the user.
 *
 * Props:
 *  operation — the SchedulerManager method that failed, e.g. "addEvent"
 *  message   — the error message extracted from the rejection
 *  onDismiss — called when the user clicks ✕ or the auto-dismiss timer fires
 */
export interface ErrorToastProps {
  message: string;
  operation: string;
  onDismiss: () => void;
}

export function ErrorToast({ message, operation, onDismiss }: ErrorToastProps) {
  return (
    <div className="error-toast" role="alert" aria-live="assertive">
      <div className="error-toast__icon">⚠</div>
      <div className="error-toast__body">
        <span className="error-toast__op">
          "{operation}" failed — change reverted
        </span>
        <span className="error-toast__msg">{message}</span>
      </div>
      <button
        className="error-toast__close"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
