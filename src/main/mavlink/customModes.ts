/**
 * UAM Custom Flight Mode Mapping
 *
 * UAM 모델은 PX4가 아닌 자체 비행제어. MAVLink v2 wire 포맷은 표준 그대로 쓰지만
 * mode 시맨틱은 커스텀이다.
 *
 * HEARTBEAT custom_mode (uint32) 비트 레이아웃 (단일 진실 소스):
 *   bits  0..7  : flight_mode  (0=Manual, 1=Auto, 2=Emergency)
 *   bits  8..15 : flight_state (0=Hover, 1=Transition, 2=FixedWing, 3=BackTransition)
 *   bits 16..23 : sub_state    (Auto: 0=IDLE / 1=TAKEOFF / 2=MISSION / 3=LAND / 4=RTL / 5=HOLD)
 *   bits 24..31 : reserved (0)
 *
 * 시뮬링크 모델 측 enum 값은 ASCII '0'/'1'/'2' (= 48/49/50) 이지만
 * wire 포맷은 0-base 인덱스를 사용한다. 모델/시뮬링크 측에서 +48 변환.
 */

export enum FlightMode {
  Manual = 0,
  Auto = 1,
  Emergency = 2
}

export enum FlightState {
  Hover = 0,
  Transition = 1,
  FixedWing = 2,
  BackTransition = 3
}

export enum AutoSubState {
  IDLE = 0,
  TAKEOFF = 1,
  MISSION = 2,
  LAND = 3,
  RTL = 4,
  HOLD = 5
}

export interface DecodedMode {
  flightMode: FlightMode
  flightState: FlightState
  subState: number
}

/**
 * HEARTBEAT custom_mode (uint32) → 모드 분해
 */
export function decodeCustomMode(customMode: number): DecodedMode {
  return {
    flightMode: (customMode & 0xff) as FlightMode,
    flightState: ((customMode >> 8) & 0xff) as FlightState,
    subState: (customMode >> 16) & 0xff
  }
}

/**
 * 모드 → HEARTBEAT custom_mode (uint32)
 */
export function encodeCustomMode(
  flightMode: FlightMode,
  flightState: FlightState = FlightState.Hover,
  subState: number = 0
): number {
  return ((flightMode & 0xff) >>> 0) | ((flightState & 0xff) << 8) | ((subState & 0xff) << 16)
}

/**
 * GCS 표시용 모드 라벨 — plan.md §1.5 표 기반
 */
export function formatModeLabel(decoded: DecodedMode): string {
  const { flightMode, flightState, subState } = decoded

  if (flightMode === FlightMode.Emergency) {
    return 'EMERGENCY'
  }

  if (flightMode === FlightMode.Manual) {
    if (flightState === FlightState.FixedWing) return 'MANUAL/FW'
    if (flightState === FlightState.Transition) return 'MANUAL/TRANS'
    if (flightState === FlightState.BackTransition) return 'MANUAL/BACK'
    return 'MANUAL/HOVER'
  }

  // Auto
  if (flightState === FlightState.Transition) return 'AUTO.TRANS'
  if (flightState === FlightState.BackTransition) return 'AUTO.BACK_TRANS'

  switch (subState as AutoSubState) {
    case AutoSubState.TAKEOFF:
      return 'AUTO.TAKEOFF'
    case AutoSubState.MISSION:
      return flightState === FlightState.FixedWing ? 'AUTO.MISSION' : 'AUTO.HOVER'
    case AutoSubState.LAND:
      return 'AUTO.LAND'
    case AutoSubState.RTL:
      return 'AUTO.RTL'
    case AutoSubState.HOLD:
      return 'AUTO.HOLD'
    default:
      return flightState === FlightState.FixedWing ? 'AUTO/FW' : 'AUTO/HOVER'
  }
}

/**
 * GCS 측 mode 문자열 (UI에서 선택) → custom_mode uint32
 *
 * SET_MODE COMMAND_LONG의 param2 (float)에 들어갈 값을 만들 때 사용.
 * float32 24-bit mantissa 안에 들어가는 작은 비트 패턴이라 안전.
 */
export const MODE_NAME_TO_CUSTOM: Record<string, number> = {
  MANUAL: encodeCustomMode(FlightMode.Manual, FlightState.Hover, AutoSubState.IDLE),
  'MANUAL/FW': encodeCustomMode(FlightMode.Manual, FlightState.FixedWing, AutoSubState.IDLE),
  AUTO: encodeCustomMode(FlightMode.Auto, FlightState.Hover, AutoSubState.IDLE),
  'AUTO.TAKEOFF': encodeCustomMode(FlightMode.Auto, FlightState.Hover, AutoSubState.TAKEOFF),
  'AUTO.MISSION': encodeCustomMode(FlightMode.Auto, FlightState.FixedWing, AutoSubState.MISSION),
  'AUTO.LAND': encodeCustomMode(FlightMode.Auto, FlightState.Hover, AutoSubState.LAND),
  'AUTO.RTL': encodeCustomMode(FlightMode.Auto, FlightState.FixedWing, AutoSubState.RTL),
  'AUTO.HOLD': encodeCustomMode(FlightMode.Auto, FlightState.FixedWing, AutoSubState.HOLD),
  EMERGENCY: encodeCustomMode(FlightMode.Emergency, FlightState.Hover, AutoSubState.IDLE)
}

/**
 * mode name → COMMAND_LONG.param2 (float)
 *
 * float32에 reinterpret 하기 위해 Uint32 view로 변환.
 * MAVLink param2는 float field지만, 작은 정수 비트 패턴은 정밀도 손실 없이 통과.
 */
export function modeNameToParam2(modeName: string): number {
  const customMode = MODE_NAME_TO_CUSTOM[modeName] ?? MODE_NAME_TO_CUSTOM['AUTO.MISSION']
  return customMode
}
