/**
 * ConfirmModal
 *
 * Shared confirmation modal extracted from the CommandsPanel inline dialog so
 * every command/test surface confirms the same way. Pixel-identical to the
 * original: overlay rgba(24,28,20,0.7)+blur4, card #1e2218 / 0.2 border /
 * radius6 / width260, "CONFIRM" header + big label + CANCEL/EXECUTE.
 *
 * `message` is an optional prose slot (e.g. safety warnings) shown under the
 * label; commands that only need a name omit it.
 */
interface ConfirmModalProps {
  open: boolean
  label: string
  message?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  label,
  message,
  confirmText = 'EXECUTE',
  cancelText = 'CANCEL',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmModalProps): React.JSX.Element | null {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(24, 28, 20, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 100
      }}
      onClick={() => !loading && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1e2218',
          border: '1px solid rgba(236, 223, 204, 0.2)',
          borderRadius: '6px',
          padding: '20px 24px',
          width: '260px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)'
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(236, 223, 204, 0.45)',
            marginBottom: '8px'
          }}
        >
          CONFIRM
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '20px',
            fontWeight: 700,
            color: '#ECDFCC',
            marginBottom: message ? '10px' : '16px'
          }}
        >
          {label}
        </div>
        {message && (
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'rgba(236, 223, 204, 0.7)',
              marginBottom: '16px',
              whiteSpace: 'pre-line'
            }}
          >
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 600,
              padding: '9px',
              border: '1px solid rgba(236, 223, 204, 0.15)',
              borderRadius: '3px',
              background: 'transparent',
              color: 'rgba(236, 223, 204, 0.5)',
              cursor: 'pointer',
              textTransform: 'uppercase'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              fontWeight: 700,
              padding: '9px',
              border: '1px solid rgba(236, 223, 204, 0.5)',
              borderRadius: '3px',
              background: 'rgba(236, 223, 204, 0.08)',
              color: '#ECDFCC',
              cursor: loading ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase'
            }}
          >
            {loading ? '...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
