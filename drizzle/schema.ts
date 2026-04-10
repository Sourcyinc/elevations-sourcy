import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId").notNull(),
  // Florida project metadata
  county: varchar("county", { length: 100 }),
  floodZone: varchar("floodZone", { length: 20 }), // AE, VE, X, etc.
  bfe: float("bfe"), // Base Flood Elevation in ft NAVD
  hvhz: boolean("hvhz").default(false), // High Velocity Hurricane Zone
  windSpeedMph: int("windSpeedMph"),
  occupancyType: varchar("occupancyType", { length: 20 }), // R-3, A-2, etc.
  constructionType: varchar("constructionType", { length: 10 }), // IA, IB, IIA, IIB, IIIA, IIIB, IV, VA, VB
  stories: int("stories").default(1),
  conditionedAreaSf: float("conditionedAreaSf"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Project Members ──────────────────────────────────────────────────────────

export const projectMembers = mysqlTable("project_members", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  memberRole: mysqlEnum("memberRole", ["owner", "collaborator"]).default("collaborator").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;

// ─── IFC Files ────────────────────────────────────────────────────────────────

export const ifcFiles = mysqlTable("ifc_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("originalName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  fileSizeBytes: int("fileSizeBytes"),
  parsedAt: timestamp("parsedAt"),
  elementCount: int("elementCount").default(0),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IfcFile = typeof ifcFiles.$inferSelect;

// ─── IFC Elements ─────────────────────────────────────────────────────────────

export const ifcElements = mysqlTable("ifc_elements", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  ifcFileId: int("ifcFileId").notNull(),
  globalId: varchar("globalId", { length: 64 }).notNull(),
  ifcClass: varchar("ifcClass", { length: 64 }).notNull(), // IfcWall, IfcDoor, etc.
  name: varchar("name", { length: 255 }),
  description: text("description"),
  storey: varchar("storey", { length: 255 }),
  // Geometry (simplified bounding box for display)
  positionX: float("positionX"),
  positionY: float("positionY"),
  positionZ: float("positionZ"),
  width: float("width"),
  height: float("height"),
  depth: float("depth"),
  // Property sets stored as JSON
  propertySets: json("propertySets"), // { Pset_WallCommon: {...}, FL_DoorProperties: {...} }
  // Ghost state for AI-generated elements
  isGhost: boolean("isGhost").default(false),
  aiSessionId: int("aiSessionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IfcElement = typeof ifcElements.$inferSelect;
export type InsertIfcElement = typeof ifcElements.$inferInsert;

// ─── FBC Rules ────────────────────────────────────────────────────────────────

export const fbcRules = mysqlTable("fbc_rules", {
  id: int("id").autoincrement().primaryKey(),
  section: varchar("section", { length: 30 }).notNull(), // e.g. R305.1
  description: text("description").notNull(),
  category: mysqlEnum("category", ["flood", "wind", "egress", "structural", "energy", "fire", "general"]).notNull(),
  value: float("value"),
  unit: varchar("unit", { length: 60 }), // ft, in, mph, SF, etc.
  condition: text("condition"),
  occupancy: varchar("occupancy", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FbcRule = typeof fbcRules.$inferSelect;

// ─── County Requirements ──────────────────────────────────────────────────────

export const countyRequirements = mysqlTable("county_requirements", {
  id: int("id").autoincrement().primaryKey(),
  county: varchar("county", { length: 100 }).notNull(),
  freeboardFt: float("freeboardFt").default(0), // Additional freeboard above FBC minimum
  windSpeedMph: int("windSpeedMph").notNull(),
  hvhz: boolean("hvhz").default(false),
  floodZones: text("floodZones"), // comma-separated: "AE,VE,X"
  requiredSheets: text("requiredSheets"), // JSON array of required sheet types
  submittalPortalUrl: text("submittalPortalUrl"),
  digitalSignatureRequired: boolean("digitalSignatureRequired").default(false),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CountyRequirement = typeof countyRequirements.$inferSelect;

// ─── Compliance Checks ────────────────────────────────────────────────────────

export const complianceChecks = mysqlTable("compliance_checks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  elementId: int("elementId"),
  fbcSection: varchar("fbcSection", { length: 30 }).notNull(),
  severity: mysqlEnum("severity", ["error", "warning", "info"]).notNull(),
  message: text("message").notNull(),
  details: text("details"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComplianceCheck = typeof complianceChecks.$inferSelect;

// ─── AI Sessions ──────────────────────────────────────────────────────────────

export const aiSessions = mysqlTable("ai_sessions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  userMessage: text("userMessage").notNull(),
  aiResponse: text("aiResponse"),
  status: mysqlEnum("status", ["pending", "confirmed", "rejected"]).default("pending").notNull(),
  pendingElements: json("pendingElements"), // Array of ghost-state elements
  codeFlags: json("codeFlags"), // Array of compliance flags from AI
  professionalDecisions: json("professionalDecisions"), // Array of questions for professional
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type AiSession = typeof aiSessions.$inferSelect;

// ─── Chat Messages ────────────────────────────────────────────────────────────

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  aiSessionId: int("aiSessionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
