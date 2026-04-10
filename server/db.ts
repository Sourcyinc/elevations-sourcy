import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  AiSession,
  ChatMessage,
  ComplianceCheck,
  IfcElement,
  IfcFile,
  InsertIfcElement,
  InsertUser,
  Project,
  ProjectMember,
  aiSessions,
  chatMessages,
  complianceChecks,
  countyRequirements,
  fbcRules,
  ifcElements,
  ifcFiles,
  projectMembers,
  projects,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];
  // Get projects where user is owner OR member
  const owned = await db.select().from(projects).where(eq(projects.ownerId, userId));
  const memberRows = await db.select().from(projectMembers).where(eq(projectMembers.userId, userId));
  const memberProjectIds = memberRows.map((m) => m.projectId);
  const memberProjects: Project[] = [];
  for (const pid of memberProjectIds) {
    const p = await db.select().from(projects).where(eq(projects.id, pid)).limit(1);
    if (p.length > 0 && !owned.find((o) => o.id === pid)) memberProjects.push(p[0]);
  }
  return [...owned, ...memberProjects].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProject(data: Omit<Project, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  const raw = result as unknown as [{ insertId: number }, unknown];
  const insertId = Array.isArray(raw) ? raw[0].insertId : (raw as unknown as { insertId: number }).insertId;
  // Auto-add owner as member
  await db.insert(projectMembers).values({ projectId: insertId, userId: data.ownerId, memberRole: "owner" });
  return insertId;
}

export async function updateProject(id: number, data: Partial<Project>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(data).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projects).where(eq(projects.id, id));
}

export async function getProjectMembers(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
}

export async function addProjectMember(projectId: number, userId: number, memberRole: "owner" | "collaborator") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(projectMembers).values({ projectId, userId, memberRole });
}

export async function isProjectMember(projectId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

// ─── IFC Files ────────────────────────────────────────────────────────────────

export async function createIfcFile(data: Omit<IfcFile, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ifcFiles).values(data);
  const raw = result as unknown as [{ insertId: number }, unknown];
  return Array.isArray(raw) ? raw[0].insertId : (raw as unknown as { insertId: number }).insertId;
}

export async function getIfcFilesByProject(projectId: number): Promise<IfcFile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ifcFiles).where(eq(ifcFiles.projectId, projectId)).orderBy(desc(ifcFiles.createdAt));
}

export async function getIfcFileById(id: number): Promise<IfcFile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ifcFiles).where(eq(ifcFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateIfcFile(id: number, data: Partial<IfcFile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ifcFiles).set(data).where(eq(ifcFiles.id, id));
}

// ─── IFC Elements ─────────────────────────────────────────────────────────────

export async function createIfcElement(data: InsertIfcElement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ifcElements).values(data);
  const raw = result as unknown as [{ insertId: number }, unknown];
  return Array.isArray(raw) ? raw[0].insertId : (raw as unknown as { insertId: number }).insertId;
}

export async function getIfcElementsByProject(projectId: number, includeGhost = false): Promise<IfcElement[]> {
  const db = await getDb();
  if (!db) return [];
  if (includeGhost) {
    return db.select().from(ifcElements).where(eq(ifcElements.projectId, projectId));
  }
  return db
    .select()
    .from(ifcElements)
    .where(and(eq(ifcElements.projectId, projectId), eq(ifcElements.isGhost, false)));
}

export async function getIfcElementById(id: number): Promise<IfcElement | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ifcElements).where(eq(ifcElements.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateIfcElement(id: number, data: Partial<IfcElement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ifcElements).set(data).where(eq(ifcElements.id, id));
}

export async function deleteIfcElementsByFileId(ifcFileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(ifcElements).where(eq(ifcElements.ifcFileId, ifcFileId));
}

// ─── FBC Rules ────────────────────────────────────────────────────────────────

export async function getFbcRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fbcRules);
}

export async function getCountyRequirements(county?: string) {
  const db = await getDb();
  if (!db) return [];
  if (county) {
    return db.select().from(countyRequirements).where(eq(countyRequirements.county, county));
  }
  return db.select().from(countyRequirements);
}

// ─── Compliance Checks ────────────────────────────────────────────────────────

export async function createComplianceCheck(data: Omit<ComplianceCheck, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(complianceChecks).values(data);
}

export async function getComplianceChecksByProject(projectId: number): Promise<ComplianceCheck[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(complianceChecks)
    .where(eq(complianceChecks.projectId, projectId))
    .orderBy(desc(complianceChecks.createdAt));
}

export async function clearComplianceChecks(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(complianceChecks).where(eq(complianceChecks.projectId, projectId));
}

// ─── AI Sessions ──────────────────────────────────────────────────────────────

export async function createAiSession(data: Omit<AiSession, "id" | "createdAt" | "resolvedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiSessions).values(data);
  const raw = result as unknown as [{ insertId: number }, unknown];
  return Array.isArray(raw) ? raw[0].insertId : (raw as unknown as { insertId: number }).insertId;
}

export async function getAiSessionById(id: number): Promise<AiSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiSessions).where(eq(aiSessions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateAiSession(id: number, data: Partial<AiSession>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(aiSessions).set(data).where(eq(aiSessions.id, id));
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

export async function saveChatMessage(data: Omit<ChatMessage, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values(data);
}

export async function getChatMessages(projectId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.projectId, projectId))
    .orderBy(chatMessages.createdAt);
}
