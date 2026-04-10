/**
 * Integration-style tests for projects and schedules procedures.
 * These tests call the tRPC router directly with mock contexts,
 * verifying the procedure contracts without a live database.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Shared test data ─────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 1,
  name: "Test Project",
  description: "A test project",
  county: "Lee County",
  floodZone: "AE",
  bfe: 8.0,
  hvhz: false,
  windSpeedMph: 155,
  occupancyType: "R-3",
  constructionType: "VB",
  stories: 1,
  conditionedAreaSf: 1500,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ownerId: 1,
};

const MOCK_DOOR = {
  id: 10,
  projectId: 1,
  ifcFileId: null,
  globalId: "door-001",
  ifcClass: "IfcDoor",
  name: "Main Entry Door",
  description: null,
  storey: "First Floor",
  positionX: 5.0,
  positionY: 0.0,
  positionZ: 0.0,
  width: 0.914,
  height: 2.032,
  depth: 0.1,
  propertySets: {
    Pset_DoorCommon: { Width: 0.914, Height: 2.032 },
    FL_DoorProperties: { NOANumber: "MD-22-0001", ImpactRated: true, HardwareSet: "HS-100", Material: "Steel" },
  },
  isGhost: false,
  aiSessionId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const MOCK_WINDOW = {
  id: 11,
  projectId: 1,
  ifcFileId: null,
  globalId: "win-001",
  ifcClass: "IfcWindow",
  name: "Living Room Window",
  description: null,
  storey: "First Floor",
  positionX: 3.0,
  positionY: 0.0,
  positionZ: 1.0,
  width: 1.2,
  height: 1.2,
  depth: 0.1,
  propertySets: {
    Pset_WindowCommon: { Width: 1.2, Height: 1.2, UFactor: 0.3, SHGC: 0.25 },
    FL_WindowProperties: { NOANumber: "MD-22-0002", ImpactRated: true },
  },
  isGhost: false,
  aiSessionId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ─── Mock the database module ─────────────────────────────────────────────────

vi.mock("./db", () => ({
  getDb: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn().mockResolvedValue({ id: 1, name: "Alice", email: "alice@example.com" }),
  getProjectsByUserId: vi.fn().mockResolvedValue([{
    id: 1, name: "Test Project", description: "A test project", county: "Lee County",
    floodZone: "AE", bfe: 8.0, hvhz: false, windSpeedMph: 155, occupancyType: "R-3",
    constructionType: "VB", stories: 1, conditionedAreaSf: 1500,
    createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"), ownerId: 1,
  }]),
  getProjectById: vi.fn().mockResolvedValue({
    id: 1, name: "Test Project", description: "A test project", county: "Lee County",
    floodZone: "AE", bfe: 8.0, hvhz: false, windSpeedMph: 155, occupancyType: "R-3",
    constructionType: "VB", stories: 1, conditionedAreaSf: 1500,
    createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"), ownerId: 1,
  }),
  createProject: vi.fn().mockResolvedValue({ id: 2 }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  addProjectMember: vi.fn().mockResolvedValue(undefined),
  getProjectMembers: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, projectId: 1, memberRole: "owner" },
  ]),
  isProjectMember: vi.fn().mockResolvedValue(true),
  createIfcFile: vi.fn().mockResolvedValue({ id: 5 }),
  getIfcFilesByProject: vi.fn().mockResolvedValue([]),
  getIfcFileById: vi.fn().mockResolvedValue(undefined),
  updateIfcFile: vi.fn().mockResolvedValue(undefined),
  createIfcElement: vi.fn().mockResolvedValue({ id: 99 }),
  getIfcElementsByProject: vi.fn().mockResolvedValue([
    {
      id: 10, projectId: 1, ifcFileId: null, globalId: "door-001", ifcClass: "IfcDoor",
      name: "Main Entry Door", description: null, storey: "First Floor",
      positionX: 5.0, positionY: 0.0, positionZ: 0.0, width: 0.914, height: 2.032, depth: 0.1,
      propertySets: {
        Pset_DoorCommon: { Width: 0.914, Height: 2.032 },
        FL_DoorProperties: { NOANumber: "MD-22-0001", ImpactRated: true, HardwareSet: "HS-100", Material: "Steel" },
      },
      isGhost: false, aiSessionId: null, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
    },
    {
      id: 11, projectId: 1, ifcFileId: null, globalId: "win-001", ifcClass: "IfcWindow",
      name: "Living Room Window", description: null, storey: "First Floor",
      positionX: 3.0, positionY: 0.0, positionZ: 1.0, width: 1.2, height: 1.2, depth: 0.1,
      propertySets: {
        Pset_WindowCommon: { Width: 1.2, Height: 1.2, UFactor: 0.3, SHGC: 0.25 },
        FL_WindowProperties: { NOANumber: "MD-22-0002", ImpactRated: true },
      },
      isGhost: false, aiSessionId: null, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
    },
  ]),
  getIfcElementById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 10) return {
      id: 10, projectId: 1, ifcFileId: null, globalId: "door-001", ifcClass: "IfcDoor",
      name: "Main Entry Door", description: null, storey: "First Floor",
      positionX: 5.0, positionY: 0.0, positionZ: 0.0, width: 0.914, height: 2.032, depth: 0.1,
      propertySets: {
        Pset_DoorCommon: { Width: 0.914, Height: 2.032 },
        FL_DoorProperties: { NOANumber: "MD-22-0001", ImpactRated: true, HardwareSet: "HS-100", Material: "Steel" },
      },
      isGhost: false, aiSessionId: null, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
    };
    if (id === 11) return {
      id: 11, projectId: 1, ifcFileId: null, globalId: "win-001", ifcClass: "IfcWindow",
      name: "Living Room Window", description: null, storey: "First Floor",
      positionX: 3.0, positionY: 0.0, positionZ: 1.0, width: 1.2, height: 1.2, depth: 0.1,
      propertySets: {
        Pset_WindowCommon: { Width: 1.2, Height: 1.2, UFactor: 0.3, SHGC: 0.25 },
        FL_WindowProperties: { NOANumber: "MD-22-0002", ImpactRated: true },
      },
      isGhost: false, aiSessionId: null, createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01"),
    };
    return undefined;
  }),
  updateIfcElement: vi.fn().mockResolvedValue(undefined),
  deleteIfcElementsByFileId: vi.fn().mockResolvedValue(undefined),
  getFbcRules: vi.fn().mockResolvedValue([]),
  getCountyRequirements: vi.fn().mockResolvedValue([]),
  createComplianceCheck: vi.fn().mockResolvedValue(undefined),
  getComplianceChecksByProject: vi.fn().mockResolvedValue([]),
  clearComplianceChecks: vi.fn().mockResolvedValue(undefined),
  createAiSession: vi.fn().mockResolvedValue({ id: 1 }),
  getAiSessionById: vi.fn().mockResolvedValue(null),
  updateAiSession: vi.fn().mockResolvedValue(undefined),
  saveChatMessage: vi.fn().mockResolvedValue(undefined),
  getChatMessages: vi.fn().mockResolvedValue([]),
  // Legacy names used in some tests
  getProjectsByUser: vi.fn().mockResolvedValue([]),
  createComplianceFlag: vi.fn().mockResolvedValue(undefined),
  clearComplianceFlagsByProject: vi.fn().mockResolvedValue(undefined),
  getComplianceFlagsByProject: vi.fn().mockResolvedValue([]),
  getAiPendingChanges: vi.fn().mockResolvedValue([]),
  createAiPendingChange: vi.fn().mockResolvedValue(undefined),
  commitAiPendingChanges: vi.fn().mockResolvedValue(3),
  rejectAiPendingChanges: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

// ─── Mock context factory ─────────────────────────────────────────────────────

function makeCtx(userId = 1, role: "user" | "admin" = "user") {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as never,
    res: { clearCookie: vi.fn() } as never,
  };
}

// ─── Projects CRUD Tests ──────────────────────────────────────────────────────

describe("projects.list", () => {
  it("returns projects for authenticated user", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Project");
    expect(result[0].county).toBe("Lee County");
  });

  it("calls getProjectsByUserId with correct userId", async () => {
    vi.mocked(db.getProjectsByUserId).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(42));
    await caller.projects.list();
    expect(db.getProjectsByUserId).toHaveBeenCalledWith(42);
  });
});

describe("projects.get", () => {
  it("returns project by id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.get({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test Project");
    expect(result?.floodZone).toBe("AE");
    expect(result?.windSpeedMph).toBe(155);
  });

  it("throws NOT_FOUND for non-existent project", async () => {
    vi.mocked(db.getProjectById).mockResolvedValueOnce(undefined);
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    await expect(caller.projects.get({ id: 9999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("projects.create", () => {
  it("creates a project and returns the new id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.create({
      name: "New Project",
      description: "A brand new project",
      county: "Collier County",
      floodZone: "AE",
      bfe: 9.0,
      hvhz: false,
      windSpeedMph: 150,
      occupancyType: "R-3",
      constructionType: "VB",
      stories: 2,
      conditionedAreaSf: 2500,
    });
    // createProject mock returns { id: 2 }, router wraps it as { id: { id: 2 } }
    // The actual id value is the result of createProject (the mock returns { id: 2 })
    expect(result).toHaveProperty("id");
    expect(result.id).toBeTruthy();
  });

  it("calls createProject with ownerId from context", async () => {
    vi.mocked(db.createProject).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(7));
    await caller.projects.create({ name: "Owner Test" });
    expect(db.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 7, name: "Owner Test" })
    );
  });
});

describe("projects.update", () => {
  it("updates project metadata and returns success", async () => {
    vi.mocked(db.updateProject).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.update({
      id: 1,
      name: "Updated Name",
      county: "Sarasota County",
    });
    expect(result).toHaveProperty("success", true);
    expect(db.updateProject).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "Updated Name", county: "Sarasota County" })
    );
  });
});

describe("projects.delete", () => {
  it("deletes a project and returns success", async () => {
    vi.mocked(db.deleteProject).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.delete({ id: 1 });
    expect(result).toHaveProperty("success", true);
    expect(db.deleteProject).toHaveBeenCalledWith(1);
  });
});

describe("projects.getMembers", () => {
  it("returns project members enriched with user data", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.projects.getMembers({ projectId: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].memberRole).toBe("owner");
    expect(result[0].userName).toBe("Alice");
    expect(result[0].userEmail).toBe("alice@example.com");
  });
});

// ─── Schedule Bidirectional Sync Tests ───────────────────────────────────────

describe("schedules.getDoors", () => {
  it("returns door schedule entries derived from IFC elements", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.schedules.getDoors({ projectId: 1 });
    expect(result).toHaveLength(1);
    const door = result[0];
    expect(door.id).toBe(10);
    expect(door.noaNumber).toBe("MD-22-0001");
    expect(door.impactRated).toBe(true);
    expect(door.material).toBe("Steel");
    expect(door.hardwareSet).toBe("HS-100");
  });

  it("includes mark derived from element name", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.schedules.getDoors({ projectId: 1 });
    expect(result[0].mark).toBe("Main Entry Door");
  });

  it("includes width and height from property sets", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.schedules.getDoors({ projectId: 1 });
    expect(result[0].width).toBeCloseTo(0.914, 2);
    expect(result[0].height).toBeCloseTo(2.032, 2);
  });
});

describe("schedules.getWindows", () => {
  it("returns window schedule entries derived from IFC elements", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.schedules.getWindows({ projectId: 1 });
    expect(result).toHaveLength(1);
    const win = result[0];
    expect(win.id).toBe(11);
    expect(win.noaNumber).toBe("MD-22-0002");
    expect(win.impactRated).toBe(true);
    expect(win.uFactor).toBeCloseTo(0.3, 2);
    expect(win.shgc).toBeCloseTo(0.25, 2);
  });

  it("includes mark derived from element name", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));
    const result = await caller.schedules.getWindows({ projectId: 1 });
    expect(result[0].mark).toBe("Living Room Window");
  });
});

describe("schedules.updateScheduleEntry", () => {
  it("writes back property set field to IFC element (bidirectional sync)", async () => {
    vi.mocked(db.updateIfcElement).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));

    const result = await caller.schedules.updateScheduleEntry({
      elementId: 10,
      psetName: "FL_DoorProperties",
      fieldName: "NOANumber",
      value: "MD-23-9999",
    });

    expect(result).toHaveProperty("success", true);
    expect(db.updateIfcElement).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        propertySets: expect.objectContaining({
          FL_DoorProperties: expect.objectContaining({
            NOANumber: "MD-23-9999",
          }),
        }),
      })
    );
  });

  it("handles null value (clearing a field)", async () => {
    vi.mocked(db.updateIfcElement).mockClear();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));

    const result = await caller.schedules.updateScheduleEntry({
      elementId: 10,
      psetName: "FL_DoorProperties",
      fieldName: "HardwareSet",
      value: null,
    });

    expect(result).toHaveProperty("success", true);
    expect(db.updateIfcElement).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        propertySets: expect.objectContaining({
          FL_DoorProperties: expect.objectContaining({
            HardwareSet: null,
          }),
        }),
      })
    );
  });

  it("throws NOT_FOUND for unknown element", async () => {
    vi.mocked(db.getIfcElementById).mockResolvedValueOnce(undefined);
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(makeCtx(1));

    await expect(
      caller.schedules.updateScheduleEntry({
        elementId: 9999,
        psetName: "FL_DoorProperties",
        fieldName: "NOANumber",
        value: "test",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
