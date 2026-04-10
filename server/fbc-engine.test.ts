import { describe, expect, it } from "vitest";
import { checkElement, checkProjectMetadata, runFullComplianceCheck } from "./fbc-engine";
import type { IfcElement, Project } from "../drizzle/schema";

// --- Helpers ------------------------------------------------------------------

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "Test Project",
    description: null,
    ownerId: 1,
    county: "Lee County",
    floodZone: "AE",
    bfe: 8.0,
    hvhz: false,
    windSpeedMph: 155,
    occupancyType: "R-3",
    constructionType: "VB",
    stories: 1,
    conditionedAreaSf: 1500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeElement(overrides: Partial<IfcElement> = {}): IfcElement {
  return {
    id: 1,
    projectId: 1,
    ifcFileId: null,
    globalId: "test-global-id",
    ifcClass: "IfcWall",
    name: "Test Wall",
    description: null,
    storey: "First Floor",
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    width: null,
    height: 8.0,
    depth: null,
    propertySets: {
      Pset_WallCommon: {
        IsExternal: true,
        LoadBearing: true,
        Height: 8.0,
      },
    },
    isGhost: false,
    aiSessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --- Project Metadata Checks --------------------------------------------------

describe("checkProjectMetadata", () => {
  it("returns no flags for a fully configured project", () => {
    const project = makeProject();
    const flags = checkProjectMetadata(project);
    expect(flags).toHaveLength(0);
  });

  it("flags missing county", () => {
    const project = makeProject({ county: null });
    const flags = checkProjectMetadata(project);
    expect(flags.some((f) => f.fbcSection === "R301.2")).toBe(true);
  });

  it("flags missing flood zone", () => {
    const project = makeProject({ floodZone: null });
    const flags = checkProjectMetadata(project);
    expect(flags.some((f) => f.fbcSection === "R322.1")).toBe(true);
  });

  it("flags missing BFE for Zone AE", () => {
    const project = makeProject({ floodZone: "AE", bfe: null });
    const flags = checkProjectMetadata(project);
    const bfeFlag = flags.find((f) => f.fbcSection === "R322.1" && f.severity === "error");
    expect(bfeFlag).toBeDefined();
  });

  it("does not flag missing BFE for Zone X", () => {
    const project = makeProject({ floodZone: "X", bfe: null });
    const flags = checkProjectMetadata(project);
    const bfeFlag = flags.find((f) => f.fbcSection === "R322.1" && f.severity === "error");
    expect(bfeFlag).toBeUndefined();
  });

  it("adds VE coastal hazard info flag", () => {
    const project = makeProject({ floodZone: "VE", bfe: 12.0 });
    const flags = checkProjectMetadata(project);
    expect(flags.some((f) => f.fbcSection === "R322.2.2")).toBe(true);
  });

  it("adds HVHZ NOA info flag", () => {
    const project = makeProject({ hvhz: true, county: "Miami-Dade County" });
    const flags = checkProjectMetadata(project);
    expect(flags.some((f) => f.fbcSection === "1626.1.2")).toBe(true);
  });
});

// --- Wall Checks --------------------------------------------------------------

describe("checkElement - IfcWall", () => {
  it("passes a wall with adequate height", () => {
    const project = makeProject({ windSpeedMph: 100 });
    const element = makeElement({ ifcClass: "IfcWall", height: 9.0 });
    const flags = checkElement(element, project);
    expect(flags).toHaveLength(0);
  });

  it("flags a wall below 7 ft ceiling height (FBC R305.1)", () => {
    const project = makeProject({ windSpeedMph: 100 });
    const element = makeElement({
      ifcClass: "IfcWall",
      height: 6.5,
      propertySets: { Pset_WallCommon: { Height: 6.5 } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R305.1" && f.severity === "error")).toBe(true);
  });

  it("flags missing hurricane straps at high wind speed (FBC R802.11)", () => {
    const project = makeProject({ windSpeedMph: 155 });
    const element = makeElement({
      ifcClass: "IfcWall",
      height: 9.0,
      propertySets: { Pset_WallCommon: { Height: 9.0, HurricaneStraps: false } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R802.11" && f.severity === "error")).toBe(true);
  });

  it("does not flag hurricane straps at low wind speed", () => {
    const project = makeProject({ windSpeedMph: 90 });
    const element = makeElement({
      ifcClass: "IfcWall",
      height: 9.0,
      propertySets: { Pset_WallCommon: { Height: 9.0, HurricaneStraps: false } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R802.11")).toBe(false);
  });
});

// --- Slab Checks -------------------------------------------------------------

describe("checkElement - IfcSlab", () => {
  it("flags slab below 4 in thickness (FBC R506.1)", () => {
    const project = makeProject({ floodZone: "X" });
    const element = makeElement({
      ifcClass: "IfcSlab",
      depth: 3,
      propertySets: { Pset_SlabCommon: { Thickness: 3 } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R506.1" && f.severity === "error")).toBe(true);
  });

  it("passes slab with adequate thickness", () => {
    const project = makeProject({ floodZone: "X" });
    const element = makeElement({
      ifcClass: "IfcSlab",
      depth: 4,
      propertySets: { Pset_SlabCommon: { Thickness: 4 } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R506.1")).toBe(false);
  });

  it("flags slab below BFE + freeboard in Zone AE (FBC R322.1)", () => {
    const project = makeProject({ floodZone: "AE", bfe: 8.0, county: "Lee County" });
    const element = makeElement({
      ifcClass: "IfcSlab",
      positionZ: 7.5, // Below BFE 8.0 + 1.0 freeboard = 9.0
      propertySets: { Pset_SlabCommon: { Thickness: 4, ElevationNAVD: 7.5 } },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R322.1" && f.severity === "error")).toBe(true);
  });
});

// --- Door Checks -------------------------------------------------------------

describe("checkElement - IfcDoor", () => {
  it("flags door below 32 in width (FBC R311.2)", () => {
    const project = makeProject({ hvhz: false });
    const element = makeElement({
      ifcClass: "IfcDoor",
      width: 28,
      propertySets: { Pset_DoorCommon: { Width: 28, Height: 6.75 }, FL_DoorProperties: {} },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R311.2" && f.severity === "error")).toBe(true);
  });

  it("flags door below 6 ft 8 in height (FBC R311.2)", () => {
    const project = makeProject({ hvhz: false });
    const element = makeElement({
      ifcClass: "IfcDoor",
      width: 36,
      height: 6.0,
      propertySets: { Pset_DoorCommon: { Width: 36, Height: 6.0 }, FL_DoorProperties: {} },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "R311.2" && f.severity === "error")).toBe(true);
  });

  it("flags missing NOA number in HVHZ (FBC 1626.1.2)", () => {
    const project = makeProject({ hvhz: true, county: "Miami-Dade County" });
    const element = makeElement({
      ifcClass: "IfcDoor",
      width: 36,
      height: 6.75,
      propertySets: {
        Pset_DoorCommon: { Width: 36, Height: 6.75 },
        FL_DoorProperties: { NOANumber: null, ImpactRated: true },
      },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "1626.1.2" && f.message.includes("NOA"))).toBe(true);
  });

  it("flags non-impact door in HVHZ (FBC 1626.1.2)", () => {
    const project = makeProject({ hvhz: true, county: "Broward County" });
    const element = makeElement({
      ifcClass: "IfcDoor",
      width: 36,
      height: 6.75,
      propertySets: {
        Pset_DoorCommon: { Width: 36, Height: 6.75 },
        FL_DoorProperties: { NOANumber: "MD-22-0001", ImpactRated: false },
      },
    });
    const flags = checkElement(element, project);
    expect(flags.some((f) => f.fbcSection === "1626.1.2" && f.message.includes("Impact"))).toBe(true);
  });

  it("passes compliant HVHZ door with NOA and impact rating", () => {
    const project = makeProject({ hvhz: true, county: "Miami-Dade County" });
    const element = makeElement({
      ifcClass: "IfcDoor",
      width: 36,
      height: 6.75,
      propertySets: {
        Pset_DoorCommon: { Width: 36, Height: 6.75 },
        FL_DoorProperties: { NOANumber: "MD-22-0001", ImpactRated: true },
      },
    });
    const flags = checkElement(element, project);
    expect(flags.filter((f) => f.severity === "error")).toHaveLength(0);
  });
});

// --- Full Run -----------------------------------------------------------------

describe("runFullComplianceCheck", () => {
  it("aggregates project and element flags", () => {
    const project = makeProject({ hvhz: true, floodZone: "AE", bfe: 8.0 });
    const elements = [
      makeElement({ id: 1, ifcClass: "IfcWall", height: 6.0, propertySets: { Pset_WallCommon: { Height: 6.0 } } }),
      makeElement({
        id: 2,
        ifcClass: "IfcDoor",
        width: 36,
        height: 6.75,
        propertySets: {
          Pset_DoorCommon: { Width: 36, Height: 6.75 },
          FL_DoorProperties: { NOANumber: null, ImpactRated: null },
        },
      }),
    ];
    const flags = runFullComplianceCheck(project, elements);
    expect(flags.length).toBeGreaterThan(0);
    // Should have HVHZ project flag + wall height error + door NOA errors
    expect(flags.some((f) => f.fbcSection === "R305.1")).toBe(true);
    expect(flags.some((f) => f.fbcSection === "1626.1.2")).toBe(true);
  });

  it("returns no errors for a fully compliant project", () => {
    const project = makeProject({ hvhz: false, floodZone: "X", windSpeedMph: 90 });
    const elements = [
      makeElement({
        id: 1,
        ifcClass: "IfcWall",
        height: 9.0,
        propertySets: { Pset_WallCommon: { Height: 9.0 } },
      }),
      makeElement({
        id: 2,
        ifcClass: "IfcSlab",
        depth: 4,
        propertySets: { Pset_SlabCommon: { Thickness: 4 } },
      }),
    ];
    const flags = runFullComplianceCheck(project, elements);
    const errors = flags.filter((f) => f.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
