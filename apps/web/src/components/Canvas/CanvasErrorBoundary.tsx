import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleReset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          color: '#ef4444', background: '#080818',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Canvas error</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 400, textAlign: 'center', fontFamily: 'monospace' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 8, padding: '7px 20px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              border: '1px solid #3b82f6', background: '#1e40af', color: '#e2e8f0',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
