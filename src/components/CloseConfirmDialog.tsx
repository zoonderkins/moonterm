interface CloseConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export function CloseConfirmDialog({ onConfirm, onCancel }: CloseConfirmDialogProps) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Quit Moonterm?</h3>
        <p>
          Are you sure you want to quit?
          All running terminals will be terminated.
        </p>
        <div className="dialog-actions">
          <button className="dialog-btn cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="dialog-btn confirm" onClick={onConfirm}>
            Quit
          </button>
        </div>
      </div>
    </div>
  )
}
