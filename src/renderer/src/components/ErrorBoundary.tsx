/**
 * ErrorBoundary
 *
 * Without this, a single throw during render unmounts the whole React tree and
 * the operator is left staring at an empty window mid-flight with no idea why.
 * Here they get the error text and a reload button, and the failure is written
 * to the main-process log.
 *
 * NOTE — deliberate exception to the "함수형 컴포넌트만 사용" rule in
 * .claude/CLAUDE.md: React exposes error boundaries only through the class
 * lifecycle (getDerivedStateFromError / componentDidCatch). There is no hook
 * equivalent, and the alternative would be adding a new dependency.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  componentStack: string | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? null
    this.setState({ componentStack })
    window.mavlink?.reportRendererError({
      kind: 'react-render',
      message: `${error.name}: ${error.message}`,
      stack: error.stack ?? null,
      source: componentStack
    })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#181C14',
          color: '#ECDFCC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 9999
        }}
      >
        <div
          style={{
            background: '#3C3D37',
            border: '1px solid #ECDFCC',
            maxWidth: '760px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.08em'
            }}
          >
            RENDERER ERROR
          </div>

          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '11px',
              opacity: 0.8
            }}
          >
            UI가 중단되었습니다. 링크와 텔레메트리는 영향받지 않습니다. 아래 내용은
            gcs-crash.log 에도 기록되었습니다.
          </div>

          <pre
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
              maxHeight: '40vh',
              overflow: 'auto',
              background: '#181C14',
              padding: '12px'
            }}
          >
            {`${error.name}: ${error.message}\n${error.stack ?? ''}${
              componentStack ? `\n--- component stack ---${componentStack}` : ''
            }`}
          </pre>

          <button
            type="button"
            onClick={this.handleReload}
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              background: '#181C14',
              color: '#ECDFCC',
              border: '1px solid #ECDFCC',
              padding: '8px 16px',
              cursor: 'pointer',
              alignSelf: 'flex-start'
            }}
          >
            RELOAD UI
          </button>
        </div>
      </div>
    )
  }
}
