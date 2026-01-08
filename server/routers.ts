import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { 
  upsertApiKey, 
  getUserApiKeys, 
  getApiKey,
  createProject,
  getProject,
  getUserProjects,
  updateProject,
  updateProjectStatus,
  createDocument,
  getProjectDocuments,
  createPromptTemplate,
  getUserPromptTemplates,
  getPromptTemplate,
  getDefaultPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
  setDefaultPromptTemplate
} from "./db";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ API KEYS MANAGEMENT ============
  apiKeys: router({
    // Get status of user's API keys (without exposing the actual keys)
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      return await getUserApiKeys(ctx.user.id);
    }),

    // Save or update OpenRouter API key
    saveOpenRouter: protectedProcedure
      .input(z.object({ apiKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await upsertApiKey({
          userId: ctx.user.id,
          provider: "openrouter",
          apiKey: input.apiKey,
        });
        return { success: true };
      }),

    // Save or update HuggingFace API key
    saveHuggingFace: protectedProcedure
      .input(z.object({ apiKey: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await upsertApiKey({
          userId: ctx.user.id,
          provider: "huggingface",
          apiKey: input.apiKey,
        });
        return { success: true };
      }),
  }),

  // ============ PROJECTS MANAGEMENT ============
  projects: router({
    // List user's projects
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await getUserProjects(ctx.user.id, input?.limit ?? 50);
      }),

    // Get single project with documents
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        const docs = await getProjectDocuments(input.projectId);
        return { project, documents: docs };
      }),

    // Create new project (upload audio and start processing)
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        audioUrl: z.string().url(),
        audioFileName: z.string(),
        audioFileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user has OpenRouter API key
        const apiKeyStatus = await getUserApiKeys(ctx.user.id);
        if (!apiKeyStatus.openrouter) {
          throw new TRPCError({ 
            code: "PRECONDITION_FAILED", 
            message: "Please configure your OpenRouter API key first" 
          });
        }

        const projectId = await createProject({
          userId: ctx.user.id,
          name: input.name,
          audioUrl: input.audioUrl,
          audioFileName: input.audioFileName,
          audioFileSize: input.audioFileSize,
          status: "pending",
          progress: 0,
        });

        return { projectId };
      }),

    // Process project (run the full pipeline)
    process: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        if (!project.audioUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No audio file uploaded" });
        }

        // Get user's OpenRouter API key
        const openRouterKey = await getApiKey(ctx.user.id, "openrouter");
        if (!openRouterKey) {
          throw new TRPCError({ 
            code: "PRECONDITION_FAILED", 
            message: "OpenRouter API key not configured" 
          });
        }

        try {
          // Step 1: Transcription (0-25%)
          await updateProjectStatus(input.projectId, "transcribing", 5);
          
          const transcriptionResult = await transcribeAudio({
            audioUrl: project.audioUrl,
          });

          // Check if transcription failed
          if ('error' in transcriptionResult) {
            throw new Error(`Transcription failed: ${transcriptionResult.error}`);
          }

          await updateProject(input.projectId, {
            transcription: transcriptionResult.text,
            detectedLanguage: transcriptionResult.language,
          });
          await updateProjectStatus(input.projectId, "transcribing", 25);

          // Step 2: LLM Analysis (25-60%)
          await updateProjectStatus(input.projectId, "analyzing", 30);

          const systemPrompt = `You are a technical documentation expert. Analyze the following transcription from a meeting/brainstorming session and generate structured technical documents.

Your output MUST be a valid JSON object with exactly this structure:
{
  "projectName": "suggested project name based on content",
  "summary": "brief summary of what was discussed",
  "prd": "full PRD document in Markdown format",
  "readme": "full README.md in Markdown format", 
  "todo": "full TODO.md with tasks in Markdown format"
}

Guidelines for each document:
- PRD: Include problem statement, goals, user stories, requirements, success metrics
- README: Include project description, features, installation, usage, tech stack
- TODO: Include actionable tasks with checkboxes, organized by priority/phase

Be thorough and professional. Extract all relevant information from the transcription.`;

          const llmResponse = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Transcription:\n\n${transcriptionResult.text}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "documentation",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    projectName: { type: "string" },
                    summary: { type: "string" },
                    prd: { type: "string" },
                    readme: { type: "string" },
                    todo: { type: "string" },
                  },
                  required: ["projectName", "summary", "prd", "readme", "todo"],
                  additionalProperties: false,
                },
              },
            },
          });

          await updateProjectStatus(input.projectId, "analyzing", 60);

          // Parse LLM response
          const messageContent = llmResponse.choices[0]?.message?.content;
          if (!messageContent) {
            throw new Error("Empty response from LLM");
          }

          // Handle content that might be string or array
          const contentStr = typeof messageContent === 'string' 
            ? messageContent 
            : JSON.stringify(messageContent);

          const generatedDocs = JSON.parse(contentStr);

          // Step 3: Generate documents (60-85%)
          await updateProjectStatus(input.projectId, "generating", 65);

          // Create PRD document
          await createDocument({
            projectId: input.projectId,
            type: "prd",
            title: "Product Requirements Document",
            content: generatedDocs.prd,
          });

          await updateProjectStatus(input.projectId, "generating", 72);

          // Create README document
          await createDocument({
            projectId: input.projectId,
            type: "readme",
            title: "README.md",
            content: generatedDocs.readme,
          });

          await updateProjectStatus(input.projectId, "generating", 79);

          // Create TODO document
          await createDocument({
            projectId: input.projectId,
            type: "todo",
            title: "TODO.md",
            content: generatedDocs.todo,
          });

          await updateProjectStatus(input.projectId, "generating", 85);

          // Step 4: Package ZIP (85-100%)
          await updateProjectStatus(input.projectId, "packaging", 88);

          // Create ZIP content (simple text-based approach)
          const zipContent = {
            "PRD.md": generatedDocs.prd,
            "README.md": generatedDocs.readme,
            "TODO.md": generatedDocs.todo,
            "transcription.txt": transcriptionResult.text,
          };

          // For now, store individual files - ZIP creation would require additional library
          const projectSlug = generatedDocs.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const timestamp = Date.now();
          
          // Store files to S3
          for (const [filename, content] of Object.entries(zipContent)) {
            const fileKey = `projects/${input.projectId}/${projectSlug}-${timestamp}/${filename}`;
            await storagePut(fileKey, content as string, "text/markdown");
          }

          await updateProjectStatus(input.projectId, "packaging", 95);

          // Update project with completion
          await updateProject(input.projectId, {
            name: generatedDocs.projectName || project.name,
          });

          await updateProjectStatus(input.projectId, "completed", 100);

          return { 
            success: true, 
            projectName: generatedDocs.projectName,
            summary: generatedDocs.summary,
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await updateProjectStatus(input.projectId, "failed", 0, errorMessage);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Processing failed: ${errorMessage}`,
          });
        }
      }),
  }),

  // ============ FILE UPLOAD ============
  upload: router({
    // Upload audio file to S3
    audio: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileSize: z.number(),
        contentType: z.string(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate file size (16MB limit)
        if (input.fileSize > 16 * 1024 * 1024) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'File size exceeds 16MB limit',
          });
        }

        // Validate content type
        const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/x-wav', 'audio/wave'];
        if (!allowedTypes.includes(input.contentType)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file type. Supported: WAV, MP3, WebM, OGG',
          });
        }

        try {
          // Convert base64 to buffer
          const buffer = Buffer.from(input.base64Data, 'base64');

          // Generate unique file key
          const timestamp = Date.now();
          const randomSuffix = nanoid(8);
          const fileExtension = input.fileName.split('.').pop();
          const fileKey = `audio/${ctx.user.id}/${timestamp}-${randomSuffix}.${fileExtension}`;

          // Upload to S3
          const { url } = await storagePut(fileKey, buffer, input.contentType);

          return {
            url,
            fileKey,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Upload failed: ${errorMessage}`,
          });
        }
      }),
  }),

  // ============ QUICK TRANSCRIPTION ============
  transcription: router({
    // Quick transcription without LLM analysis
    transcribe: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
        });

        if ('error' in result) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: result.error,
          });
        }

        return {
          text: result.text,
          language: result.language,
          duration: result.duration,
        };
      }),
  }),

  // ============ DOCUMENTS ============
  documents: router({
    // Get documents for a project
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getProject(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return await getProjectDocuments(input.projectId);
      }),
  }),

  // ============ PROMPT TEMPLATES ============
  templates: router({
    // List all templates for the current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return await getUserPromptTemplates(ctx.user.id);
    }),

    // Get a specific template
    get: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getPromptTemplate(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        return template;
      }),

    // Get default template for a specific type
    getDefault: protectedProcedure
      .input(z.object({ type: z.enum(["prd", "readme", "todo", "system"]) }))
      .query(async ({ ctx, input }) => {
        return await getDefaultPromptTemplate(ctx.user.id, input.type);
      }),

    // Create a new template
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["prd", "readme", "todo", "system"]),
        promptContent: z.string().min(1),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const templateId = await createPromptTemplate({
          userId: ctx.user.id,
          name: input.name,
          description: input.description || null,
          type: input.type,
          promptContent: input.promptContent,
          isDefault: input.isDefault ? 1 : 0,
        });

        // If this is set as default, update other templates
        if (input.isDefault) {
          await setDefaultPromptTemplate(ctx.user.id, templateId, input.type);
        }

        return { templateId };
      }),

    // Update a template
    update: protectedProcedure
      .input(z.object({
        templateId: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        promptContent: z.string().min(1).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await getPromptTemplate(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        const updateData: any = {};
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.promptContent !== undefined) updateData.promptContent = input.promptContent;
        if (input.isDefault !== undefined) updateData.isDefault = input.isDefault ? 1 : 0;

        await updatePromptTemplate(input.templateId, updateData);

        // If this is set as default, update other templates
        if (input.isDefault) {
          await setDefaultPromptTemplate(ctx.user.id, input.templateId, template.type);
        }

        return { success: true };
      }),

    // Delete a template
    delete: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getPromptTemplate(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        await deletePromptTemplate(input.templateId);
        return { success: true };
      }),

    // Set a template as default
    setDefault: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const template = await getPromptTemplate(input.templateId);
        if (!template || template.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        await setDefaultPromptTemplate(ctx.user.id, input.templateId, template.type);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
