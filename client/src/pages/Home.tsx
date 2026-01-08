import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileAudio, FolderOpen, Settings, ArrowRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = trpc.projects.list.useQuery({ limit: 5 });
  const { data: apiKeyStatus } = trpc.apiKeys.getStatus.useQuery();

  const recentProjects = projects ?? [];
  const completedCount = recentProjects.filter(p => p.status === "completed").length;
  const processingCount = recentProjects.filter(p => !["completed", "failed", "pending"].includes(p.status)).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Bem-vindo ao Wave2MD. Transforme áudios em documentação.</p>
        </div>

        {/* API Key Warning */}
        {apiKeyStatus && !apiKeyStatus.openrouter && (
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-amber-200 font-medium">Configure sua API Key</p>
                <p className="text-amber-300/70 text-sm">Você precisa configurar sua chave do OpenRouter para processar áudios.</p>
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card 
            className="bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border-violet-500/30 cursor-pointer hover:border-violet-400/50 transition-colors"
            onClick={() => setLocation("/new")}
          >
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center mb-2">
                <FileAudio className="h-5 w-5 text-violet-400" />
              </div>
              <CardTitle className="text-white text-lg">Novo Projeto</CardTitle>
              <CardDescription className="text-slate-400">
                Faça upload de um áudio e gere documentação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-violet-400 hover:text-violet-300 p-0 h-auto">
                Começar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
            onClick={() => setLocation("/projects")}
          >
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center mb-2">
                <FolderOpen className="h-5 w-5 text-slate-400" />
              </div>
              <CardTitle className="text-white text-lg">Meus Projetos</CardTitle>
              <CardDescription className="text-slate-400">
                Visualize e gerencie seus projetos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-slate-400 hover:text-slate-300 p-0 h-auto">
                Ver todos <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="bg-slate-800/50 border-slate-700 cursor-pointer hover:border-slate-600 transition-colors"
            onClick={() => setLocation("/settings")}
          >
            <CardHeader className="pb-2">
              <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center mb-2">
                <Settings className="h-5 w-5 text-slate-400" />
              </div>
              <CardTitle className="text-white text-lg">Configurações</CardTitle>
              <CardDescription className="text-slate-400">
                Gerencie suas API keys e preferências
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="text-slate-400 hover:text-slate-300 p-0 h-auto">
                Configurar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{completedCount}</p>
                  <p className="text-slate-400 text-sm">Projetos Concluídos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{processingCount}</p>
                  <p className="text-slate-400 text-sm">Em Processamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <FolderOpen className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{recentProjects.length}</p>
                  <p className="text-slate-400 text-sm">Total de Projetos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Projetos Recentes</CardTitle>
                <CardDescription className="text-slate-400">Seus últimos projetos processados</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                className="text-violet-400 hover:text-violet-300"
                onClick={() => setLocation("/projects")}
              >
                Ver todos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-8">
                <FileAudio className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nenhum projeto ainda</p>
                <Button 
                  variant="link" 
                  className="text-violet-400 mt-2"
                  onClick={() => setLocation("/new")}
                >
                  Criar primeiro projeto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map(project => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        project.status === 'completed' ? 'bg-green-500/20' :
                        project.status === 'failed' ? 'bg-red-500/20' :
                        'bg-blue-500/20'
                      }`}>
                        {project.status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : project.status === 'failed' ? (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{project.name}</p>
                        <p className="text-slate-400 text-sm">
                          {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        project.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        project.status === 'pending' ? 'bg-slate-500/20 text-slate-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {project.status === 'completed' ? 'Concluído' :
                         project.status === 'failed' ? 'Falhou' :
                         project.status === 'pending' ? 'Pendente' :
                         'Processando'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
