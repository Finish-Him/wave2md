import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Upload, FileAudio, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const ACCEPTED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: apiKeyStatus } = trpc.apiKeys.getStatus.useQuery();
  const createProject = trpc.projects.create.useMutation();
  const processProject = trpc.projects.process.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    if (!ACCEPTED_FORMATS.includes(selectedFile.type)) {
      toast.error("Formato inválido. Use WAV ou MP3.");
      return;
    }
    
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 16MB.");
      return;
    }

    setFile(selectedFile);
    
    // Auto-generate project name from filename if empty
    if (!projectName) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setProjectName(nameWithoutExt);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async () => {
    if (!file || !projectName.trim()) {
      toast.error("Preencha o nome do projeto e selecione um arquivo.");
      return;
    }

    if (!apiKeyStatus?.openrouter) {
      toast.error("Configure sua API Key do OpenRouter primeiro.");
      setLocation("/settings");
      return;
    }

    try {
      setIsUploading(true);
      setProcessingStatus("Fazendo upload do áudio...");
      setUploadProgress(10);

      // Upload file to S3 using fetch to the storage endpoint
      const formData = new FormData();
      formData.append('file', file);

      // For now, we'll use a simulated upload - in production this would go to S3
      // The actual S3 upload would be handled by a dedicated endpoint
      const audioUrl = URL.createObjectURL(file); // Temporary - replace with actual S3 URL
      
      setUploadProgress(30);
      setProcessingStatus("Criando projeto...");

      // Create project
      const { projectId } = await createProject.mutateAsync({
        name: projectName.trim(),
        audioUrl: audioUrl,
        audioFileName: file.name,
        audioFileSize: file.size,
      });

      setUploadProgress(50);
      setProcessingStatus("Processando áudio...");

      // Start processing
      await processProject.mutateAsync({ projectId });

      setUploadProgress(100);
      setProcessingStatus("Concluído!");
      
      toast.success("Projeto criado com sucesso!");
      
      // Redirect to project page
      setTimeout(() => {
        setLocation(`/projects/${projectId}`);
      }, 1000);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar projeto";
      toast.error(message);
      setProcessingStatus(null);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Novo Projeto</h1>
          <p className="text-slate-400 mt-1">Faça upload de um áudio para gerar documentação técnica.</p>
        </div>

        {/* API Key Warning */}
        {apiKeyStatus && !apiKeyStatus.openrouter && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-amber-200 font-medium">API Key necessária</p>
                <p className="text-amber-300/70 text-sm">Configure sua chave do OpenRouter para continuar.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
                onClick={() => setLocation("/settings")}
              >
                Configurar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Project Form */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Informações do Projeto</CardTitle>
            <CardDescription className="text-slate-400">
              Preencha os dados e faça upload do áudio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="projectName" className="text-slate-300">Nome do Projeto</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: Reunião de Planejamento Sprint 10"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                disabled={isUploading}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-slate-300">Arquivo de Áudio</Label>
              
              {!file ? (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging 
                      ? 'border-violet-500 bg-violet-500/10' 
                      : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".wav,.mp3,audio/wav,audio/mpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-violet-400' : 'text-slate-500'}`} />
                  <p className="text-slate-300 font-medium">
                    Arraste e solte seu arquivo aqui
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    ou clique para selecionar
                  </p>
                  <p className="text-slate-600 text-xs mt-3">
                    Formatos aceitos: WAV, MP3 (máx. 16MB)
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                  <div className="h-12 w-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <FileAudio className="h-6 w-6 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{file.name}</p>
                    <p className="text-slate-400 text-sm">{formatFileSize(file.size)}</p>
                  </div>
                  {!isUploading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-red-400"
                      onClick={removeFile}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Processing Status */}
            {isUploading && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {uploadProgress < 100 ? (
                    <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  )}
                  <span className="text-slate-300">{processingStatus}</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!file || !projectName.trim() || isUploading || !apiKeyStatus?.openrouter}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FileAudio className="mr-2 h-4 w-4" />
                  Criar Projeto e Processar
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="pt-6">
            <h3 className="text-white font-medium mb-3">O que acontece após o upload?</h3>
            <ol className="space-y-2 text-slate-400 text-sm">
              <li className="flex items-start gap-2">
                <span className="bg-violet-500/20 text-violet-400 rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                <span>Seu áudio é transcrito usando Speech-to-Text avançado</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-violet-500/20 text-violet-400 rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                <span>A transcrição é analisada por IA para extrair requisitos e tarefas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-violet-500/20 text-violet-400 rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                <span>Documentos PRD, README e TODO são gerados automaticamente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-violet-500/20 text-violet-400 rounded-full h-5 w-5 flex items-center justify-center text-xs shrink-0 mt-0.5">4</span>
                <span>Você pode visualizar, editar e baixar os documentos</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
