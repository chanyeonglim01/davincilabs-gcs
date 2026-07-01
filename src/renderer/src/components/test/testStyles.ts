/**
 * Shared style tokens for the test-tooling panels.
 *
 * Mission-Planner-minimal, strictly the three GCS design tokens
 * (#181C14 / #3C3D37 / #ECDFCC). No accent hues. Kept separate from the
 * component file (testUi.tsx) so Fast Refresh stays happy.
 */
import type { CSSProperties } from 'react'

export const CREAM = '#ECDFCC'

export const panelShell: CSSProperties = {
  background: 'rgba(60, 61, 55, 0.45)',
  border: '1px solid rgba(236, 223, 204, 0.12)',
  borderRadius: '8px',
  padding: '24px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(12px)',
  maxWidth: '720px',
  width: '100%',
  color: CREAM
}

export const sectionLabel: CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'rgba(236, 223, 204, 0.55)',
  marginBottom: '10px'
}

/** Selectable chip (motor / duration / source). */
export function pillStyle(active: boolean, disabled: boolean): CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '8px 14px',
    minWidth: '48px',
    textAlign: 'center',
    borderRadius: '4px',
    border: `1px solid ${active ? 'rgba(236,223,204,0.55)' : 'rgba(236,223,204,0.14)'}`,
    background: active ? 'rgba(236,223,204,0.12)' : 'rgba(60,61,55,0.5)',
    color: active ? CREAM : 'rgba(236,223,204,0.5)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'all 0.15s ease',
    userSelect: 'none'
  }
}

/** Primary action — cream outline/fill (never green). */
export function primaryBtn(disabled: boolean): CSSProperties {
  return {
    flex: 1,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    padding: '12px 18px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    border: '1px solid rgba(236,223,204,0.5)',
    background: 'rgba(236,223,204,0.08)',
    color: CREAM,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s ease'
  }
}

/** Secondary action — outline only (never red). */
export const secondaryBtn: CSSProperties = {
  flex: 1,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  padding: '12px 18px',
  borderRadius: '4px',
  textTransform: 'uppercase',
  border: '1px solid rgba(236,223,204,0.2)',
  background: 'transparent',
  color: 'rgba(236,223,204,0.6)',
  cursor: 'pointer',
  transition: 'all 0.15s ease'
}
