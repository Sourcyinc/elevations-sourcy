import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the database helpers ────────────────────────────────────────────────
vi.mock("./db", () => ({
  getBimSceneByProject: vi.fn(),
  upsertBimScene: vi.fn(),
}));

// ─── Mock S3 storage ──────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/bim-scenes/1/scene.json", key: "bim-scenes/1/scene.json" }),
}));

// ─── Import the real FBC engine from the shared module ───────────────────────
// This ensures the tests exercise the exact same code used by PascalViewer.tsx
import { runFBCChecks } from "../client/src/lib/fbc-engine";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FBC Compliance Engine", () => {
  it("returns info violation when no relevant nodes are present", () => {
    const result = runFBCChecks({});
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].severity).toBe("info");
    expect(result.violations[0].code).toBe("INFO");
  });

  it("flags a door that is too narrow (FBC R311.2)", () => {
    const nodes = {
      door1: { id: "door1", type: "door", width: 0.7, height: 2.1 },
    };
    const result = runFBCChecks(nodes);
    const doorWidthViolation = result.violations.find((v) => v.id === "door1-door-width");
    expect(doorWidthViolation).toBeDefined();
    expect(doorWidthViolation?.severity).toBe("error");
    expect(doorWidthViolation?.code).toBe("FBC R311.2");
  });

  it("passes a door that meets minimum width (≥ 0.813 m)", () => {
    const nodes = {
      door1: { id: "door1", type: "door", width: 0.914, height: 2.032 },
    };
    const result = runFBCChecks(nodes);
    expect(result.violations.filter((v) => v.nodeId === "door1")).toHaveLength(0);
    expect(result.passCount).toBe(2);
  });

  it("flags a wall below minimum ceiling height (FBC R305.1)", () => {
    const nodes = {
      wall1: { id: "wall1", type: "wall", height: 2.0 },
    };
    const result = runFBCChecks(nodes);
    const wallViolation = result.violations.find((v) => v.id === "wall1-wall-height");
    expect(wallViolation).toBeDefined();
    expect(wallViolation?.severity).toBe("warning");
    expect(wallViolation?.code).toBe("FBC R305.1");
  });

  it("passes a wall that meets minimum ceiling height (≥ 2.134 m)", () => {
    const nodes = {
      wall1: { id: "wall1", type: "wall", height: 2.74 },
    };
    const result = runFBCChecks(nodes);
    expect(result.violations.filter((v) => v.nodeId === "wall1")).toHaveLength(0);
    expect(result.passCount).toBe(1);
  });

  it("flags a slab with negative elevation (FBC R322 flood hazard)", () => {
    const nodes = {
      slab1: { id: "slab1", type: "slab", elevation: -0.5 },
    };
    const result = runFBCChecks(nodes);
    const slabViolation = result.violations.find((v) => v.id === "slab1-slab-elevation");
    expect(slabViolation).toBeDefined();
    expect(slabViolation?.severity).toBe("warning");
    expect(slabViolation?.code).toBe("FBC R322");
  });

  it("flags a window that is too narrow (FBC R303.1)", () => {
    const nodes = {
      win1: { id: "win1", type: "window", width: 0.3, height: 0.9 },
    };
    const result = runFBCChecks(nodes);
    const windowViolation = result.violations.find((v) => v.id === "win1-window-width");
    expect(windowViolation).toBeDefined();
    expect(windowViolation?.severity).toBe("warning");
    expect(windowViolation?.code).toBe("FBC R303.1");
  });

  it("correctly counts pass/warn/error totals", () => {
    const nodes = {
      door1: { id: "door1", type: "door", width: 0.914, height: 2.032 }, // pass
      wall1: { id: "wall1", type: "wall", height: 2.0 }, // warning
      door2: { id: "door2", type: "door", width: 0.6, height: 2.032 }, // error
    };
    const result = runFBCChecks(nodes);
    expect(result.passCount).toBeGreaterThanOrEqual(2);
    expect(result.warnCount).toBe(1);
    expect(result.errorCount).toBe(1);
  });
});

describe("BIM Scene persistence helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("storagePut mock returns expected URL", async () => {
    const { storagePut } = await import("./storage");
    const result = await storagePut("bim-scenes/1/scene.json", Buffer.from("{}"), "application/json");
    expect(result.url).toContain("cdn.example.com");
    expect(result.key).toBe("bim-scenes/1/scene.json");
  });

  it("getBimSceneByProject mock can be configured", async () => {
    const { getBimSceneByProject } = await import("./db");
    (getBimSceneByProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      projectId: 42,
      sceneGraphUrl: "https://cdn.example.com/bim-scenes/42/scene.json",
      sceneGraphKey: "bim-scenes/42/scene.json",
    });
    const result = await getBimSceneByProject(42);
    expect(result).toBeDefined();
    expect(result?.projectId).toBe(42);
  });
});

// ─── getSceneForPermit extraction logic (pure unit tests) ────────────────────
// These tests exercise the same extraction logic used in bim.getSceneForPermit
// without calling the full tRPC procedure (which requires DB + S3).

/** Mirror of the extraction logic in bim.getSceneForPermit */
function extractPermitData(sceneGraph: { nodes: Record<string, Record<string, unknown>> }) {
  const nodes = Object.values(sceneGraph.nodes);

  const walls = nodes.filter((n) => n.type === "wall");
  const slabs = nodes.filter((n) => n.type === "slab");
  const doors = nodes.filter((n) => n.type === "door");
  const windows = nodes.filter((n) => n.type === "window");
  const levels = nodes.filter((n) => n.type === "level");
  const roofSegments = nodes.filter((n) => n.type === "roof-segment");
  const zones = nodes.filter((n) => n.type === "zone");

  const slabElevations = slabs
    .map((s) => (typeof s.elevation === "number" ? s.elevation : null))
    .filter((e): e is number => e !== null);
  const lowestFloorElevation = slabElevations.length > 0 ? Math.min(...slabElevations) : null;

  const totalAreaM2 = zones.reduce((sum, z) => {
    const area = typeof z.area === "number" ? z.area : 0;
    return sum + area;
  }, 0);
  const totalAreaSqft = Math.round(totalAreaM2 * 10.764);

  const ceilingHeights = levels
    .map((l) => (typeof l.height === "number" ? l.height : null))
    .filter((h): h is number => h !== null);
  const avgCeilingHeightM =
    ceilingHeights.length > 0
      ? ceilingHeights.reduce((a, b) => a + b, 0) / ceilingHeights.length
      : null;
  const avgCeilingHeightFt =
    avgCeilingHeightM !== null ? Math.round(avgCeilingHeightM * 3.281 * 10) / 10 : null;

  const pitches = roofSegments
    .map((r) => (typeof r.pitch === "number" ? r.pitch : null))
    .filter((p): p is number => p !== null);
  const avgPitch =
    pitches.length > 0
      ? Math.round((pitches.reduce((a, b) => a + b, 0) / pitches.length) * 10) / 10
      : null;

  return {
    wallCount: walls.length,
    slabCount: slabs.length,
    doorCount: doors.length,
    windowCount: windows.length,
    levelCount: levels.length,
    roofSegmentCount: roofSegments.length,
    zoneCount: zones.length,
    totalNodeCount: nodes.length,
    lowestFloorElevationM: lowestFloorElevation,
    lowestFloorElevationFt:
      lowestFloorElevation !== null
        ? Math.round(lowestFloorElevation * 3.281 * 100) / 100
        : null,
    totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
    totalAreaSqft,
    avgCeilingHeightM,
    avgCeilingHeightFt,
    avgRoofPitchDeg: avgPitch,
    levelNames: levels
      .map((l) => (typeof l.name === "string" ? l.name : "Level"))
      .filter(Boolean),
  };
}

describe("getSceneForPermit extraction logic", () => {
  it("returns zero counts for an empty scene", () => {
    const result = extractPermitData({ nodes: {} });
    expect(result.wallCount).toBe(0);
    expect(result.doorCount).toBe(0);
    expect(result.totalAreaSqft).toBe(0);
    expect(result.lowestFloorElevationM).toBeNull();
    expect(result.avgCeilingHeightM).toBeNull();
    expect(result.avgRoofPitchDeg).toBeNull();
  });

  it("counts element types correctly", () => {
    const result = extractPermitData({
      nodes: {
        w1: { type: "wall", height: 2.74 },
        w2: { type: "wall", height: 2.74 },
        d1: { type: "door", width: 0.914, height: 2.032 },
        win1: { type: "window", width: 0.91, height: 1.22 },
        s1: { type: "slab", elevation: 0.3 },
        l1: { type: "level", height: 2.74, name: "Ground Floor" },
        r1: { type: "roof-segment", pitch: 22.5 },
        z1: { type: "zone", area: 111.5 },
      },
    });
    expect(result.wallCount).toBe(2);
    expect(result.doorCount).toBe(1);
    expect(result.windowCount).toBe(1);
    expect(result.slabCount).toBe(1);
    expect(result.levelCount).toBe(1);
    expect(result.roofSegmentCount).toBe(1);
    expect(result.zoneCount).toBe(1);
    expect(result.totalNodeCount).toBe(8);
  });

  it("computes lowest floor elevation from multiple slabs", () => {
    const result = extractPermitData({
      nodes: {
        s1: { type: "slab", elevation: 1.2 },
        s2: { type: "slab", elevation: 0.3 },
        s3: { type: "slab", elevation: 3.0 },
      },
    });
    expect(result.lowestFloorElevationM).toBeCloseTo(0.3);
    // 0.3 m * 3.281 = 0.9843 ft → rounded to 0.98
    expect(result.lowestFloorElevationFt).toBeCloseTo(0.98, 1);
  });

  it("computes total area and converts to sqft", () => {
    const result = extractPermitData({
      nodes: {
        z1: { type: "zone", area: 100 },
        z2: { type: "zone", area: 11.5 },
      },
    });
    expect(result.totalAreaM2).toBeCloseTo(111.5, 1);
    // 111.5 * 10.764 = 1200.186 → rounded to 1200
    expect(result.totalAreaSqft).toBe(1200);
  });

  it("computes average ceiling height from levels", () => {
    const result = extractPermitData({
      nodes: {
        l1: { type: "level", height: 2.74, name: "Ground Floor" },
        l2: { type: "level", height: 2.44, name: "Second Floor" },
      },
    });
    // avg = (2.74 + 2.44) / 2 = 2.59 m → 2.59 * 3.281 = 8.5 ft
    expect(result.avgCeilingHeightM).toBeCloseTo(2.59, 1);
    expect(result.avgCeilingHeightFt).toBeCloseTo(8.5, 0);
    expect(result.levelNames).toEqual(["Ground Floor", "Second Floor"]);
  });

  it("computes average roof pitch from roof segments", () => {
    const result = extractPermitData({
      nodes: {
        r1: { type: "roof-segment", pitch: 20 },
        r2: { type: "roof-segment", pitch: 25 },
      },
    });
    expect(result.avgRoofPitchDeg).toBeCloseTo(22.5, 1);
  });

  it("ignores nodes with missing numeric fields", () => {
    const result = extractPermitData({
      nodes: {
        s1: { type: "slab" }, // no elevation
        l1: { type: "level" }, // no height
        r1: { type: "roof-segment" }, // no pitch
        z1: { type: "zone" }, // no area
      },
    });
    expect(result.lowestFloorElevationM).toBeNull();
    expect(result.avgCeilingHeightM).toBeNull();
    expect(result.avgRoofPitchDeg).toBeNull();
    expect(result.totalAreaM2).toBe(0);
    expect(result.totalAreaSqft).toBe(0);
  });
});
