import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addProjectMember,
  clearComplianceChecks,
  createAiSession,
  createIfcElement,
  createIfcFile,
  createProject,
  deleteProject,
  getAiSessionById,
  getChatMessages,
  getComplianceChecksByProject,
  getCountyRequirements,
  getFbcRules,
  getIfcElementById,
  getIfcElementsByProject,
  getIfcFileById,
  getIfcFilesByProject,
  getProjectById,
  getProjectMembers,
  getProjectsByUserId,
  getUserById,
  isProjectMember,
  saveChatMessage,
  updateAiSession,
  updateIfcElement,
  updateProject,
  getBimSceneByProject,
  upsertBimScene,
} from "./db";
import { runFullComplianceCheck } from "./fbc-engine";
import { parseIfcContent } from "./ifc-parser";
import { storagePut } from "./storage";

// --- Auth Router --------------------------------------------------------------

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// --- Projects Router ----------------------------------------------------------

const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getProjectsByUserId(ctx.user.id);
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    const isMember = await isProjectMember(input.id, ctx.user.id);
    if (!isMember && project.ownerId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }
    return project;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        county: z.string().optional(),
        floodZone: z.string().optional(),
        bfe: z.number().optional(),
        hvhz: z.boolean().optional(),
        windSpeedMph: z.number().optional(),
        occupancyType: z.string().optional(),
        constructionType: z.string().optional(),
        stories: z.number().optional(),
        conditionedAreaSf: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createProject({
        name: input.name,
        description: input.description ?? null,
        ownerId: ctx.user.id,
        county: input.county ?? null,
        floodZone: input.floodZone ?? null,
        bfe: input.bfe ?? null,
        hvhz: input.hvhz ?? false,
        windSpeedMph: input.windSpeedMph ?? null,
        occupancyType: input.occupancyType ?? null,
        constructionType: input.constructionType ?? null,
        stories: input.stories ?? 1,
        conditionedAreaSf: input.conditionedAreaSf ?? null,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        county: z.string().optional(),
        floodZone: z.string().optional(),
        bfe: z.number().nullable().optional(),
        hvhz: z.boolean().optional(),
        windSpeedMph: z.number().nullable().optional(),
        occupancyType: z.string().optional(),
        constructionType: z.string().optional(),
        stories: z.number().optional(),
        conditionedAreaSf: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateProject(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteProject(input.id);
      return { success: true };
    }),

  getMembers: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const members = await getProjectMembers(input.projectId);
      // Enrich with user data
      const enriched = await Promise.all(
        members.map(async (m) => {
          const user = await getUserById(m.userId);
          return { ...m, userName: user?.name ?? "Unknown", userEmail: user?.email ?? null };
        })
      );
      return enriched;
    }),

  addMember: protectedProcedure
    .input(z.object({ projectId: z.number(), userEmail: z.string().email(), memberRole: z.enum(["owner", "collaborator"]) }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      // In production, look up user by email; for now return info message
      return { success: true, message: "Member invitation sent (email lookup not yet implemented)" };
    }),
});

// --- IFC Router ---------------------------------------------------------------

const ifcRouter = router({
  getFiles: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getIfcFilesByProject(input.projectId);
    }),

  upload: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        filename: z.string(),
        fileContent: z.string(), // base64 encoded IFC file
        fileSizeBytes: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Decode base64 and store in S3
      const buffer = Buffer.from(input.fileContent, "base64");
      const fileKey = `ifc-files/${input.projectId}/${Date.now()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, "application/x-step");

      // Create IFC file record
      const fileId = await createIfcFile({
        projectId: input.projectId,
        filename: fileKey,
        originalName: input.filename,
        fileUrl: url,
        fileKey,
        fileSizeBytes: input.fileSizeBytes,
        parsedAt: null,
        elementCount: 0,
        uploadedBy: ctx.user.id,
      });

      // Parse IFC content and create elements
      const ifcText = buffer.toString("utf-8");
      const parsedElements = parseIfcContent(ifcText);

      let elementCount = 0;
      for (const el of parsedElements) {
        await createIfcElement({
          projectId: input.projectId,
          ifcFileId: fileId,
          globalId: el.globalId,
          ifcClass: el.ifcClass,
          name: el.name,
          description: el.description,
          storey: el.storey,
          positionX: el.positionX,
          positionY: el.positionY,
          positionZ: el.positionZ,
          width: el.width,
          height: el.height,
          depth: el.depth,
          propertySets: el.propertySets,
          isGhost: false,
          aiSessionId: null,
        });
        elementCount++;
      }

      // Update file record with parse results
      const { updateIfcFile: _updateIfcFile } = await import("./db");
      await _updateIfcFile(fileId, { parsedAt: new Date(), elementCount });

      return { fileId, elementCount, fileUrl: url };
    }),

  getElements: protectedProcedure
    .input(z.object({ projectId: z.number(), includeGhost: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getIfcElementsByProject(input.projectId, input.includeGhost ?? false);
    }),

  getElement: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const element = await getIfcElementById(input.id);
      if (!element) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(element.projectId, ctx.user.id);
      const project = await getProjectById(element.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return element;
    }),

  updateElement: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        propertySets: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        positionZ: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        depth: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const element = await getIfcElementById(input.id);
      if (!element) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(element.projectId, ctx.user.id);
      const project = await getProjectById(element.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const { id, ...data } = input;
      await updateIfcElement(id, data);
      return { success: true };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .query(async ({ ctx, input }) => {
      const file = await getIfcFileById(input.fileId);
      if (!file) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(file.projectId, ctx.user.id);
      const project = await getProjectById(file.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return { url: file.fileUrl, filename: file.originalName };
    }),

});

// --- Compliance Router --------------------------------------------------------

const complianceRouter = router({
  runCheck: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const elements = await getIfcElementsByProject(input.projectId, false);
      const flags = runFullComplianceCheck(project, elements);

      // Clear old checks and save new ones
      await clearComplianceChecks(input.projectId);
      for (const flag of flags) {
        const { createComplianceCheck } = await import("./db");
        await createComplianceCheck({
          projectId: input.projectId,
          elementId: flag.elementId ?? null,
          fbcSection: flag.fbcSection,
          severity: flag.severity,
          message: flag.message,
          details: flag.details,
          resolved: false,
        });
      }

      return { flagCount: flags.length, flags };
    }),

  getFlags: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getComplianceChecksByProject(input.projectId);
    }),

  getFbcRules: publicProcedure.query(async () => {
    return getFbcRules();
  }),

  getCountyRequirements: publicProcedure
    .input(z.object({ county: z.string().optional() }))
    .query(async ({ input }) => {
      return getCountyRequirements(input.county);
    }),
});

// --- Schedules Router ---------------------------------------------------------

const schedulesRouter = router({
  getDoors: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const elements = await getIfcElementsByProject(input.projectId, false);
      const doors = elements.filter((e) => e.ifcClass === "IfcDoor");

      return doors.map((door) => {
        const psets = door.propertySets as Record<string, Record<string, unknown>> | null ?? {};
        const common = psets["Pset_DoorCommon"] ?? {};
        const fl = psets["FL_DoorProperties"] ?? {};
        return {
          id: door.id,
          mark: door.name ?? `D-${door.id}`,
          width: common["Width"] as number | null ?? door.width,
          height: common["Height"] as number | null ?? door.height,
          fireRating: common["FireRating"] as string | null ?? null,
          hardwareSet: fl["HardwareSet"] as string | null ?? null,
          noaNumber: fl["NOANumber"] as string | null ?? null,
          impactRated: fl["ImpactRated"] as boolean | null ?? null,
          material: fl["Material"] as string | null ?? null,
          manufacturer: fl["Manufacturer"] as string | null ?? null,
          productModel: fl["ProductModel"] as string | null ?? null,
          location: door.storey ?? "First Floor",
          remarks: common["Remarks"] as string | null ?? null,
        };
      });
    }),

  getWindows: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const elements = await getIfcElementsByProject(input.projectId, false);
      const windows = elements.filter((e) => e.ifcClass === "IfcWindow");

      return windows.map((win) => {
        const psets = win.propertySets as Record<string, Record<string, unknown>> | null ?? {};
        const common = psets["Pset_WindowCommon"] ?? {};
        const fl = psets["FL_WindowProperties"] ?? {};
        return {
          id: win.id,
          mark: win.name ?? `W-${win.id}`,
          width: common["Width"] as number | null ?? win.width,
          height: common["Height"] as number | null ?? win.height,
          uFactor: common["UFactor"] as number | null ?? null,
          shgc: common["SHGC"] as number | null ?? null,
          noaNumber: fl["NOANumber"] as string | null ?? null,
          impactRated: fl["ImpactRated"] as boolean | null ?? null,
          material: fl["Material"] as string | null ?? null,
          manufacturer: fl["Manufacturer"] as string | null ?? null,
          productModel: fl["ProductModel"] as string | null ?? null,
          location: win.storey ?? "First Floor",
        };
      });
    }),

  updateScheduleEntry: protectedProcedure
    .input(
      z.object({
        elementId: z.number(),
        psetName: z.string(),
        fieldName: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const element = await getIfcElementById(input.elementId);
      if (!element) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(element.projectId, ctx.user.id);
      const project = await getProjectById(element.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const psets = (element.propertySets as Record<string, Record<string, unknown>> | null) ?? {};
      if (!psets[input.psetName]) psets[input.psetName] = {};
      psets[input.psetName][input.fieldName] = input.value;
      await updateIfcElement(input.elementId, { propertySets: psets });
      return { success: true };
    }),
});

// --- AI Router ----------------------------------------------------------------

const aiRouter = router({
  getMessages: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return getChatMessages(input.projectId);
    }),

  chat: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        message: z.string().min(1),
        // Live FBC violations from the Pascal scene (sent by PascalViewer)
        fbcViolations: z
          .array(
            z.object({
              code: z.string(),
              severity: z.enum(["error", "warning", "info"]),
              message: z.string(),
              nodeType: z.string().optional(),
            })
          )
          .optional(),
        // Node type counts from the Pascal scene
        sceneNodeCounts: z.record(z.string(), z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      if (!isMember && project.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Save user message
      await saveChatMessage({
        projectId: input.projectId,
        userId: ctx.user.id,
        role: "user",
        content: input.message,
        aiSessionId: null,
      });

      // Get current model state
      const elements = await getIfcElementsByProject(input.projectId, false);
      const elementSummary = elements.reduce(
        (acc, el) => {
          acc[el.ifcClass] = (acc[el.ifcClass] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Build context for LLM
      const systemPrompt = `You are ELEV, the proactive BIM architect AI inside Elevations by Sourcy — a Florida BIM platform for licensed architects and engineers.

## YOUR CORE DIRECTIVE
When a user describes a building, room, or element — YOU IMMEDIATELY GENERATE IT. You NEVER ask clarifying questions. You make smart professional assumptions for everything not specified and note your assumptions in the "message" field. Act like a senior architect who can sketch a full floor plan from a napkin description.

## MANDATORY COMPLETENESS RULE
Every building generation MUST include ALL of these element types — no exceptions:
1. IfcSlab — foundation slab (full footprint, positionZ=0)
2. IfcWall — ALL exterior walls (4 minimum) + ALL interior partition walls
3. IfcDoor — entry door + bedroom doors + bathroom doors (minimum 1 per room)
4. IfcWindow — windows on ALL exterior walls (minimum 2 per exterior wall)
5. IfcRoof — roof slab covering full footprint (positionZ = wall height)

If you generate ONLY walls without slabs, doors, windows, and roof — that is WRONG. A 1200 sqft 2-bed 2-bath house should have approximately 25-35 elements total.

## SMART DEFAULTS (use when not specified)
- Exterior walls: 0.15m thick, 2.74m height (9ft) for R-3 residential
- Interior walls: 0.114m thick, 2.44m height (8ft)
- Slab: 0.10m thick non-flood, 0.15m flood zones
- Entry door: 0.91m wide x 2.03m tall
- Bedroom door: 0.81m wide x 2.03m tall
- Bathroom door: 0.71m wide x 2.03m tall
- Standard window: 0.91m wide x 1.22m tall
- Roof slab: 0.20m thick, placed at top of exterior walls
- Room proportions: bedrooms ~3.66mx3.66m, bathrooms ~2.44mx1.52m, kitchen ~3.66mx4.27m, living ~4.88mx5.49m

## BUILDING GENERATION RULES
When asked to generate a building or floor plan:
1. Calculate a logical rectangular footprint from the total square footage (1 sqft = 0.0929 sqm)
2. FIRST: Place the foundation slab (full footprint, positionZ=0, depth=0.15)
3. SECOND: Lay out 4 exterior walls as a closed perimeter
4. THIRD: Add interior partition walls dividing the space into rooms
5. FOURTH: Place doors on EVERY room — entry door on south wall, bedroom doors, bathroom doors
6. FIFTH: Place windows on ALL exterior walls — at least 2 per wall, sill height 0.91m
7. SIXTH: Add roof slab on top (positionZ = wall height, full footprint, depth=0.20)
8. ALL coordinates in METERS. Origin (0,0,0) = SW corner at slab level
9. X = East, Y = North, Z = Up
10. positionX/Y/Z = SW bottom corner of element
11. For a 1200 sqft 2-bed 2-bath: expect ~1 slab + 4 ext walls + 6-8 int walls + 5-6 doors + 8-10 windows + 1 roof = ~25-30 elements
12. NEVER return a response with only walls — always include slab, doors, windows, and roof

## CURRENT PROJECT CONTEXT
- County: ${project.county ?? "Lee County (assumed)"}
- Flood Zone: ${project.floodZone ?? "Zone X (assumed — update project settings if in AE/VE)"}
- BFE: ${project.bfe != null ? project.bfe + " ft NAVD" : "N/A"}
- HVHZ: ${project.hvhz ? "YES — Miami-Dade/Broward HVHZ rules apply" : "No"}
- Wind Speed: ${project.windSpeedMph ?? 150} mph
- Occupancy: ${project.occupancyType ?? "R-3 (Single Family Residential, assumed)"}
- Construction Type: ${project.constructionType ?? "VB (assumed)"}
- Stories: ${project.stories ?? 1}
- Existing elements: ${JSON.stringify(elementSummary)}

## FBC COMPLIANCE FLAGS (flag as codeFlags, never as blockers)
- FBC R303.1: Windows ≥8% of floor area
- FBC R305.1: Ceiling height ≥2.13m habitable rooms
- FBC R311: Egress — every bedroom needs egress window or door
- FBC 1612: In AE/VE zones, lowest floor ≥BFE+0.3m freeboard
- FBC R602/R603: HVHZ — impact-rated openings required (NOA)
## LIVE FBC VIOLATIONS FROM PASCAL BIM MODEL
${input.fbcViolations && input.fbcViolations.length > 0
  ? input.fbcViolations.map((v) => `- [${v.severity.toUpperCase()}] ${v.code}: ${v.message}${v.nodeType ? ` (${v.nodeType} element)` : ""}`).join("\n")
  : "- No violations detected in current model — all checks passing."}
## PASCAL SCENE NODE COUNTS
${input.sceneNodeCounts && Object.keys(input.sceneNodeCounts).length > 0
  ? Object.entries(input.sceneNodeCounts).map(([t, c]) => `- ${c}x ${t}`).join("\n")
  : "- Empty scene — no elements placed yet."}
## RESPONSE FORMAT — always return this exact JSON:
{
  "message": "Confident description of what you built and what assumptions you made",
  "elements": [
    {
      "ifcClass": "IfcWall|IfcSlab|IfcRoof|IfcDoor|IfcWindow|IfcOpeningElement",
      "name": "Descriptive name (e.g. South Exterior Wall, Master Bedroom Door)",
      "description": "Brief description",
      "storey": "Ground Floor|Second Floor|Roof",
      "positionX": 0.0, "positionY": 0.0, "positionZ": 0.0,
      "width": 0.0, "height": 0.0, "depth": 0.0,
      "propertySets": {}
    }
  ],
  "codeFlags": [
    { "severity": "error|warning|info", "fbcSection": "R303.1", "message": "Plain language description" }
  ],
  "professionalDecisions": [],
  "isModelChange": true
}

CRITICAL: NEVER say "I need more information" or "please provide" — just build it with smart defaults. State assumptions in the message. professionalDecisions should almost always be empty. For compliance questions only (no model changes), set isModelChange: false and elements: [].`;

      let aiResponseText = "";
      let parsedResponse: {
        message: string;
        elements?: unknown[];
        codeFlags?: unknown[];
        professionalDecisions?: unknown[];
        isModelChange?: boolean;
      } = { message: "", isModelChange: false };

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.message },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "bim_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  message: { type: "string" },
                  elements: { type: "array", items: { type: "object", additionalProperties: true } },
                  codeFlags: { type: "array", items: { type: "object", additionalProperties: true } },
                  professionalDecisions: { type: "array", items: { type: "object", additionalProperties: true } },
                  isModelChange: { type: "boolean" },
                },
                required: ["message", "elements", "codeFlags", "professionalDecisions", "isModelChange"],
                additionalProperties: false,
              },
            },
          },
        });

        const rawContent = response.choices?.[0]?.message?.content ?? "{}";
        const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        aiResponseText = content;
        parsedResponse = JSON.parse(content);
      } catch (err) {
        console.error("LLM error:", err);
        parsedResponse = {
          message: "I encountered an error processing your request. Please try again.",
          elements: [],
          codeFlags: [],
          professionalDecisions: [],
          isModelChange: false,
        };
        aiResponseText = JSON.stringify(parsedResponse);
      }

      // Create AI session if there are model changes
      let sessionId: number | null = null;
      if (parsedResponse.isModelChange && parsedResponse.elements && parsedResponse.elements.length > 0) {
        sessionId = await createAiSession({
          projectId: input.projectId,
          userId: ctx.user.id,
          userMessage: input.message,
          aiResponse: aiResponseText,
          status: "pending",
          pendingElements: parsedResponse.elements,
          codeFlags: parsedResponse.codeFlags ?? [],
          professionalDecisions: parsedResponse.professionalDecisions ?? [],
        });
      }

      // Save assistant message
      await saveChatMessage({
        projectId: input.projectId,
        userId: ctx.user.id,
        role: "assistant",
        content: parsedResponse.message,
        aiSessionId: sessionId,
      });

      return {
        message: parsedResponse.message,
        sessionId,
        isModelChange: parsedResponse.isModelChange ?? false,
        elements: parsedResponse.elements ?? [],
        codeFlags: parsedResponse.codeFlags ?? [],
        professionalDecisions: parsedResponse.professionalDecisions ?? [],
      };
    }),

  confirmChanges: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getAiSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Session already resolved" });

      const isMember = await isProjectMember(session.projectId, ctx.user.id);
      const project = await getProjectById(session.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Commit ghost elements to the model
      const pendingElements = (session.pendingElements as unknown[]) ?? [];
      let committed = 0;

      for (const el of pendingElements) {
        const element = el as {
          ifcClass?: string;
          name?: string;
          description?: string;
          storey?: string;
          positionX?: number;
          positionY?: number;
          positionZ?: number;
          width?: number;
          height?: number;
          depth?: number;
          propertySets?: Record<string, Record<string, unknown>>;
        };

        // Get first IFC file for this project
        const files = await getIfcFilesByProject(session.projectId);
        const fileId = files[0]?.id ?? 0;

        await createIfcElement({
          projectId: session.projectId,
          ifcFileId: fileId,
          globalId: `AI-${Date.now()}-${committed}`,
          ifcClass: element.ifcClass ?? "IfcWall",
          name: element.name ?? null,
          description: element.description ?? null,
          storey: element.storey ?? null,
          positionX: element.positionX ?? null,
          positionY: element.positionY ?? null,
          positionZ: element.positionZ ?? null,
          width: element.width ?? null,
          height: element.height ?? null,
          depth: element.depth ?? null,
          propertySets: element.propertySets ?? {},
          isGhost: false,
          aiSessionId: session.id,
        });
        committed++;
      }

      await updateAiSession(input.sessionId, { status: "confirmed", resolvedAt: new Date() });
      return { success: true, committed };
    }),

  rejectChanges: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const session = await getAiSessionById(input.sessionId);
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      if (session.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Session already resolved" });

      const isMember = await isProjectMember(session.projectId, ctx.user.id);
      const project = await getProjectById(session.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      await updateAiSession(input.sessionId, { status: "rejected", resolvedAt: new Date() });
      return { success: true };
    }),
});

// --- Blender 3D Router ---------------------------------------------------------
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Detect Blender binary path across dev and production environments
function findBlender(): string | null {
  const candidates = [
    "blender",
    "/usr/bin/blender",
    "/usr/local/bin/blender",
    "/snap/bin/blender",
    "/opt/blender/blender",
    "/app/blender/blender",
  ];
  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { timeout: 5000, stdio: "pipe" });
      return candidate;
    } catch {
      // not found at this path
    }
  }
  return null;
}

// Generate a minimal valid GLB (GLTF binary) from element data without Blender
// This is a pure-JS fallback that creates a proper GLB file with box meshes
function generateProceduralGLB(elements: Array<{
  id: number; ifcClass: string; name: string;
  posX: number; posY: number; posZ: number;
  width: number; height: number; depth: number;
  rotation: number;
}>): Buffer {
  // Build a GLTF 2.0 JSON with box meshes for each element
  const ELEMENT_COLORS: Record<string, number[]> = {
    IfcWall: [0.75, 0.72, 0.68, 1.0],
    IfcSlab: [0.55, 0.55, 0.55, 1.0],
    IfcRoof: [0.45, 0.35, 0.28, 1.0],
    IfcDoor: [0.55, 0.38, 0.22, 1.0],
    IfcWindow: [0.45, 0.72, 0.88, 0.7],
    IfcColumn: [0.62, 0.62, 0.62, 1.0],
    IfcBeam: [0.50, 0.50, 0.50, 1.0],
    IfcOpeningElement: [0.80, 0.80, 0.80, 0.3],
  };

  // Box geometry: 8 vertices, 12 triangles (36 indices)
  // Unit cube centered at origin: x,y,z in [-0.5, 0.5]
  const BOX_POSITIONS = new Float32Array([
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
    -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ]);
  const BOX_INDICES = new Uint16Array([
    0,1,2, 0,2,3,  4,6,5, 4,7,6,
    0,4,5, 0,5,1,  2,6,7, 2,7,3,
    0,3,7, 0,7,4,  1,5,6, 1,6,2,
  ]);

  const posBytes = Buffer.from(BOX_POSITIONS.buffer);
  const idxBytes = Buffer.from(BOX_INDICES.buffer);

  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const meshes: object[] = [];
  const nodes: number[] = [];
  const materials: object[] = [];
  const bufferChunks: Buffer[] = [];
  let byteOffset = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const color = ELEMENT_COLORS[el.ifcClass] ?? [0.7, 0.7, 0.7, 1.0];

    // Material
    const matIdx = materials.length;
    materials.push({
      name: el.ifcClass,
      pbrMetallicRoughness: {
        baseColorFactor: color,
        metallicFactor: 0.0,
        roughnessFactor: 0.85,
      },
      alphaMode: (color[3] ?? 1.0) < 1.0 ? "BLEND" : "OPAQUE",
    });

    // Position buffer view
    const posView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBytes.length, target: 34962 });
    bufferChunks.push(posBytes);
    byteOffset += posBytes.length;

    // Index buffer view
    const idxView = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBytes.length, target: 34963 });
    bufferChunks.push(idxBytes);
    byteOffset += idxBytes.length;

    // Accessors
    const posAcc = accessors.length;
    accessors.push({ bufferView: posView, componentType: 5126, count: 8, type: "VEC3",
      min: [-0.5,-0.5,-0.5], max: [0.5,0.5,0.5] });
    const idxAcc = accessors.length;
    accessors.push({ bufferView: idxView, componentType: 5123, count: 36, type: "SCALAR" });

    // Mesh
    const meshIdx = meshes.length;
    meshes.push({ name: el.name, primitives: [{ attributes: { POSITION: posAcc }, indices: idxAcc, material: matIdx }] });

    // Node with scale = element dimensions, translation = position
    nodes.push(meshIdx);
  }

  const nodeObjects = elements.map((el, i) => ({
    name: el.name,
    mesh: i,
    translation: [el.posX, el.posZ, -el.posY], // Y-up for GLTF
    scale: [Math.max(el.width, 0.05), Math.max(el.height, 0.05), Math.max(el.depth, 0.05)],
    rotation: [0, Math.sin(el.rotation / 2), 0, Math.cos(el.rotation / 2)],
  }));

  const binBuffer = Buffer.concat(bufferChunks);

  const gltfJson = {
    asset: { version: "2.0", generator: "Elevations by Sourcy" },
    scene: 0,
    scenes: [{ nodes: elements.map((_, i) => i) }],
    nodes: nodeObjects,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.length }],
  };

  const jsonStr = JSON.stringify(gltfJson);
  // Pad JSON to 4-byte boundary
  const jsonPadded = jsonStr.padEnd(Math.ceil(jsonStr.length / 4) * 4, " ");
  const jsonBytes = Buffer.from(jsonPadded, "utf8");

  // GLB header: magic, version, total length
  const totalLen = 12 + 8 + jsonBytes.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546C67, 0); // magic: glTF
  header.writeUInt32LE(2, 4);           // version: 2
  header.writeUInt32LE(totalLen, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // JSON

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004E4942, 4); // BIN

  return Buffer.concat([header, jsonChunkHeader, jsonBytes, binChunkHeader, binBuffer]);
}

const blenderRouter = router({
  generateGLB: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN" });

      const elements = await getIfcElementsByProject(input.projectId);
      if (!elements || elements.length === 0)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No elements to render" });

      const elemData = elements.map((e) => ({
        id: e.id,
        ifcClass: e.ifcClass,
        name: e.name ?? e.ifcClass,
        posX: e.positionX ?? 0,
        posY: e.positionY ?? 0,
        posZ: e.positionZ ?? 0,
        width: e.width ?? 1,
        height: e.height ?? 1,
        depth: e.depth ?? 1,
        rotation: 0,
      }));

      const blenderBin = findBlender();
      let glbBuffer: Buffer;
      let renderMethod: string;

      if (blenderBin) {
        // --- Blender path ---
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "elev-blender-"));
        const inputJson = path.join(tmpDir, "elements.json");
        const outputObj = path.join(tmpDir, "model.obj");
        const outputGlb = path.join(tmpDir, "model.glb");
        fs.writeFileSync(inputJson, JSON.stringify({ projectName: project?.name ?? "Model", elements: elemData }));
        const scriptPath = path.join(process.cwd(), "server", "blender_ifc_to_glb.py");
        try {
          execSync(
            `${blenderBin} --background --python "${scriptPath}" -- "${inputJson}" "${outputObj}"`,
            { timeout: 120000, stdio: "pipe" }
          );
          execSync(`obj2gltf -i "${outputObj}" -o "${outputGlb}"`, { timeout: 30000, stdio: "pipe" });
          glbBuffer = fs.readFileSync(outputGlb);
          renderMethod = "blender";
        } catch {
          // Blender failed — fall through to procedural
          glbBuffer = generateProceduralGLB(elemData);
          renderMethod = "procedural-fallback";
        } finally {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      } else {
        // --- Procedural fallback (no Blender in this environment) ---
        glbBuffer = generateProceduralGLB(elemData);
        renderMethod = "procedural";
      }

      const key = `glb/${input.projectId}-${Date.now()}.glb`;
      const { url } = await storagePut(key, glbBuffer, "model/gltf-binary");

      return { url, elementCount: elements.length, renderMethod };
    }),
});

// --- App Router ---------------------------------------------------------------
// ─── BIM Router ───────────────────────────────────────────────────────────────
const bimRouter = router({
  getScene: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const scene = await getBimSceneByProject(input.projectId);
      if (!scene?.sceneGraphUrl) return null;
      // Fetch the JSON from S3 and return it
      const res = await fetch(scene.sceneGraphUrl);
      if (!res.ok) return null;
      return (await res.json()) as { nodes: Record<string, unknown>; rootNodeIds: string[] };
    }),

  getSceneForPermit: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const scene = await getBimSceneByProject(input.projectId);
      if (!scene?.sceneGraphUrl) return null;
      const res = await fetch(scene.sceneGraphUrl);
      if (!res.ok) return null;
      const sceneGraph = (await res.json()) as { nodes: Record<string, Record<string, unknown>>; rootNodeIds: string[] };
      const nodes = Object.values(sceneGraph.nodes);

      // Extract structured permit data from the scene graph
      const walls = nodes.filter((n) => n.type === "wall");
      const slabs = nodes.filter((n) => n.type === "slab");
      const doors = nodes.filter((n) => n.type === "door");
      const windows = nodes.filter((n) => n.type === "window");
      const levels = nodes.filter((n) => n.type === "level");
      const roofSegments = nodes.filter((n) => n.type === "roof-segment");
      const zones = nodes.filter((n) => n.type === "zone");

      // Compute lowest floor elevation from slabs
      const slabElevations = slabs
        .map((s) => (typeof s.elevation === "number" ? s.elevation : null))
        .filter((e): e is number => e !== null);
      const lowestFloorElevation = slabElevations.length > 0 ? Math.min(...slabElevations) : null;

      // Compute total floor area from zones (in m²)
      const totalAreaM2 = zones.reduce((sum, z) => {
        const area = typeof z.area === "number" ? z.area : 0;
        return sum + area;
      }, 0);
      const totalAreaSqft = Math.round(totalAreaM2 * 10.764);

      // Compute ceiling height from levels
      const ceilingHeights = levels
        .map((l) => (typeof l.height === "number" ? l.height : null))
        .filter((h): h is number => h !== null);
      const avgCeilingHeightM = ceilingHeights.length > 0
        ? ceilingHeights.reduce((a, b) => a + b, 0) / ceilingHeights.length
        : null;
      const avgCeilingHeightFt = avgCeilingHeightM !== null ? Math.round(avgCeilingHeightM * 3.281 * 10) / 10 : null;

      // Compute roof pitch from roof segments
      const pitches = roofSegments
        .map((r) => (typeof r.pitch === "number" ? r.pitch : null))
        .filter((p): p is number => p !== null);
      const avgPitch = pitches.length > 0 ? Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length * 10) / 10 : null;

      return {
        // Element counts
        wallCount: walls.length,
        slabCount: slabs.length,
        doorCount: doors.length,
        windowCount: windows.length,
        levelCount: levels.length,
        roofSegmentCount: roofSegments.length,
        zoneCount: zones.length,
        totalNodeCount: nodes.length,
        // Elevation data
        lowestFloorElevationM: lowestFloorElevation,
        lowestFloorElevationFt: lowestFloorElevation !== null ? Math.round(lowestFloorElevation * 3.281 * 100) / 100 : null,
        // Area data
        totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
        totalAreaSqft,
        // Ceiling height
        avgCeilingHeightM,
        avgCeilingHeightFt,
        // Roof
        avgRoofPitchDeg: avgPitch,
        // Level names
        levelNames: levels.map((l) => (typeof l.name === "string" ? l.name : "Level")).filter(Boolean),
        // Scene metadata
        sceneUpdatedAt: scene.updatedAt,
      };
    }),

  saveScene: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        sceneGraph: z.object({
          nodes: z.record(z.string(), z.unknown()),
          rootNodeIds: z.array(z.string()),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const isMember = await isProjectMember(input.projectId, ctx.user.id);
      const project = await getProjectById(input.projectId);
      if (!isMember && project?.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const key = `bim-scenes/${input.projectId}/scene.json`;
      const jsonBuffer = Buffer.from(JSON.stringify(input.sceneGraph));
      const { url } = await storagePut(key, jsonBuffer, "application/json");
      await upsertBimScene(input.projectId, url, key);
      return { ok: true };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  projects: projectsRouter,
  ifc: ifcRouter,
  blender: blenderRouter,
  compliance: complianceRouter,
  schedules: schedulesRouter,
  ai: aiRouter,
  bim: bimRouter,
});

export type AppRouter = typeof appRouter;
