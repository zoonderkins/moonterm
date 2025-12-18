import { useState, useRef, useEffect } from 'react'

interface PasswordDialogProps {
  mode: 'set' | 'unlock' | 'confirm-delete'
  workspaceName: string
  hint?: string
  onSubmit: (password: string, hint?: string) => void
  onCancel: () => void
  onDelete?: () => void
  error?: string
}

/**
 * Password Dialog for workspace encryption
 *
 * Modes:
 * - set: Set a new password for locking workspace
 * - unlock: Enter password to unlock workspace
 * - confirm-delete: Confirm deletion of locked workspace (forgot password)
 */
export function PasswordDialog({
  mode,
  workspaceName,
  hint,
  onSubmit,
  onCancel,
  onDelete,
  error
}: PasswordDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordHint, setPasswordHint] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (mode === 'set') {
      if (password.length < 4) {
        setLocalError('Password must be at least 4 characters')
        return
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match')
        return
      }
      onSubmit(password, passwordHint || undefined)
    } else if (mode === 'unlock') {
      if (!password) {
        setLocalError('Please enter password')
        return
      }
      onSubmit(password)
    }
  }

  const displayError = error || localError

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog password-dialog" onClick={e => e.stopPropagation()}>
        <h3>
          {mode === 'set' && '🔒 Lock Workspace'}
          {mode === 'unlock' && '🔓 Unlock Workspace'}
          {mode === 'confirm-delete' && '⚠️ Delete Locked Workspace'}
        </h3>

        <p className="workspace-name-label">
          {workspaceName}
        </p>

        {mode === 'confirm-delete' ? (
          <>
            <p className="warning-text">
              This workspace is locked and you cannot access it without the password.
              Deleting it will permanently remove all data.
            </p>
            <div className="dialog-actions">
              <button className="dialog-btn cancel" onClick={onCancel}>
                Cancel
              </button>
              <button className="dialog-btn danger" onClick={onDelete}>
                Delete Permanently
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {hint && mode === 'unlock' && (
              <div className="password-hint">
                💡 Hint: {hint}
              </div>
            )}

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'set' ? 'Enter new password' : 'Enter password'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {mode === 'set' && (
              <>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label>Password Hint (optional)</label>
                  <input
                    type="text"
                    value={passwordHint}
                    onChange={e => setPasswordHint(e.target.value)}
                    placeholder="Hint to help remember password"
                  />
                </div>
              </>
            )}

            {displayError && (
              <div className="error-message">
                {displayError}
              </div>
            )}

            <div className="dialog-actions">
              <button type="button" className="dialog-btn cancel" onClick={onCancel}>
                Cancel
              </button>
              {mode === 'unlock' && onDelete && (
                <button
                  type="button"
                  className="dialog-btn danger"
                  onClick={() => onDelete()}
                  title="Forgot password? Delete this workspace"
                >
                  Forgot Password
                </button>
              )}
              <button type="submit" className="dialog-btn confirm">
                {mode === 'set' ? 'Lock' : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
