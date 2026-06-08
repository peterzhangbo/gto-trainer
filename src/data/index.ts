import utgData from '@/data/preflop/rfi/utg.json';
import mpData from '@/data/preflop/rfi/mp.json';
import coData from '@/data/preflop/rfi/co.json';
import btnData from '@/data/preflop/rfi/btn.json';
import sbData from '@/data/preflop/rfi/sb.json';
import btnVsCoData from '@/data/preflop/threebet/btn_vs_co.json';
import sbVsBtnData from '@/data/preflop/threebet/sb_vs_btn.json';
import bbVsCoThreebetData from '@/data/preflop/threebet/bb_vs_co.json';
import sbVsCoThreebetData from '@/data/preflop/threebet/sb_vs_co.json';
import bbVsBtnData from '@/data/preflop/defend/bb_vs_btn.json';
import bbVsCoDefendData from '@/data/preflop/defend/bb_vs_co.json';
import bbVsUtgDefendData from '@/data/preflop/defend/bb_vs_utg.json';
import sbOpenVsBbData from '@/data/preflop/defend/sb_open_vs_bb.json';
import bbDefendVsSbData from '@/data/preflop/defend/bb_defend_vs_sb.json';
import btn40bbData from '@/data/preflop/rfi/btn_40bb.json';
import co40bbData from '@/data/preflop/rfi/co_40bb.json';
import dryHighData from '@/data/postflop/c-bet/dry-high.json';
import wetConnectedData from '@/data/postflop/c-bet/wet-connected.json';
import pairedData from '@/data/postflop/c-bet/paired.json';
import monochromeData from '@/data/postflop/c-bet/monochrome.json';
import brickTurnData from '@/data/postflop/turn/brick-turn.json';
import flushCompletingTurnData from '@/data/postflop/turn/flush-completing.json';
import straightCompletingTurnData from '@/data/postflop/turn/straight-completing.json';
import overcardTurnData from '@/data/postflop/turn/overcard-turn.json';
import pairedTurnData from '@/data/postflop/turn/paired-turn.json';
import secondBarrelData from '@/data/postflop/turn/second-barrel.json';
import blankRiverData from '@/data/postflop/river/blank-river.json';
import scaryRiverData from '@/data/postflop/river/scary-river.json';
import pairedRiverData from '@/data/postflop/river/paired-river.json';
import valueBetRiverData from '@/data/postflop/river/value-bet.json';
import bluffCatchRiverData from '@/data/postflop/river/bluff-catch.json';
import ccMpVsUtgData from '@/data/preflop/coldcall/mp_vs_utg.json';
import ccCoVsUtgData from '@/data/preflop/coldcall/co_vs_utg.json';
import ccCoVsMpData from '@/data/preflop/coldcall/co_vs_mp.json';
import ccBtnVsUtgData from '@/data/preflop/coldcall/btn_vs_utg.json';
import ccBtnVsCoData from '@/data/preflop/coldcall/btn_vs_co.json';
import sqBtnVsCoOpenMpCallData from '@/data/preflop/squeeze/btn_squeeze_vs_co_open_mp_call.json';
import sqSbVsCoOpenBtnCallData from '@/data/preflop/squeeze/sb_squeeze_vs_co_open_btn_call.json';
import sqBbVsCoOpenBtnCallData from '@/data/preflop/squeeze/bb_squeeze_vs_co_open_btn_call.json';
import multiwayCoVsUtgMpData from '@/data/preflop/multiway/co_call_vs_utg_open_mp_call.json';
import multiwayBtnVsUtgCoData from '@/data/preflop/multiway/btn_call_vs_utg_open_co_call.json';
import metadataJson from '@/data/metadata.json';

// ---------------------------------------------------------------------------
// Inline types (avoid circular imports with @/types/*)
// ---------------------------------------------------------------------------

export interface HandFrequencies {
  raise?: number;
  fold?: number;
  call?: number;
  threeBet?: number;
  [action: string]: number | undefined;
}

export interface PreflopScenarioData {
  scenario: string;
  position?: string;
  heroPosition?: string;
  villainPosition?: string;
  stackDepth: number;
  ante: boolean;
  hands: Record<string, HandFrequencies>;
}

export interface PostflopStrategyEntry {
  [action: string]: number;
}

export interface PostflopScenarioData {
  scenario: string;
  boardTexture?: string;
  turnType?: string;
  riverType?: string;
  previousAction?: string;
  exampleBoard: string[];
  position: string;
  stackDepth: number;
  potType: string;
  strategy: Record<string, PostflopStrategyEntry>;
  handClassification?: Record<string, string[]>;
}

export type ScenarioData = PreflopScenarioData | PostflopScenarioData;

export interface ScenarioMeta {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  position?: string;
  villainPosition?: string;
  boardTexture?: string;
  exampleBoard?: string[];
  description: string;
  filePath: string;
  openerPosition?: string;
  callerPosition?: string;
}

export interface MetadataIndex {
  scenarios: ScenarioMeta[];
}

// ---------------------------------------------------------------------------
// Data Registry – keyed by scenario id
// ---------------------------------------------------------------------------

export const DATA_REGISTRY: Record<string, ScenarioData> = {
  rfi_utg: utgData as unknown as ScenarioData,
  rfi_mp: mpData as unknown as ScenarioData,
  rfi_co: coData as unknown as ScenarioData,
  rfi_btn: btnData as unknown as ScenarioData,
  rfi_sb: sbData as unknown as ScenarioData,
  threebet_btn_vs_co: btnVsCoData as unknown as ScenarioData,
  threebet_sb_vs_btn: sbVsBtnData as unknown as ScenarioData,
  threebet_bb_vs_co: bbVsCoThreebetData as unknown as ScenarioData,
  threebet_sb_vs_co: sbVsCoThreebetData as unknown as ScenarioData,
  defend_bb_vs_btn: bbVsBtnData as unknown as ScenarioData,
  defend_bb_vs_co: bbVsCoDefendData as unknown as ScenarioData,
  defend_bb_vs_utg: bbVsUtgDefendData as unknown as ScenarioData,
  defend_sb_vs_bb: sbOpenVsBbData as unknown as ScenarioData,
  defend_bb_vs_sb: bbDefendVsSbData as unknown as ScenarioData,
  rfi_btn_40bb: btn40bbData as unknown as ScenarioData,
  rfi_co_40bb: co40bbData as unknown as ScenarioData,
  cbet_dry_high: dryHighData as unknown as ScenarioData,
  cbet_wet_connected: wetConnectedData as unknown as ScenarioData,
  cbet_paired: pairedData as unknown as ScenarioData,
  cbet_monochrome: monochromeData as unknown as ScenarioData,
  turn_brick: brickTurnData as unknown as ScenarioData,
  turn_flush_completing: flushCompletingTurnData as unknown as ScenarioData,
  turn_straight_completing: straightCompletingTurnData as unknown as ScenarioData,
  turn_overcard: overcardTurnData as unknown as ScenarioData,
  river_blank: blankRiverData as unknown as ScenarioData,
  river_scary: scaryRiverData as unknown as ScenarioData,
  river_paired: pairedRiverData as unknown as ScenarioData,
  turn_paired: pairedTurnData as unknown as ScenarioData,
  turn_second_barrel: secondBarrelData as unknown as ScenarioData,
  river_value_bet: valueBetRiverData as unknown as ScenarioData,
  river_bluff_catch: bluffCatchRiverData as unknown as ScenarioData,
  coldcall_mp_vs_utg: ccMpVsUtgData as unknown as ScenarioData,
  coldcall_co_vs_utg: ccCoVsUtgData as unknown as ScenarioData,
  coldcall_co_vs_mp: ccCoVsMpData as unknown as ScenarioData,
  coldcall_btn_vs_utg: ccBtnVsUtgData as unknown as ScenarioData,
  coldcall_btn_vs_co: ccBtnVsCoData as unknown as ScenarioData,
  squeeze_btn_vs_co_open_mp_call: sqBtnVsCoOpenMpCallData as unknown as ScenarioData,
  squeeze_sb_vs_co_open_btn_call: sqSbVsCoOpenBtnCallData as unknown as ScenarioData,
  squeeze_bb_vs_co_open_btn_call: sqBbVsCoOpenBtnCallData as unknown as ScenarioData,
  multiway_co_vs_utg_mp: multiwayCoVsUtgMpData as unknown as ScenarioData,
  multiway_btn_vs_utg_co: multiwayBtnVsUtgCoData as unknown as ScenarioData,
};

const METADATA: MetadataIndex = metadataJson as unknown as MetadataIndex;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize scenario type strings to canonical casing.
 * Maps '3bet' -> 'threeBet', 'threebet' -> 'threeBet' for backward compatibility.
 */
export function normalizeScenarioType(type: string): string {
  if (type === '3bet' || type === 'threebet') return 'threeBet'
  return type
}

function isPreflop(data: ScenarioData): data is PreflopScenarioData {
  return 'hands' in data;
}

function isPostflop(data: ScenarioData): data is PostflopScenarioData {
  return 'strategy' in data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScenarioQuery {
  scenarioType: string; // "rfi" | "threeBet" | "defend" | "c-bet" | "coldcall" | "squeeze"
  position?: string;
  villainPosition?: string;
  boardTexture?: string;
  openerPosition?: string;
  callerPosition?: string;
}

/**
 * Resolve a scenario key from query params.
 * Tries to match against the metadata id or build the id from components.
 */
function resolveScenarioKey(params: ScenarioQuery): string | null {
  // Normalize scenarioType to handle casing inconsistencies (e.g. '3bet' -> 'threeBet')
  const normalizedType = normalizeScenarioType(params.scenarioType)

  // Direct match on scenarioType if it's already a full key
  if (DATA_REGISTRY[normalizedType]) {
    return normalizedType;
  }

  // Build a key from parts
  const parts: string[] = [normalizedType];
  if (params.position) parts.push(params.position.toLowerCase());
  if (params.villainPosition) parts.push(`vs_${params.villainPosition.toLowerCase()}`);
  if (params.boardTexture) parts.push(params.boardTexture);

  const key = parts.join('_');
  if (DATA_REGISTRY[key]) return key;

  // Search metadata for a match
  const meta = METADATA.scenarios.find(
    (s) =>
      normalizeScenarioType(s.subCategory) === normalizedType &&
      (!params.position || s.position === params.position) &&
      (!params.villainPosition || s.villainPosition === params.villainPosition) &&
      (!params.boardTexture || s.boardTexture === params.boardTexture) &&
      (!params.openerPosition || s.openerPosition === params.openerPosition) &&
      (!params.callerPosition || s.callerPosition === params.callerPosition),
  );
  if (meta) {
    const id = meta.id;
    if (DATA_REGISTRY[id]) return id;
  }

  return null;
}

/**
 * Retrieve scenario data by type and optional parameters.
 * Returns null if no matching scenario is found.
 */
export function getScenarioData(params: ScenarioQuery): ScenarioData | null {
  const key = resolveScenarioKey(params);
  if (!key) return null;
  return DATA_REGISTRY[key] ?? null;
}

/**
 * Retrieve scenario data by its exact metadata id.
 */
export function getScenarioById(id: string): ScenarioData | null {
  return DATA_REGISTRY[id] ?? null;
}

/**
 * Retrieve all scenario metadata entries.
 */
export function getAllScenarios(): ScenarioMeta[] {
  return METADATA.scenarios;
}

/**
 * Get scenarios filtered by category ("preflop" | "postflop").
 */
export function getScenariosByCategory(category: string): ScenarioMeta[] {
  return METADATA.scenarios.filter((s) => s.category === category);
}

/**
 * Get scenarios filtered by subCategory ("rfi" | "threeBet" | "defend" | "c-bet").
 */
export function getScenariosBySubCategory(subCategory: string): ScenarioMeta[] {
  return METADATA.scenarios.filter((s) => s.subCategory === subCategory);
}

/**
 * Check if the given scenario data was computed by a solver.
 * Looks for a `solverMeta` field on the raw data.
 *
 * NOTE: Currently always returns false — no JSON data includes solverMeta yet.
 * Retained for future use when solver CLI output is integrated.
 */
export function isSolverComputed(data: ScenarioData): boolean {
  return !!(data as unknown as Record<string, unknown>).solverMeta;
}

/**
 * Get all available position codes for RFI scenarios.
 */
export function getRFIPositions(): string[] {
  return METADATA.scenarios
    .filter((s) => s.subCategory === 'rfi')
    .map((s) => s.position as string);
}

// Re-export for convenience (MetadataIndex and ScenarioMeta already exported above)
export { isPreflop, isPostflop };
