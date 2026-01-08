import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  apiKeys, InsertApiKey, ApiKey,
  projects, InsertProject, Project,
  documents, InsertDocument, Document
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
