/**
 * FBC Compliance Engine
 *
 * Runs Florida Building Code checks against a Pascal scene graph's node map.
 * This module is shared between PascalViewer.tsx and the test suite.
 *
 * All dimensions are in metres. FBC section references are for the 8th Edition (2023).
 */

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
}

export function runFBCChecks(nodes: Record<string, unknown>): FBCCheckResult {
  const violations: FBCViolation[] = [];
  let passCount = 0;

  const nodeList = Object.values(nodes) as Array<Record<string, unknown>>;

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
          message: `Door width ${(width * 39.37).toFixed(1)}" is below the 32" minimum clear width required for egress.`,
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
          message: `Door height ${(height * 39.37).toFixed(1)}" is below the 78" minimum required for egress.`,
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
      // We check minimum window dimensions as a proxy.
      if (width > 0 && width < 0.457) {
        violations.push({
          id: `${id}-window-width`,
          severity: "warning",
          code: "FBC R303.1",
          message: `Window width ${(width * 39.37).toFixed(1)}" may be insufficient for natural light/ventilation requirements.`,
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
          message: `Window height ${(height * 39.37).toFixed(1)}" may not meet emergency escape opening requirements.`,
          nodeId: id,
          nodeType: "window",
        });
      } else if (height >= 0.61) {
        passCount++;
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
          message: `Wall height ${(height * 3.281).toFixed(2)} ft is below the 7 ft minimum ceiling height for habitable rooms.`,
          nodeId: id,
          nodeType: "wall",
        });
      } else if (height >= 2.134) {
        passCount++;
      }
    }

    // ── Slab checks ──────────────────────────────────────────────────────────
    if (type === "slab") {
      const elevation = (node.elevation as number) ?? null;

      // FBC R322 — Flood hazard: lowest floor must be ≥ BFE + freeboard
      // We flag if elevation is negative (likely below grade in flood zone)
      if (elevation !== null && elevation < 0) {
        violations.push({
          id: `${id}-slab-elevation`,
          severity: "warning",
          code: "FBC R322",
          message: `Slab elevation ${elevation.toFixed(2)} m is below grade. Verify compliance with flood hazard requirements.`,
          nodeId: id,
          nodeType: "slab",
        });
      } else if (elevation !== null && elevation >= 0) {
        passCount++;
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
            message: `Roof pitch ${(pitchRatio * 12).toFixed(1)}:12 is below the 2:12 minimum for standard roofing materials.`,
            nodeId: id,
            nodeType: "roof-segment",
          });
        } else {
          passCount++;
        }
      }
    }
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
  };
}
