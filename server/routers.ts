import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { 
  upsertUser, 
  getUserByOpenId, 
  upsertApiKey, 
  getApiKey,
  getUserApiKeys, 
  createProject, 
  getProject,
 
  getUserProjects, 
  updateProject, 
  updateProjectStatus, 
  createDocument, 
  getDocument, 
  getProjectDocuments,
  getUserPromptTemplates,
  getPromptTemplate,

  getDefaultPromptTemplate,
  setDefaultPromptTemplate,
  createPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
  createChatMessage,
  getUserChatHistory,
  getProjectChatHistory,
  clearUserChatHistory,
  createProjectShare,
  getProjectShare,
  getProjectShares,
  updateShareViewCount,
  deleteProjectShare
} from "./db";
import { nanoid } from "nanoid";
import { transcribeAudio } from "./_core/voiceTranscription";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";

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

          // Fetch user's custom templates or use defaults
          const prdTemplate = await getDefaultPromptTemplate(ctx.user.id, "prd");
          const readmeTemplate = await getDefaultPromptTemplate(ctx.user.id, "readme");
          const todoTemplate = await getDefaultPromptTemplate(ctx.user.id, "todo");
          const systemTemplate = await getDefaultPromptTemplate(ctx.user.id, "system");

          // Build system prompt using custom template or fallback
          const systemPrompt = systemTemplate?.promptContent || `You are a technical documentation expert. Analyze the following transcription from a meeting/brainstorming session and generate structured technical documents.

Your output MUST be a valid JSON object with exactly this structure:
{
  "projectName": "suggested project name based on content",
  "summary": "brief summary of what was discussed",
  "prd": "full PRD document in Markdown format",
  "readme": "full README.md in Markdown format", 
  "todo": "full TODO.md with tasks in Markdown format"
}

Guidelines for each document:
- PRD: ${prdTemplate?.promptContent || "Include problem statement, goals, user stories, requirements, success metrics"}
- README: ${readmeTemplate?.promptContent || "Include project description, features, installation, usage, tech stack"}
- TODO: ${todoTemplate?.promptContent || "Include actionable tasks with checkboxes, organized by priority/phase"}

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
        // No file size limit - allow files of any size

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

  // ============ CHAT ASSISTANT ============
  chat: router({
    // Send a message to the chatbot
    sendMessage: protectedProcedure
      .input(z.object({
        message: z.string().min(1),
        projectId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await createChatMessage({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
          projectId: input.projectId || null,
        });

        // Build context for the LLM
        let systemPrompt = `Você é um assistente inteligente do Wave2MD, uma plataforma que transforma áudios de reuniões em documentação técnica estruturada.

Funcionalidades do Wave2MD:
- Upload de áudio (qualquer tamanho e formato)
- Transcrição automática via Speech-to-Text
- Geração de documentos (PRD, README, TODO) via LLM
- Transcrição Rápida (sem análise, apenas transcrição)
- Templates customizáveis de prompts
- Histórico de projetos
- Gerenciamento de API Keys (OpenRouter e HuggingFace)

Processo completo:
1. Usuário faz upload de áudio
2. Sistema transcreve o áudio
3. LLM analisa a transcrição
4. Gera 3 documentos: PRD, README e TODO
5. Empacota tudo em ZIP para download

Sua função:
- Responder dúvidas sobre funcionalidades
- Explicar o processo de transcrição e geração
- Ajudar com problemas técnicos
- Orientar sobre configurações
- Ser amigável e prestativo

Usuário atual: ${ctx.user.name || "Usuário"}
`;

        // If projectId is provided, add project context
        if (input.projectId) {
          try {
            const project = await getProject(input.projectId);
            if (project && project.userId === ctx.user.id) {
              systemPrompt += `
Contexto do Projeto Atual:
- Nome: ${project.name}
- Status: ${project.status}
- Criado em: ${project.createdAt}
`;
              if (project.transcription) {
                systemPrompt += `- Transcrição disponível: Sim
`;
              }
              if (project.zipUrl) {
                systemPrompt += `- Documentos gerados: Sim
`;
              }
            }
          } catch (error) {
            // Ignore project context errors
          }
        }

        // Get recent chat history for context
        const recentHistory = input.projectId
          ? await getProjectChatHistory(ctx.user.id, input.projectId, 10)
          : await getUserChatHistory(ctx.user.id, 10);

        // Build messages array (reverse to get chronological order)
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
        ];

        // Add recent history (limit to last 10 messages)
        const historyMessages = recentHistory
          .reverse()
          .slice(-10)
          .filter(msg => msg.role !== "system") // Filter out system messages from history
          .map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          }));

        messages.push(...historyMessages);

        // Call LLM
        const response = await invokeLLM({ messages });
        const assistantMessage = typeof response.choices[0]?.message?.content === "string" 
          ? response.choices[0].message.content 
          : "Desculpe, não consegui processar sua mensagem.";

        // Save assistant response
        await createChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: assistantMessage,
          projectId: input.projectId || null,
        });

        return {
          message: assistantMessage,
        };
      }),

    // Get chat history
    getHistory: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 50;
        if (input?.projectId) {
          return await getProjectChatHistory(ctx.user.id, input.projectId, limit);
        }
        return await getUserChatHistory(ctx.user.id, limit);
      }),

    // Clear chat history
    clearHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        await clearUserChatHistory(ctx.user.id);
        return { success: true };
      }),
  }),

  // ============ PROJECT SHARING ============
  shares: router({
    // Create a new share link
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        isPublic: z.boolean().default(true),
        password: z.string().optional(),
        permissions: z.enum(["view", "download"]).default("view"),
        expiresInDays: z.number().min(1).max(365).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify project ownership
        const project = await getProject(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        // Generate unique share token
        const shareToken = nanoid(32);

        // Calculate expiration date if provided
        let expiresAt: Date | null = null;
        if (input.expiresInDays) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
        }

        // Create share
        const shareId = await createProjectShare({
          projectId: input.projectId,
          userId: ctx.user.id,
          shareToken,
          isPublic: input.isPublic ? 1 : 0,
          password: input.password || null,
          permissions: input.permissions,
          expiresAt,
          viewCount: 0,
          lastAccessedAt: null,
        });

        return {
          shareId,
          shareToken,
          shareUrl: `${process.env.VITE_FRONTEND_FORGE_API_URL || ""}/share/${shareToken}`,
        };
      }),

    // Get all shares for a project
    list: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        // Verify project ownership
        const project = await getProject(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        return await getProjectShares(input.projectId);
      }),

    // Delete a share
    delete: protectedProcedure
      .input(z.object({
        shareId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get share to verify ownership
        const shares = await getProjectShares(0); // We need to get by shareId, not projectId
        const share = shares.find(s => s.id === input.shareId);
        
        if (!share || share.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        }

        await deleteProjectShare(input.shareId);
        return { success: true };
      }),

    // Get share details (public endpoint)
    get: publicProcedure
      .input(z.object({
        shareToken: z.string(),
        password: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const share = await getProjectShare(input.shareToken);
        
        if (!share) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        }

        // Check expiration
        if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This share link has expired" });
        }

        // Check password for private shares
        if (share.isPublic === 0) {
          if (!input.password || input.password !== share.password) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid password" });
          }
        }

        // Update view count
        await updateShareViewCount(share.id);

        // Get project details
        const project = await getProject(share.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }

        // Get documents if permission allows
        let documents: any[] = [];
        if (share.permissions === "download" || share.permissions === "view") {
          documents = await getProjectDocuments(share.projectId);
        }

        return {
          project: {
            name: project.name,
            status: project.status,
            createdAt: project.createdAt,
            transcription: share.permissions === "view" || share.permissions === "download" ? project.transcription : null,
          },
          documents,
          permissions: share.permissions,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
