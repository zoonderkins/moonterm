import { useState, useEffect } from 'react'

interface QuickStartDialogProps {
  isOpen: boolean
  onClose: () => void
  isFirstLaunch?: boolean
}

const QUICK_START_SEEN_KEY = 'moonterm_quick_start_seen'

export function hasSeenQuickStart(): boolean {
  return localStorage.getItem(QUICK_START_SEEN_KEY) === 'true'
}

export function markQuickStartSeen(): void {
  localStorage.setItem(QUICK_START_SEEN_KEY, 'true')
}

export function QuickStartDialog({ isOpen, onClose, isFirstLaunch = false }: QuickStartDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleClose = () => {
    if (dontShowAgain || isFirstLaunch) {
      markQuickStartSeen()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog quick-start-dialog" onClick={e => e.stopPropagation()}>
        <div className="quick-start-header">
          <h2>Welcome to Moonterm</h2>
          <p className="quick-start-subtitle">A powerful terminal aggregator for developers</p>
        </div>

        <div className="quick-start-content">
          <section className="quick-start-section">
            <h3>Getting Started</h3>
            <div className="quick-start-steps">
              <div className="step">
                <span className="step-number">1</span>
                <div className="step-content">
                  <strong>Add Workspace</strong>
                  <p>Click "+" in sidebar to select a project folder</p>
                </div>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <div className="step-content">
                  <strong>Open Terminal</strong>
                  <p>Press <kbd>Cmd+T</kbd> to open a new terminal tab</p>
                </div>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <div className="step-content">
                  <strong>Split View</strong>
                  <p>Press <kbd>Cmd+D</kbd> to split terminal horizontally</p>
                </div>
              </div>
            </div>
          </section>

          <section className="quick-start-section">
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-grid">
              <div className="shortcut-group">
                <h4>Terminal</h4>
                <div className="shortcut-row">
                  <kbd>Cmd+T</kbd>
                  <span>New tab</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Cmd+W</kbd>
                  <span>Close tab</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Cmd+F</kbd>
                  <span>Search in terminal</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Right-click</kbd>
                  <span>Context menu</span>
                </div>
              </div>
              <div className="shortcut-group">
                <h4>Navigation & Split</h4>
                <div className="shortcut-row">
                  <kbd>Cmd+D</kbd>
                  <span>Split horizontal</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Cmd+Shift+D</kbd>
                  <span>Split vertical</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Cmd+1-9</kbd>
                  <span>Switch tab</span>
                </div>
                <div className="shortcut-row">
                  <kbd>Ctrl+1-9</kbd>
                  <span>Switch workspace</span>
                </div>
              </div>
            </div>
          </section>

          <section className="quick-start-section features-section">
            <h3>Key Features</h3>
            <div className="features-grid">
              <div className="feature">
                <span className="feature-icon">🔒</span>
                <span>Workspace encryption</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🌍</span>
                <span>ENV vars per workspace</span>
              </div>
              <div className="feature">
                <span className="feature-icon">🔍</span>
                <span>Terminal search</span>
              </div>
              <div className="feature">
                <span className="feature-icon">📋</span>
                <span>Drag to reorder tabs</span>
              </div>
            </div>
          </section>
        </div>

        <div className="quick-start-footer">
          {isFirstLaunch && (
            <label className="dont-show-again">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
              />
              Don't show on startup
            </label>
          )}
          <button className="dialog-btn confirm" onClick={handleClose}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
