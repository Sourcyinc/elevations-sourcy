/**
 * FBC Compliance Engine
 *
 * Runs Florida Building Code checks against a Pascal scene graph's node map.
 * This module is shared between PascalViewer.tsx and the test suite.
 *
 * All dimensions are in metres. FBC section references are for the 8th Edition (2023).
 *
 * BuildingNode.metadata.fbc fields (typed in fbc-types.ts) are used when present
 * to provide project-specific flood/wind/occupancy context for checks.
 */

import { readBuildingFbc, type BuildingFbc } from "./fbc-types";

export interface FBCViolation {
  id: string;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  nodeId?: string;
  nodeType?: string;
}

export interface FBCCheckResult {
  violations: FBCViolation[];
  passCount: number;
  warnCount: number;
  errorCount: number;
  /** Resolved BuildingNode.fbc data used for this check run */
  buildingFbc: BuildingFbc;
}

/**
 * Extract the BuildingNode's fbc metadata from the scene node map.
 * Returns the first building node found (there is typically only one).
 */
function extractBuildingFbc(nodes: Record<string, unknown>): BuildingFbc {
  for (const node of Object.values(nodes)) {
    const n = node as Record<string, unknown>;
    if (n.type === "building") {
      const metadata = n.metadata as Record<string, unknown> | null | undefined;
      return readBuildingFbc(metadata);
    }
  }
  return {};
}

export function runFBCChecks(nodes: Record<string, unknown>): FBCCheckResult {
  const violations: FBCViolation[] = [];
  let passCount = 0;

  const nodeList = Object.values(nodes) as Array<Record<string, unknown>>;
  const buildingFbc = extractBuildingFbc(nodes);

  // Resolved flood/wind context — prefer BuildingNode.fbc, fall back to safe defaults
  const bfe = buildingFbc.bfe ?? null;
  const floodZone = buildingFbc.floodZone ?? null;
  const hvhz = buildingFbc.hvhz ?? false;
  const windSpeed = buildingFbc.windSpeed ?? null;

  for (const node of nodeList) {
    const type = node.type as string;
    const id = node.id as string;

    // ── Door checks ──────────────────────────────────────────────────────────
    if (type === "door") {
      const width = (node.width as number) ?? 0;
      const height = (node.height as number) ?? 0;

      // FBC R311.2 — Egress door minimum 32" clear width (0.813 m)
      if (width > 0 && width < 0.813) {
        violations.push({
          id: `${id}-door-width`,
          severity: "error",
          code: "FBC R311.2",
          message: `Door width ${(width * 39.37).toFixed(1)}" is below the 32" minimum clear width required for egress. Increase to at least 32" (0.813 m).`,
          nodeId: id,
          nodeType: "door",
        });
      } else if (width >= 0.813) {
        passCount++;
      }

      // FBC R311.2 — Egress door minimum 78" height (1.981 m)
      if (height > 0 && height < 1.981) {
        violations.push({
          id: `${id}-door-height`,
          severity: "error",
          code: "FBC R311.2",
          message: `Door height ${(height * 39.37).toFixed(1)}" is below the 78" minimum required for egress. Increase to at least 78" (1.981 m).`,
          nodeId: id,
          nodeType: "door",
        });
      } else if (height >= 1.981) {
        passCount++;
      }
    }

    // ── Window checks ────────────────────────────────────────────────────────
    if (type === "window") {
      const width = (node.width as number) ?? 0;
      const height = (node.height as number) ?? 0;

      // FBC R303.1 — Habitable rooms require glazing area ≥ 8% of floor area.
      if (width > 0 && width < 0.457) {
        violations.push({
          id: `${id}-window-width`,
          severity: "warning",
          code: "FBC R303.1",
          message: `Window width ${(width * 39.37).toFixed(1)}" may be insufficient for natural light/ventilation requirements (FBC R303.1).`,
          nodeId: id,
          nodeType: "window",
        });
      } else if (width >= 0.457) {
        passCount++;
      }

      // FBC R310 — Emergency escape window minimum 20" width, 24" height, 5.7 sq ft net
      if (height > 0 && height < 0.61) {
        violations.push({
          id: `${id}-window-height`,
          severity: "warning",
          code: "FBC R310",
          message: `Window height ${(height * 39.37).toFixed(1)}" may not meet emergency escape opening requirements (FBC R310). Minimum 24" height required.`,
          nodeId: id,
          nodeType: "window",
        });
      } else if (height >= 0.61) {
        passCount++;
      }

      // HVHZ — windows in HVHZ must have NOA/FL Product Approval
      if (hvhz) {
        violations.push({
          id: `${id}-window-hvhz`,
          severity: "info",
          code: "FBC 1609.4 / HVHZ",
          message: `Window in HVHZ: must have a valid NOA or FL Product Approval number. Verify impact-resistant glazing or shutters are specified.`,
          nodeId: id,
          nodeType: "window",
        });
      }
    }

    // ── Wall checks ──────────────────────────────────────────────────────────
    if (type === "wall") {
      const height = (node.height as number) ?? 0;

      // FBC R305.1 — Habitable room ceiling height minimum 7 ft (2.134 m)
      if (height > 0 && height < 2.134) {
        violations.push({
          id: `${id}-wall-height`,
          severity: "warning",
          code: "FBC R305.1",
          message: `Wall height ${(height * 3.281).toFixed(2)} ft is below the 7 ft minimum ceiling height for habitable rooms (FBC R305.1).`,
          nodeId: id,
          nodeType: "wall",
        });
      } else if (height >= 2.134) {
        passCount++;
      }
    }

    // ── Slab checks ──────────────────────────────────────────────────────────
    if (type === "slab") {
      const elevationM = (node.elevation as number) ?? null;

      if (elevationM !== null) {
        const elevationFt = elevationM * 3.281;

        // FBC R322 — Flood hazard: lowest floor must be ≥ BFE + freeboard
        if (bfe !== null) {
          const freeboard = (floodZone === "VE" || floodZone === "V") ? 1.0 : 0.0;
          const requiredFt = bfe + freeboard;
          if (elevationFt < requiredFt) {
            violations.push({
              id: `${id}-slab-bfe`,
              severity: "error",
              code: "FBC R322",
              message: `Slab elevation ${elevationFt.toFixed(2)} ft NAVD88 is below the required ${requiredFt.toFixed(2)} ft (BFE ${bfe} ft${freeboard > 0 ? ` + ${freeboard} ft V-zone freeboard` : ""}). FBC R322 requires lowest floor at or above BFE.`,
              nodeId: id,
              nodeType: "slab",
            });
          } else {
            passCount++;
          }
        } else if (elevationM < 0) {
          // No BFE set — flag negative elevation as a warning
          violations.push({
            id: `${id}-slab-elevation`,
            severity: "warning",
            code: "FBC R322",
            message: `Slab elevation ${elevationFt.toFixed(2)} ft is below grade. Set the BFE in Building Properties to verify flood compliance (FBC R322).`,
            nodeId: id,
            nodeType: "slab",
          });
        } else {
          passCount++;
        }
      }
    }

    // ── Roof-segment checks ──────────────────────────────────────────────────
    if (type === "roof-segment") {
      const wallHeight = (node.wallHeight as number) ?? 0;
      const roofHeight = (node.roofHeight as number) ?? 0;

      // FBC R802 — Roof pitch: minimum 2:12 slope for asphalt shingles
      if (wallHeight > 0 && roofHeight > 0) {
        const pitchRatio = roofHeight / (wallHeight / 2);
        if (pitchRatio < 2 / 12) {
          violations.push({
            id: `${id}-roof-pitch`,
            severity: "warning",
            code: "FBC R802",
            message: `Roof pitch ${(pitchRatio * 12).toFixed(1)}:12 is below the 2:12 minimum for standard roofing materials (FBC R802).`,
            nodeId: id,
            nodeType: "roof-segment",
          });
        } else {
          passCount++;
        }
      }

      // HVHZ — roofing in HVHZ must have NOA
      if (hvhz && wallHeight > 0) {
        violations.push({
          id: `${id}-roof-hvhz`,
          severity: "info",
          code: "FBC 1609.4 / HVHZ",
          message: `Roof in HVHZ: roofing system must have a valid NOA (Miami-Dade or Broward County Product Approval). Verify with manufacturer.`,
          nodeId: id,
          nodeType: "roof-segment",
        });
      }
    }
  }

  // ── Building-level checks (from BuildingNode.fbc) ────────────────────────
  if (windSpeed !== null) {
    // FBC 1609.3 — Wind exposure category required for design
    if (!buildingFbc.windExposure) {
      violations.push({
        id: "building-wind-exposure",
        severity: "warning",
        code: "FBC 1609.3",
        message: `Wind exposure category is not set. Set Exposure B, C, or D in Building Properties to complete the wind load design (FBC 1609.3).`,
      });
    } else {
      passCount++;
    }

    // FBC 1609.4 — Wind-borne debris region (≥ 130 mph within 1 mile of coast)
    if (windSpeed >= 130) {
      violations.push({
        id: "building-wind-debris",
        severity: "info",
        code: "FBC 1609.4",
        message: `Wind speed ${windSpeed} mph places this building in a wind-borne debris region. All openings require impact-resistant products or shutters (FBC 1609.4).`,
      });
    }
  }

  if (hvhz) {
    violations.push({
      id: "building-hvhz-note",
      severity: "info",
      code: "FBC 1609.4 / HVHZ",
      message: `HVHZ applies. All products (windows, doors, roofing) must carry a current Miami-Dade NOA or FL Product Approval. Include the NOA note block on all drawings.`,
    });
  }

  // If no nodes of relevant types, add an info notice
  const hasRelevantNodes = nodeList.some((n) =>
    ["door", "window", "wall", "slab", "roof-segment"].includes(n.type as string)
  );
  if (!hasRelevantNodes) {
    violations.push({
      id: "no-nodes",
      severity: "info",
      code: "INFO",
      message: "Add walls, doors, windows, slabs, or roof segments to run FBC compliance checks.",
    });
  }

  return {
    violations,
    passCount,
    warnCount: violations.filter((v) => v.severity === "warning").length,
    errorCount: violations.filter((v) => v.severity === "error").length,
    buildingFbc,
  };
}
