import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileAudio, FolderOpen, CheckCircle2, Clock, AlertCircle, ArrowRight, Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function Projects() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = trpc.projects.list.useQuery({ limit: 50 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'failed': return 'bg-red-500/20 text-red-400';
      case 'pending': return 'bg-slate-500/20 text-slate-400';
      default: return 'bg-blue-500/20 text-blue-400';
    }
  };

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
      case 'transcribing': return 'Transcrevendo';
      case 'analyzing': return 'Analisando';
      case 'generating': return 'Gerando';
      case 'packaging': return 'Empacotando';
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Meus Projetos</h1>
            <p className="text-slate-400 mt-1">Gerencie todos os seus projetos de documentação.</p>
          </div>
          <Button 
            onClick={() => setLocation("/new")}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Projeto
          </Button>
        </div>

        {/* Projects List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Todos os Projetos</CardTitle>
            <CardDescription className="text-slate-400">
              {projects?.length ?? 0} projeto(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : !projects || projects.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-medium text-lg mb-2">Nenhum projeto ainda</h3>
                <p className="text-slate-400 mb-4">Comece criando seu primeiro projeto de documentação.</p>
                <Button 
                  onClick={() => setLocation("/new")}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <FileAudio className="mr-2 h-4 w-4" />
                  Criar Primeiro Projeto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 cursor-pointer transition-colors group"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${
                        project.status === 'completed' ? 'bg-green-500/20' :
                        project.status === 'failed' ? 'bg-red-500/20' :
                        'bg-blue-500/20'
                      }`}>
                        {getStatusIcon(project.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{project.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-slate-400 text-sm">
                            {new Date(project.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {project.audioFileName && (
                            <p className="text-slate-500 text-sm truncate max-w-[200px]">
                              {project.audioFileName}
                            </p>
                          )}
                        </div>
                        {/* Progress bar for non-completed projects */}
                        {project.status !== 'completed' && project.status !== 'failed' && project.status !== 'pending' && (
                          <div className="mt-2 w-full max-w-xs">
                            <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${getProgressColor(project.progress)} transition-all duration-300`}
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getStatusColor(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </span>
                      <ArrowRight className="h-5 w-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
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
