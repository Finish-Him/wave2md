import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
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

/**
 * Prompt templates for document generation.
 * Users can customize prompts to match their team's standards.
 */
export const promptTemplates = mysqlTable("prompt_templates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["prd", "readme", "todo", "system"]).notNull(),
  promptContent: text("promptContent").notNull(),
  isDefault: int("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = typeof promptTemplates.$inferInsert;

/**
 * Stores user's external API keys (OpenRouter, HuggingFace)
 */
export const apiKeys = mysqlTable("api_keys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["openrouter", "huggingface"]).notNull(),
  apiKey: text("apiKey").notNull(), // Encrypted key
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * Projects table - stores audio processing projects
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "transcribing",
    "analyzing",
    "generating",
    "packaging",
    "completed",
    "failed"
  ]).default("pending").notNull(),
  progress: int("progress").default(0).notNull(), // 0-100
  audioUrl: text("audioUrl"), // S3 URL of uploaded audio
  audioFileName: varchar("audioFileName", { length: 255 }),
  audioFileSize: int("audioFileSize"), // in bytes
  transcription: text("transcription"), // Raw transcription text
  detectedLanguage: varchar("detectedLanguage", { length: 10 }),
  zipUrl: text("zipUrl"), // S3 URL of final ZIP
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Documents table - stores generated documents for each project
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  type: mysqlEnum("type", ["prd", "readme", "todo", "other"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(), // Markdown content
  fileUrl: text("fileUrl"), // S3 URL if stored separately
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Chat messages for the intelligent assistant
 * Stores conversation history between users and the chatbot
 */
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  projectId: int("projectId"), // Optional: link message to a specific project for context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Project shares for collaboration
 * Allows users to share projects via public or private links
 */
export const projectShares = mysqlTable("project_shares", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(), // Owner of the project
  shareToken: varchar("shareToken", { length: 64 }).notNull().unique(), // UUID for the share link
  isPublic: int("isPublic").default(1).notNull(), // 1 = public, 0 = private (requires password)
  password: text("password"), // Hashed password for private shares
  permissions: mysqlEnum("permissions", ["view", "download"]).default("view").notNull(),
  expiresAt: timestamp("expiresAt"), // Optional expiration date
  viewCount: int("viewCount").default(0).notNull(), // Track how many times the link was accessed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastAccessedAt: timestamp("lastAccessedAt"),
});

export type ProjectShare = typeof projectShares.$inferSelect;
export type InsertProjectShare = typeof projectShares.$inferInsert;
