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
