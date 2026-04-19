/**
 * fbc-types.ts
 * Typed FBC metadata stored in BuildingNode.metadata.fbc
 * and WallNode.metadata.fbc (future).
 *
 * These are stored in Pascal's open `metadata` JSON field so we do not
 * need to fork the upstream @pascal-app/core package.
 */

// ─── Enumerations ────────────────────────────────────────────────────────────

export type OccupancyGroup =
  | 'A-1' | 'A-2' | 'A-3' | 'A-4' | 'A-5'  // Assembly
  | 'B'                                        // Business
  | 'E'                                        // Educational
  | 'F-1' | 'F-2'                              // Factory
  | 'H-1' | 'H-2' | 'H-3' | 'H-4' | 'H-5'   // High Hazard
  | 'I-1' | 'I-2' | 'I-3' | 'I-4'            // Institutional
  | 'M'                                        // Mercantile
  | 'R-1' | 'R-2' | 'R-3' | 'R-4'            // Residential
  | 'S-1' | 'S-2'                              // Storage
  | 'U';                                       // Utility

export type ConstructionType =
  | 'IA' | 'IB'
  | 'IIA' | 'IIB'
  | 'IIIA' | 'IIIB'
  | 'IV'
  | 'VA' | 'VB';

export type FloodZone =
  | 'X'          // Minimal flood hazard
  | 'AE'         // 1% annual chance, BFE determined
  | 'AH'         // 1% annual chance, shallow flooding
  | 'AO'         // 1% annual chance, sheet flow
  | 'A'          // 1% annual chance, no BFE
  | 'VE'         // Coastal high hazard, BFE determined
  | 'V';         // Coastal high hazard, no BFE

export type WindExposureCategory = 'B' | 'C' | 'D';

export type RiskCategory = 'I' | 'II' | 'III' | 'IV';

// ─── BuildingNode.metadata.fbc ───────────────────────────────────────────────

/**
 * FBC metadata block stored in BuildingNode.metadata.fbc
 * All fields are optional so partial updates work cleanly.
 */
export interface BuildingFbc {
  // Code classification
  occupancyGroup?: OccupancyGroup;
  constructionType?: ConstructionType;
  sprinklered?: boolean;

  // Dimensions
  grossArea?: number;          // ft²
  buildingHeight?: number;     // ft above grade
  stories?: number;            // above grade

  // Flood
  floodZone?: FloodZone;
  bfe?: number;                // Base Flood Elevation, ft NAVD88
  ffe?: number;                // Finished Floor Elevation, ft NAVD88

  // Wind
  hvhz?: boolean;              // High-Velocity Hurricane Zone
  windSpeed?: number;          // mph (ASCE 7 ultimate)
  windExposure?: WindExposureCategory;

  // Risk / jurisdiction
  riskCategory?: RiskCategory;
  county?: string;
  jurisdiction?: string;
}

// ─── WallNode.metadata.fbc (Task A2) ────────────────────────────────────────

export interface WallFbc {
  fireRating?: string;         // e.g. '1-hour', '2-hour'
  isExterior?: boolean;
  isFirewall?: boolean;
  isSmokeBarrier?: boolean;
  ulAssembly?: string;         // e.g. 'UL U305'
  insulationR?: number;        // R-value
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read the fbc block from a Pascal node's metadata JSON field.
 * Returns an empty object if not present.
 */
export function readBuildingFbc(metadata: Record<string, unknown> | null | undefined): BuildingFbc {
  if (!metadata || typeof metadata !== 'object') return {};
  const fbc = (metadata as Record<string, unknown>).fbc;
  if (!fbc || typeof fbc !== 'object') return {};
  return fbc as BuildingFbc;
}

export function readWallFbc(metadata: Record<string, unknown> | null | undefined): WallFbc {
  if (!metadata || typeof metadata !== 'object') return {};
  const fbc = (metadata as Record<string, unknown>).fbc;
  if (!fbc || typeof fbc !== 'object') return {};
  return fbc as WallFbc;
}

/**
 * Merge a partial FBC update into the existing metadata object.
 * Returns a new metadata object (does not mutate).
 */
export function mergeBuildingFbc(
  metadata: Record<string, unknown> | null | undefined,
  update: Partial<BuildingFbc>,
): Record<string, unknown> {
  const existing = readBuildingFbc(metadata);
  return {
    ...(metadata ?? {}),
    fbc: { ...existing, ...update },
  };
}

export function mergeWallFbc(
  metadata: Record<string, unknown> | null | undefined,
  update: Partial<WallFbc>,
): Record<string, unknown> {
  const existing = readWallFbc(metadata);
  return {
    ...(metadata ?? {}),
    fbc: { ...existing, ...update },
  };
}

// ─── Lee County defaults ─────────────────────────────────────────────────────

export const LEE_COUNTY_DEFAULTS: Partial<BuildingFbc> = {
  county: 'Lee',
  jurisdiction: 'Lee County',
  windSpeed: 160,
  windExposure: 'D',
  hvhz: false,
  riskCategory: 'II',
  floodZone: 'AE',
};
