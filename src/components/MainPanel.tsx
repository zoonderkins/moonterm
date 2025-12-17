import type { TerminalInstance } from '../types'
import { TerminalPanel } from './TerminalPanel'

interface MainPanelProps {
  terminal: TerminalInstance
  onClose: (id: string) => void
  onRestart: (id: string) => void
}

export function MainPanel({ terminal, onClose, onRestart }: MainPanelProps) {
  return (
    <div className="main-panel">
      <div className="main-panel-header">
        <div className="main-panel-title">
          <span>{terminal.title}</span>
        </div>
        <div className="main-panel-actions">
          <button
            className="action-btn"
            onClick={() => onRestart(terminal.id)}
            title="Restart terminal"
          >
            ⟳
          </button>
          <button
            className="action-btn danger"
            onClick={() => onClose(terminal.id)}
            title="Close terminal"
          >
            ×
          </button>
        </div>
      </div>
      <div className="main-panel-content">
        <TerminalPanel terminalId={terminal.id} isActive={true} />
      </div>
    </div>
  )
}
