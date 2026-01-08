import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  apiKeys, InsertApiKey, ApiKey,
  projects, InsertProject, Project,
  documents, InsertDocument, Document,
  promptTemplates, InsertPromptTemplate, PromptTemplate,
  chatMessages, InsertChatMessage, ChatMessage,
  projectShares, InsertProjectShare, ProjectShare
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

// ============ USER OPERATIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ API KEYS OPERATIONS ============

export async function getApiKey(userId: number, provider: "openrouter" | "huggingface"): Promise<ApiKey | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.provider, provider)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertApiKey(data: { userId: number; provider: "openrouter" | "huggingface"; apiKey: string }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getApiKey(data.userId, data.provider);
  
  if (existing) {
    await db.update(apiKeys)
      .set({ apiKey: data.apiKey, updatedAt: new Date() })
      .where(eq(apiKeys.id, existing.id));
  } else {
    await db.insert(apiKeys).values({
      userId: data.userId,
      provider: data.provider,
      apiKey: data.apiKey,
    });
  }
}

export async function getUserApiKeys(userId: number): Promise<{ openrouter: boolean; huggingface: boolean }> {
  const db = await getDb();
  if (!db) return { openrouter: false, huggingface: false };

  const result = await db.select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  
  return {
    openrouter: result.some(k => k.provider === "openrouter"),
    huggingface: result.some(k => k.provider === "huggingface"),
  };
}

// ============ PROJECT OPERATIONS ============

export async function createProject(data: InsertProject): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(data);
  return result[0].insertId;
}

export async function getProject(projectId: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserProjects(userId: number, limit = 50): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.createdAt))
    .limit(limit);
}

export async function updateProject(projectId: number, data: Partial<InsertProject>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

export async function updateProjectStatus(
  projectId: number, 
  status: Project["status"], 
  progress: number,
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Partial<InsertProject> = {
    status,
    progress,
    updatedAt: new Date(),
  };

  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  if (status === "completed") {
    updateData.completedAt = new Date();
  }

  await db.update(projects)
    .set(updateData)
    .where(eq(projects.id, projectId));
}

// ============ DOCUMENT OPERATIONS ============

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(data);
  return result[0].insertId;
}

export async function getProjectDocuments(projectId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(documents)
    .where(eq(documents.projectId, projectId));
}

export async function getDocument(documentId: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// ============ PROMPT TEMPLATE OPERATIONS ============

export async function createPromptTemplate(data: InsertPromptTemplate): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(promptTemplates).values(data);
  return result[0].insertId;
}

export async function getUserPromptTemplates(userId: number): Promise<PromptTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(promptTemplates)
    .where(eq(promptTemplates.userId, userId))
    .orderBy(desc(promptTemplates.createdAt));
}

export async function getPromptTemplate(templateId: number): Promise<PromptTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, templateId))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getDefaultPromptTemplate(userId: number, type: "prd" | "readme" | "todo" | "system"): Promise<PromptTemplate | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(promptTemplates)
    .where(and(
      eq(promptTemplates.userId, userId),
      eq(promptTemplates.type, type),
      eq(promptTemplates.isDefault, 1)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function updatePromptTemplate(templateId: number, data: Partial<InsertPromptTemplate>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(promptTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(promptTemplates.id, templateId));
}

export async function deletePromptTemplate(templateId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(promptTemplates)
    .where(eq(promptTemplates.id, templateId));
}

export async function setDefaultPromptTemplate(userId: number, templateId: number, type: "prd" | "readme" | "todo" | "system"): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // First, unset all defaults for this user and type
  await db.update(promptTemplates)
    .set({ isDefault: 0 })
    .where(and(
      eq(promptTemplates.userId, userId),
      eq(promptTemplates.type, type)
    ));

  // Then set the new default
  await db.update(promptTemplates)
    .set({ isDefault: 1 })
    .where(eq(promptTemplates.id, templateId));
}


// ============ CHAT MESSAGES OPERATIONS ============

export async function createChatMessage(message: InsertChatMessage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(chatMessages).values(message);
  return Number(result[0].insertId);
}

export async function getUserChatHistory(userId: number, limit: number = 50): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function getProjectChatHistory(userId: number, projectId: number, limit: number = 20): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(chatMessages)
    .where(and(
      eq(chatMessages.userId, userId),
      eq(chatMessages.projectId, projectId)
    ))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function clearUserChatHistory(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(chatMessages)
    .where(eq(chatMessages.userId, userId));
}


// ============ PROJECT SHARES OPERATIONS ============

export async function createProjectShare(share: InsertProjectShare): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projectShares).values(share);
  return Number(result[0].insertId);
}

export async function getProjectShare(shareToken: string): Promise<ProjectShare | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select()
    .from(projectShares)
    .where(eq(projectShares.shareToken, shareToken))
    .limit(1);

  return result[0];
}

export async function getProjectShares(projectId: number): Promise<ProjectShare[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(projectShares)
    .where(eq(projectShares.projectId, projectId))
    .orderBy(desc(projectShares.createdAt));
}

export async function updateShareViewCount(shareId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current share
  const share = await db.select()
    .from(projectShares)
    .where(eq(projectShares.id, shareId))
    .limit(1);

  if (share[0]) {
    await db.update(projectShares)
      .set({ 
        viewCount: share[0].viewCount + 1,
        lastAccessedAt: new Date()
      })
      .where(eq(projectShares.id, shareId));
  }
}

export async function deleteProjectShare(shareId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(projectShares)
    .where(eq(projectShares.id, shareId));
}

export async function deleteExpiredShares(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  await db.delete(projectShares)
    .where(and(
      eq(projectShares.expiresAt, now),
      // Only delete if expiresAt is in the past
    ));
}
