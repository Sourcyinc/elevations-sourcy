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
} from "./db";
import { runFullComplianceCheck } from "./fbc-engine";
import { parseIfcContent } from "./ifc-parser";
import { storagePut } from "./storage";

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Projects Router ──────────────────────────────────────────────────────────

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

// ─── IFC Router ───────────────────────────────────────────────────────────────

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

// ─── Compliance Router ────────────────────────────────────────────────────────

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

// ─── Schedules Router ─────────────────────────────────────────────────────────

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

// ─── AI Router ────────────────────────────────────────────────────────────────

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
      const systemPrompt = `You are the AI engine for Elevations by Sourcy, a Florida BIM platform serving licensed architects and engineers. 
You generate building elements and check Florida Building Code (FBC 2023 8th Edition) compliance.
You output structured JSON that Elevations converts to IFC geometry.
You NEVER generate elements that violate FBC. When uncertain about a code requirement, flag it for professional review.
Your output is ALWAYS a suggestion in ghost state until the professional confirms it.

Current project context:
- County: ${project.county ?? "Not set"}
- Flood Zone: ${project.floodZone ?? "Not set"}
- BFE: ${project.bfe ?? "Not set"} ft NAVD
- HVHZ: ${project.hvhz ? "Yes" : "No"}
- Wind Speed: ${project.windSpeedMph ?? "Not set"} mph
- Occupancy: ${project.occupancyType ?? "Not set"}
- Construction Type: ${project.constructionType ?? "Not set"}
- Stories: ${project.stories ?? 1}
- Current elements: ${JSON.stringify(elementSummary)}

Respond with a JSON object with this structure:
{
  "message": "Plain language explanation of what you're proposing",
  "elements": [
    {
      "ifcClass": "IfcWall|IfcSlab|IfcRoof|IfcDoor|IfcWindow|IfcOpeningElement",
      "name": "Element name",
      "description": "Optional description",
      "storey": "Floor level name",
      "positionX": 0.0, "positionY": 0.0, "positionZ": 0.0,
      "width": 0.0, "height": 0.0, "depth": 0.0,
      "propertySets": {}
    }
  ],
  "codeFlags": [
    { "severity": "error|warning|info", "fbcSection": "R305.1", "message": "Plain language flag" }
  ],
  "professionalDecisions": [
    { "id": "pd_001", "question": "Question requiring professional judgment", "required": true }
  ],
  "isModelChange": true
}

If the user is asking a question (not requesting model changes), set "isModelChange": false and "elements": [].`;

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

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  projects: projectsRouter,
  ifc: ifcRouter,
  compliance: complianceRouter,
  schedules: schedulesRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
