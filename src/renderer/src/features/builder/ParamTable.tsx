/**
 * ParamTable — Mission-Planner-style "전체 매개변수 목록" view sourced directly
 * from the board's 34-entry PARAM_VALUE stream: a left category tree filters a
 * right-hand table with 명령/값/Default/단위/옵션/설명 columns.
 *
 * Grouping (tree nodes) is by the board's own index ranges (params_table.h
 * send order, see GCS_수정사항.md §5-2 A~H) rather than by name, so it stays
 * correct even when a name doesn't match any PX4 convention. Range (옵션) and
 * description (설명) are static lookups sourced from the same doc — the board
 * doesn't transmit either over MAVLink, only id/value/type/index.
 *
 * Strictly the three GCS design tokens (#181C14 / #3C3D37 / #ECDFCC) — state
 * (changed / armed / applying / selected) is shown through brightness and
 * copy, never hue.
 */
import { useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { useBuilderStore } from '@renderer/store/builderStore'
import { useTelemetryStore } from '@renderer/store/telemetryStore'
import type { ParamEntry } from '@renderer/types'
import { CREAM } from '@renderer/components/test/testStyles'

const mono = "'JetBrains Mono', monospace"
const sans = "'Space Grotesk', sans-serif"

interface IndexGroup {
  label: string
  lo: number
  hi: number
}

// Mirrors the board's params_table.h send order (GCS_수정사항.md §5-2 A~H).
const INDEX_GROUPS: IndexGroup[] = [
  { label: '자동비행 자세율', lo: 0, hi: 11 },
  { label: '자동비행 자세각', lo: 12, hi: 14 },
  { label: '자동비행 수평속도', lo: 15, hi: 22 },
  { label: '자동비행 수평위치', lo: 23, hi: 24 },
  { label: '자동비행 고도', lo: 25, hi: 29 },
  { label: '속도·한계', lo: 30, hi: 33 }
]
const OTHER_GROUP_LABEL = '기타'

// GCS_수정사항.md §5-2 A~H 그룹 의미를 이름별로 풀어쓴 설명. 표의 정본은 여전히
// 보드의 params_table.h — 여기는 사람이 읽기 위한 보조 텍스트일 뿐이다.
const PARAM_DESCRIPTIONS: Record<string, string> = {
  // A. 자동비행 자세율
  MC_ROLLRATE_P: '롤 각속도 제어 비례(P) 게인',
  MC_ROLLRATE_I: '롤 각속도 제어 적분(I) 게인',
  MC_ROLLRATE_D: '롤 각속도 제어 미분(D) 게인',
  MC_ROLLRATE_N: '롤 각속도 D항 필터 계수',
  MC_PITCHRATE_P: '피치 각속도 제어 비례(P) 게인',
  MC_PITCHRATE_I: '피치 각속도 제어 적분(I) 게인',
  MC_PITCHRATE_D: '피치 각속도 제어 미분(D) 게인',
  MC_PITCHRATE_N: '피치 각속도 D항 필터 계수',
  MC_YAWRATE_P: '요 각속도 제어 비례(P) 게인',
  MC_YAWRATE_I: '요 각속도 제어 적분(I) 게인',
  MC_YAWRATE_D: '요 각속도 제어 미분(D) 게인',
  MC_YAWRATE_N: '요 각속도 D항 필터 계수',
  // B. 자동비행 자세각
  MC_ROLL_P: '롤 자세각 제어 게인 (목표 롤 각속도 산출)',
  MC_PITCH_P: '피치 자세각 제어 게인 (목표 피치 각속도 산출)',
  MC_YAW_P: '요 자세각 제어 게인 (목표 요 각속도 산출)',
  // C. 자동비행 수평속도
  MPC_VELX_P: 'X축(전후) 속도 제어 비례(P) 게인',
  MPC_VELX_I: 'X축(전후) 속도 제어 적분(I) 게인',
  MPC_VELX_D: 'X축(전후) 속도 제어 미분(D) 게인',
  MPC_VELX_N: 'X축 속도 D항 필터 계수',
  MPC_VELY_P: 'Y축(좌우) 속도 제어 비례(P) 게인',
  MPC_VELY_I: 'Y축(좌우) 속도 제어 적분(I) 게인',
  MPC_VELY_D: 'Y축(좌우) 속도 제어 미분(D) 게인',
  MPC_VELY_N: 'Y축 속도 D항 필터 계수',
  // D. 자동비행 수평위치
  MPC_POSX_P: 'X축 위치 제어 게인 (목표 X 속도 산출)',
  MPC_POSY_P: 'Y축 위치 제어 게인 (목표 Y 속도 산출)',
  // E. 자동비행 고도
  MPC_POSZ_P: '고도(Z) 위치 제어 게인 (목표 수직 속도 산출)',
  MPC_VELZ_P: '수직 속도 제어 비례(P) 게인',
  MPC_VELZ_I: '수직 속도 제어 적분(I) 게인',
  MPC_VELZ_D: '수직 속도 제어 미분(D) 게인',
  MPC_VELZ_N: '수직 속도 D항 필터 계수',
  // H. 속도·한계
  MPC_VEL_MAX: '미션 순항 수평 속도 지령값',
  MPC_Z_VEL_MAX: '최대 상승률',
  MPC_Z_VEL_MIN: '최대 하강률 (음수값)',
  FW_CRUISE_SPD: '고정익 모드 순항 속도'
}

// Board-enforced clamp range per parameter (GCS_수정사항.md §5-2). Shown in the
// 옵션 column, mirroring how Mission Planner shows "min max" there for
// non-enum numeric params — our 58 are all REAL32 gains/limits, no enums.
const PARAM_RANGES: Record<string, [number, number]> = {
  MC_ROLLRATE_P: [0, 1],
  MC_ROLLRATE_I: [0, 1],
  MC_ROLLRATE_D: [0, 0.05],
  MC_ROLLRATE_N: [1, 500],
  MC_PITCHRATE_P: [0, 1],
  MC_PITCHRATE_I: [0, 1],
  MC_PITCHRATE_D: [0, 0.05],
  MC_PITCHRATE_N: [1, 500],
  MC_YAWRATE_P: [0, 2],
  MC_YAWRATE_I: [0, 1],
  MC_YAWRATE_D: [0, 0.05],
  MC_YAWRATE_N: [1, 500],
  MC_ROLL_P: [0, 20],
  MC_PITCH_P: [0, 20],
  MC_YAW_P: [0, 20],
  MPC_VELX_P: [0, 10],
  MPC_VELX_I: [0, 10],
  MPC_VELX_D: [0, 10],
  MPC_VELX_N: [1, 500],
  MPC_VELY_P: [0, 10],
  MPC_VELY_I: [0, 10],
  MPC_VELY_D: [0, 10],
  MPC_VELY_N: [1, 500],
  MPC_POSX_P: [0, 10],
  MPC_POSY_P: [0, 10],
  MPC_POSZ_P: [0, 10],
  MPC_VELZ_P: [0, 20],
  MPC_VELZ_I: [0, 10],
  MPC_VELZ_D: [0, 10],
  MPC_VELZ_N: [1, 500],
  MPC_VEL_MAX: [0.5, 20],
  MPC_Z_VEL_MAX: [0.5, 10],
  MPC_Z_VEL_MIN: [-10, -0.5],
  FW_CRUISE_SPD: [5, 40]
}

// Only the params whose physical unit is unambiguous from §5-2's own wording
// ("상승률"/"하강률"/"순항 속도") get one — everything else has no declared
// unit in the source doc, so it stays blank rather than guessed.
const PARAM_UNITS: Record<string, string> = {
  MPC_VEL_MAX: 'm/s',
  MPC_Z_VEL_MAX: 'm/s',
  MPC_Z_VEL_MIN: 'm/s',
  FW_CRUISE_SPD: 'm/s'
}

function groupLabelFor(index: number): string {
  const group = INDEX_GROUPS.find((g) => index >= g.lo && index <= g.hi)
  return group?.label ?? OTHER_GROUP_LABEL
}

function formatNumber(value: number): string {
  return value
    .toPrecision(6)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '')
}

function formatRange(id: string): string {
  const range = PARAM_RANGES[id]
  if (!range) return ''
  return `${formatNumber(range[0])} ~ ${formatNumber(range[1])}`
}

const GRID_COLUMNS = '180px 150px 70px 60px 120px minmax(220px,1fr)'

export function ParamTable(): JSX.Element {
  const parameters = useBuilderStore((s) => s.parameters)
  const searchQuery = useBuilderStore((s) => s.searchQuery)
  const setSearchQuery = useBuilderStore((s) => s.setSearchQuery)
  const editingId = useBuilderStore((s) => s.editingId)
  const setEditing = useBuilderStore((s) => s.setEditing)
  const pendingEdits = useBuilderStore((s) => s.pendingEdits)
  const setPendingEdit = useBuilderStore((s) => s.setPendingEdit)
  const clearPendingEdit = useBuilderStore((s) => s.clearPendingEdit)

  // Armed check mirrors MotorTestPanel.tsx — the board itself refuses PARAM_SET
  // while armed, but the UI should never let a pilot fire off a write that's
  // guaranteed to be rejected.
  const isArmed = useTelemetryStore((s) => s.telemetry?.status.armed ?? false)

  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null) // null = 전체(All)

  // Tree counts ignore the search box — like Mission Planner, the category
  // list itself doesn't shrink while typing, only the table below it does.
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of Object.values(parameters)) {
      const label = groupLabelFor(p.index)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return counts
  }, [parameters])

  const groups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const all = Object.values(parameters)
      .filter((p) => !query || p.id.toLowerCase().includes(query))
      .filter((p) => !selectedGroup || groupLabelFor(p.index) === selectedGroup)
      .sort((a, b) => a.index - b.index)

    const byLabel = new Map<string, ParamEntry[]>()
    for (const p of all) {
      const label = groupLabelFor(p.index)
      if (!byLabel.has(label)) byLabel.set(label, [])
      byLabel.get(label)?.push(p)
    }
    const order = [...INDEX_GROUPS.map((g) => g.label), OTHER_GROUP_LABEL]
    return order
      .filter((label) => byLabel.has(label))
      .map((label) => ({ label, params: byLabel.get(label) ?? [] }))
  }, [parameters, searchQuery, selectedGroup])

  const applyEdit = async (param: ParamEntry): Promise<void> => {
    const pending = pendingEdits[param.id]
    if (pending === undefined || isArmed || !Number.isFinite(pending)) return
    setApplyingId(param.id)
    try {
      await window.mavlink?.setParam({
        id: param.id,
        value: pending,
        type: param.type,
        index: param.index
      })
      clearPendingEdit(param.id)
    } finally {
      setApplyingId(null)
      setEditing(null)
    }
  }

  const totalCount = Object.keys(parameters).length

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        top: '56px',
        display: 'flex',
        background: '#181C14'
      }}
    >
      <ParamTree
        groups={INDEX_GROUPS}
        counts={groupCounts}
        totalCount={totalCount}
        selected={selectedGroup}
        onSelect={setSelectedGroup}
      />

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '68px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search parameter name…"
            style={{
              fontFamily: mono,
              fontSize: '11px',
              color: CREAM,
              background: 'rgba(60,61,55,0.5)',
              border: '1px solid rgba(236,223,204,0.15)',
              borderRadius: '4px',
              padding: '7px 10px',
              width: '220px',
              outline: 'none'
            }}
          />
          <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(236,223,204,0.35)' }}>
            {totalCount}/34
          </span>
          {isArmed && (
            <span
              style={{
                fontFamily: mono,
                fontSize: '10px',
                color: 'rgba(236,223,204,0.75)',
                letterSpacing: '0.05em'
              }}
            >
              ARMED — 쓰기 비활성화 (디스암 후 편집)
            </span>
          )}
        </div>

        {totalCount === 0 ? (
          <div style={{ fontFamily: sans, fontSize: '12px', color: 'rgba(236,223,204,0.35)' }}>
            파라미터 없음 — Download를 눌러 기체에서 불러오세요.
          </div>
        ) : groups.length === 0 ? (
          <div style={{ fontFamily: sans, fontSize: '12px', color: 'rgba(236,223,204,0.35)' }}>
            일치하는 파라미터가 없습니다.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(236,223,204,0.55)',
                  marginBottom: '10px'
                }}
              >
                {group.label}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: GRID_COLUMNS,
                  gap: '1px',
                  background: 'rgba(236,223,204,0.06)',
                  border: '1px solid rgba(236,223,204,0.08)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <HeaderCell>명령</HeaderCell>
                <HeaderCell align="right">값</HeaderCell>
                <HeaderCell align="right">Default</HeaderCell>
                <HeaderCell>단위</HeaderCell>
                <HeaderCell>옵션</HeaderCell>
                <HeaderCell>설명</HeaderCell>

                {group.params.map((p) => {
                  const pending = pendingEdits[p.id]
                  const changed = pending !== undefined && pending !== p.value
                  return (
                    <ParamRow
                      key={p.id}
                      param={p}
                      pending={pending}
                      isEditing={editingId === p.id}
                      changed={changed}
                      isArmed={isArmed}
                      applying={applyingId === p.id}
                      onStartEdit={() => setEditing(p.id)}
                      onStopEdit={() => setEditing(null)}
                      onChangeValue={(v) => setPendingEdit(p.id, v)}
                      onRevert={() => {
                        clearPendingEdit(p.id)
                        setEditing(null)
                      }}
                      onApply={() => void applyEdit(p)}
                    />
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface ParamTreeProps {
  groups: IndexGroup[]
  counts: Map<string, number>
  totalCount: number
  selected: string | null
  onSelect: (label: string | null) => void
}

function ParamTree({
  groups,
  counts,
  totalCount,
  selected,
  onSelect
}: ParamTreeProps): JSX.Element {
  return (
    <div
      style={{
        width: '212px',
        flexShrink: 0,
        minHeight: 0,
        overflowY: 'auto',
        background: 'rgba(60,61,55,0.28)',
        borderRight: '1px solid rgba(236,223,204,0.08)',
        paddingTop: '68px',
        paddingBottom: '16px'
      }}
    >
      <TreeRow
        label="전체"
        count={totalCount}
        depth={0}
        active={selected === null}
        onClick={() => onSelect(null)}
      />
      {groups.map((g) => (
        <TreeRow
          key={g.label}
          label={g.label}
          count={counts.get(g.label) ?? 0}
          depth={1}
          active={selected === g.label}
          onClick={() => onSelect(g.label)}
        />
      ))}
    </div>
  )
}

interface TreeRowProps {
  label: string
  count: number
  depth: 0 | 1
  active: boolean
  onClick: () => void
}

function TreeRow({ label, count, depth, active, onClick }: TreeRowProps): JSX.Element {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        padding: depth === 0 ? '8px 14px' : '7px 14px 7px 28px',
        cursor: 'pointer',
        borderLeft: active ? '2px solid rgba(236,223,204,0.7)' : '2px solid transparent',
        background: active
          ? 'rgba(236,223,204,0.07)'
          : hover
            ? 'rgba(236,223,204,0.03)'
            : 'transparent'
      }}
    >
      <span
        style={{
          fontFamily: sans,
          fontSize: depth === 0 ? '11.5px' : '11px',
          fontWeight: depth === 0 ? 700 : 500,
          letterSpacing: depth === 0 ? '0.08em' : '0',
          textTransform: depth === 0 ? 'uppercase' : 'none',
          color: active ? CREAM : 'rgba(236,223,204,0.6)',
          whiteSpace: 'nowrap'
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(236,223,204,0.3)' }}>
        {count}
      </span>
    </div>
  )
}

function HeaderCell({
  children,
  align = 'left'
}: {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}): JSX.Element {
  return (
    <div
      style={{
        background: 'rgba(24,28,20,0.9)',
        padding: '6px 10px',
        fontFamily: sans,
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: 'rgba(236,223,204,0.4)',
        textAlign: align
      }}
    >
      {children}
    </div>
  )
}

interface ParamRowProps {
  param: ParamEntry
  pending: number | undefined
  isEditing: boolean
  changed: boolean
  isArmed: boolean
  applying: boolean
  onStartEdit: () => void
  onStopEdit: () => void
  onChangeValue: (value: number) => void
  onRevert: () => void
  onApply: () => void
}

function ParamRow({
  param,
  pending,
  isEditing,
  changed,
  isArmed,
  applying,
  onStartEdit,
  onStopEdit,
  onChangeValue,
  onRevert,
  onApply
}: ParamRowProps): JSX.Element {
  const cellStyle: CSSProperties = {
    background: changed ? 'rgba(236,223,204,0.05)' : '#1c2016',
    padding: '6px 10px',
    fontFamily: mono,
    fontSize: '11px',
    color: CREAM,
    display: 'flex',
    alignItems: 'center'
  }
  const dimCellStyle: CSSProperties = {
    ...cellStyle,
    color: 'rgba(236,223,204,0.4)'
  }

  return (
    <>
      <div style={cellStyle}>
        {param.id}
        {changed && (
          <span style={{ marginLeft: '6px', color: 'rgba(236,223,204,0.55)' }} title="변경됨">
            ●
          </span>
        )}
      </div>

      <div style={{ ...cellStyle, justifyContent: 'flex-end', gap: '6px' }}>
        {isEditing ? (
          <input
            autoFocus
            type="number"
            defaultValue={pending ?? param.value}
            onChange={(e) => onChangeValue(Number(e.target.value))}
            onBlur={onStopEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              else if (e.key === 'Escape') onRevert()
            }}
            style={{
              width: '80px',
              fontFamily: mono,
              fontSize: '11px',
              color: CREAM,
              background: 'rgba(60,61,55,0.6)',
              border: '1px solid rgba(236,223,204,0.3)',
              borderRadius: '3px',
              padding: '3px 6px',
              textAlign: 'right'
            }}
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            style={{
              fontFamily: mono,
              fontSize: '11px',
              color: changed ? CREAM : CREAM,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: '3px',
              padding: '3px 4px',
              cursor: 'pointer',
              textAlign: 'right'
            }}
          >
            {formatNumber(pending ?? param.value)}
          </button>
        )}
        {changed && (
          <>
            <button
              type="button"
              title={isArmed ? '디스암 후 적용 가능' : '적용'}
              disabled={isArmed || applying}
              onClick={onApply}
              style={{
                fontFamily: mono,
                fontSize: '12px',
                color: CREAM,
                background: 'transparent',
                border: 'none',
                cursor: isArmed || applying ? 'not-allowed' : 'pointer',
                opacity: isArmed || applying ? 0.35 : 1,
                padding: '0 2px'
              }}
            >
              ✓
            </button>
            <button
              type="button"
              title="되돌리기"
              onClick={onRevert}
              style={{
                fontFamily: mono,
                fontSize: '12px',
                color: 'rgba(236,223,204,0.5)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0 2px'
              }}
            >
              ↺
            </button>
          </>
        )}
      </div>

      <div style={{ ...dimCellStyle, justifyContent: 'flex-end' }} />

      <div style={dimCellStyle}>{PARAM_UNITS[param.id] ?? ''}</div>

      <div style={dimCellStyle}>{formatRange(param.id)}</div>

      <div style={{ ...dimCellStyle, fontFamily: sans, fontSize: '10.5px' }}>
        {PARAM_DESCRIPTIONS[param.id] ?? ''}
      </div>
    </>
  )
}
