import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, FileText, CheckCircle2, Clock, AlertCircle, 
  Download, Copy, FileAudio, Loader2, RefreshCw
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();

  const { data, isLoading, refetch } = trpc.projects.get.useQuery(
    { projectId },
    { enabled: projectId > 0, refetchInterval: (query) => {
      // Auto-refresh while processing
      const projectData = query.state.data;
      if (projectData?.project?.status && !['completed', 'failed'].includes(projectData.project.status)) {
        return 2000;
      }
      return false;
    }}
  );

  const project = data?.project;
  const documents = data?.documents ?? [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-400" />;
      default: return <Clock className="h-5 w-5 text-blue-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'pending': return 'Pendente';
      case 'transcribing': return 'Transcrevendo áudio...';
      case 'analyzing': return 'Analisando com IA...';
      case 'generating': return 'Gerando documentos...';
      case 'packaging': return 'Empacotando arquivos...';
      default: return status;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress <= 20) return 'bg-red-800';
    if (progress <= 40) return 'bg-red-500';
    if (progress <= 60) return 'bg-yellow-500';
    if (progress <= 80) return 'bg-green-400';
    if (progress < 100) return 'bg-green-600';
    return 'bg-green-500';
  };

  const copyToClipboard = (content: string, docName: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`${docName} copiado para a área de transferência`);
  };

  const downloadDocument = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filename} baixado`);
  };

  const downloadAllDocuments = () => {
    documents.forEach(doc => {
      const filename = doc.type === 'prd' ? 'PRD.md' : 
                       doc.type === 'readme' ? 'README.md' : 
                       doc.type === 'todo' ? 'TODO.md' : `${doc.title}.md`;
      downloadDocument(doc.content, filename);
    });
    toast.success("Todos os documentos baixados");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-white font-medium text-lg mb-2">Projeto não encontrado</h3>
          <Button 
            variant="ghost" 
            className="text-violet-400"
            onClick={() => setLocation("/projects")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para projetos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isProcessing = !['completed', 'failed', 'pending'].includes(project.status);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-slate-400 hover:text-white mt-1"
              onClick={() => setLocation("/projects")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                {getStatusIcon(project.status)}
                <span className="text-slate-400">{getStatusLabel(project.status)}</span>
                {project.detectedLanguage && (
                  <span className="text-slate-500 text-sm">
                    • Idioma: {project.detectedLanguage.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300"
                onClick={() => refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            )}
            {project.status === 'completed' && documents.length > 0 && (
              <Button 
                onClick={downloadAllDocuments}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Todos
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar for Processing */}
        {isProcessing && (
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-4 mb-3">
                <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                <span className="text-blue-200 font-medium">{getStatusLabel(project.status)}</span>
                <span className="text-blue-300/70 text-sm ml-auto">{project.progress}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getProgressColor(project.progress)} transition-all duration-500`}
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {project.status === 'failed' && project.errorMessage && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-red-200 font-medium">Erro no processamento</p>
                  <p className="text-red-300/70 text-sm mt-1">{project.errorMessage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Project Info */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileAudio className="h-5 w-5 text-violet-400" />
                <div>
                  <p className="text-slate-400 text-sm">Arquivo de Áudio</p>
                  <p className="text-white font-medium truncate">{project.audioFileName || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="text-slate-400 text-sm">Criado em</p>
                  <p className="text-white font-medium">
                    {new Date(project.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-green-400" />
                <div>
                  <p className="text-slate-400 text-sm">Documentos Gerados</p>
                  <p className="text-white font-medium">{documents.length} arquivo(s)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents Viewer */}
        {documents.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Documentos Gerados</CardTitle>
              <CardDescription className="text-slate-400">
                Visualize e baixe os documentos gerados a partir do seu áudio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={documents[0]?.type || "prd"} className="w-full">
                <TabsList className="bg-slate-700/50 mb-4">
                  {documents.map(doc => (
                    <TabsTrigger 
                      key={doc.id} 
                      value={doc.type}
                      className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                    >
                      {doc.type === 'prd' ? 'PRD' : 
                       doc.type === 'readme' ? 'README' : 
                       doc.type === 'todo' ? 'TODO' : doc.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {documents.map(doc => (
                  <TabsContent key={doc.id} value={doc.type}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-600 text-slate-300"
                          onClick={() => copyToClipboard(doc.content, doc.title)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-600 text-slate-300"
                          onClick={() => downloadDocument(
                            doc.content, 
                            doc.type === 'prd' ? 'PRD.md' : 
                            doc.type === 'readme' ? 'README.md' : 
                            doc.type === 'todo' ? 'TODO.md' : `${doc.title}.md`
                          )}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Baixar
                        </Button>
                      </div>
                      <div className="bg-slate-900 rounded-lg p-6 max-h-[600px] overflow-y-auto prose prose-invert prose-sm max-w-none">
                        <Streamdown>{doc.content}</Streamdown>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Transcription */}
        {project.transcription && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Transcrição Original</CardTitle>
                  <CardDescription className="text-slate-400">
                    Texto extraído do áudio
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300"
                  onClick={() => copyToClipboard(project.transcription!, "Transcrição")}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {project.transcription}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
