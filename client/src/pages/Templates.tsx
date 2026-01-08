import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Edit, Trash2, Star, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TemplateType = "prd" | "readme" | "todo" | "system";

const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  prd: "PRD (Product Requirements Document)",
  readme: "README",
  todo: "TODO List",
  system: "System Prompt",
};

const TEMPLATE_TYPE_COLORS: Record<TemplateType, string> = {
  prd: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  readme: "bg-green-500/20 text-green-400 border-green-500/30",
  todo: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  system: "bg-violet-500/20 text-violet-400 border-violet-500/30",
};

const DEFAULT_PROMPTS: Record<TemplateType, string> = {
  prd: `Você é um Product Manager experiente. Analise a transcrição fornecida e crie um PRD (Product Requirements Document) completo e estruturado.

O PRD deve incluir:
1. **Visão Geral**: Resumo executivo do projeto
2. **Objetivos**: Metas claras e mensuráveis
3. **Requisitos Funcionais**: Funcionalidades detalhadas
4. **Requisitos Não-Funcionais**: Performance, segurança, escalabilidade
5. **User Stories**: Histórias de usuário no formato "Como [usuário], eu quero [ação] para [benefício]"
6. **Critérios de Aceitação**: Condições para considerar cada funcionalidade completa
7. **Dependências**: Integrações e dependências técnicas
8. **Riscos e Mitigações**: Riscos identificados e planos de mitigação

Formato: Markdown com seções bem estruturadas.`,

  readme: `Você é um Technical Writer especializado em documentação de projetos. Analise a transcrição e crie um README.md completo e profissional.

O README deve incluir:
1. **Título e Descrição**: Nome do projeto e descrição concisa
2. **Funcionalidades**: Lista das principais features
3. **Tecnologias**: Stack tecnológico utilizado
4. **Instalação**: Instruções passo a passo para setup
5. **Uso**: Exemplos de como usar o projeto
6. **Configuração**: Variáveis de ambiente e configurações necessárias
7. **Contribuição**: Guia para contribuidores
8. **Licença**: Informações de licenciamento

Formato: Markdown otimizado para GitHub.`,

  todo: `Você é um Project Manager experiente. Analise a transcrição e crie uma lista TODO estruturada e acionável.

A lista TODO deve incluir:
1. **Tarefas Prioritárias**: Itens críticos que devem ser feitos primeiro
2. **Desenvolvimento**: Tarefas de implementação técnica
3. **Design/UX**: Tarefas relacionadas a interface e experiência
4. **Testes**: Casos de teste e validações necessárias
5. **Documentação**: Itens de documentação pendentes
6. **Deploy**: Tarefas relacionadas a publicação e infraestrutura

Formato: Markdown com checkboxes [ ] para cada item. Agrupe por categoria e prioridade.`,

  system: `Você é um assistente especializado em análise de reuniões e documentação técnica. Sua função é processar transcrições de áudio e extrair informações relevantes para gerar documentação estruturada.

Diretrizes:
- Seja objetivo e direto
- Extraia apenas informações mencionadas na transcrição
- Organize o conteúdo de forma lógica e hierárquica
- Use Markdown para formatação
- Mantenha o tom profissional
- Identifique requisitos, decisões, ações e responsáveis quando mencionados`,
};

export default function Templates() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "prd" as TemplateType,
    promptContent: DEFAULT_PROMPTS.prd,
    isDefault: false,
  });

  const { data: templates, isLoading, refetch } = trpc.templates.list.useQuery();
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Template criado com sucesso!");
      setIsCreateDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      toast.success("Template atualizado com sucesso!");
      setIsEditDialogOpen(false);
      refetch();
      setSelectedTemplate(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template excluído com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const setDefaultMutation = trpc.templates.setDefault.useMutation({
    onSuccess: () => {
      toast.success("Template definido como padrão!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "prd",
      promptContent: DEFAULT_PROMPTS.prd,
      isDefault: false,
    });
  };

  const handleTypeChange = (type: TemplateType) => {
    setFormData({
      ...formData,
      type,
      promptContent: DEFAULT_PROMPTS[type],
    });
  };

  const handleCreate = () => {
    createMutation.mutate(formData);
  };

  const handleEdit = (template: any) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      type: template.type,
      promptContent: template.promptContent,
      isDefault: template.isDefault === 1,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      templateId: selectedTemplate.id,
      ...formData,
    });
  };

  const handleDelete = (templateId: number) => {
    if (confirm("Tem certeza que deseja excluir este template?")) {
      deleteMutation.mutate({ templateId });
    }
  };

  const handleSetDefault = (templateId: number) => {
    setDefaultMutation.mutate({ templateId });
  };

  const groupedTemplates = templates?.reduce((acc, template) => {
    if (!acc[template.type]) {
      acc[template.type] = [];
    }
    acc[template.type].push(template);
    return acc;
  }, {} as Record<TemplateType, any[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Templates de Prompts</h1>
            <p className="text-slate-400 mt-1">Personalize os prompts de geração de documentos</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Plus className="mr-2 h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Criar Novo Template</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Crie um template personalizado para geração de documentos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Nome do Template</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: PRD Detalhado para Features"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Breve descrição do template"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-slate-300">Tipo de Documento</Label>
                  <Select value={formData.type} onValueChange={(value) => handleTypeChange(value as TemplateType)}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {Object.entries(TEMPLATE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key} className="text-white">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promptContent" className="text-slate-300">Conteúdo do Prompt</Label>
                  <Textarea
                    id="promptContent"
                    value={formData.promptContent}
                    onChange={(e) => setFormData({ ...formData, promptContent: e.target.value })}
                    placeholder="Instruções detalhadas para o LLM..."
                    className="bg-slate-700/50 border-slate-600 text-white min-h-[300px] font-mono text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="rounded border-slate-600"
                  />
                  <Label htmlFor="isDefault" className="text-slate-300">Definir como template padrão</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-slate-600 text-slate-300">
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Template"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(TEMPLATE_TYPE_LABELS).map(([type, label]) => {
              const typeTemplates = groupedTemplates?.[type as TemplateType] || [];
              if (typeTemplates.length === 0) return null;

              return (
                <div key={type}>
                  <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
                  <div className="grid gap-4">
                    {typeTemplates.map((template) => (
                      <Card key={template.id} className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-white">{template.name}</CardTitle>
                                {template.isDefault === 1 && (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                                    <Star className="h-3 w-3 mr-1 fill-current" />
                                    Padrão
                                  </Badge>
                                )}
                                <Badge className={TEMPLATE_TYPE_COLORS[template.type as TemplateType]}>
                                  {TEMPLATE_TYPE_LABELS[template.type as TemplateType]}
                                </Badge>
                              </div>
                              {template.description && (
                                <CardDescription className="text-slate-400">{template.description}</CardDescription>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {template.isDefault !== 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSetDefault(template.id)}
                                  className="text-slate-400 hover:text-amber-400"
                                  title="Definir como padrão"
                                >
                                  <Star className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(template)}
                                className="text-slate-400 hover:text-violet-400"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(template.id)}
                                className="text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                            <pre className="text-slate-300 text-sm whitespace-pre-wrap font-mono">
                              {template.promptContent.length > 300
                                ? template.promptContent.substring(0, 300) + "..."
                                : template.promptContent}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="bg-slate-800/30 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-slate-600 mb-4" />
              <p className="text-slate-400 text-center mb-4">
                Nenhum template personalizado ainda.
                <br />
                Crie seu primeiro template para customizar a geração de documentos.
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Template
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Editar Template</DialogTitle>
              <DialogDescription className="text-slate-400">
                Atualize as informações do template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-300">Nome do Template</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-slate-300">Descrição (opcional)</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-promptContent" className="text-slate-300">Conteúdo do Prompt</Label>
                <Textarea
                  id="edit-promptContent"
                  value={formData.promptContent}
                  onChange={(e) => setFormData({ ...formData, promptContent: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white min-h-[300px] font-mono text-sm"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-slate-600"
                />
                <Label htmlFor="edit-isDefault" className="text-slate-300">Definir como template padrão</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-slate-600 text-slate-300">
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
