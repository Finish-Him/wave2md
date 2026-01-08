import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Key, CheckCircle2, XCircle, Loader2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [huggingFaceKey, setHuggingFaceKey] = useState("");
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [showHuggingFace, setShowHuggingFace] = useState(false);

  const { data: apiKeyStatus, isLoading, refetch } = trpc.apiKeys.getStatus.useQuery();
  
  const saveOpenRouter = trpc.apiKeys.saveOpenRouter.useMutation({
    onSuccess: () => {
      toast.success("Chave do OpenRouter salva com sucesso!");
      setOpenRouterKey("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const saveHuggingFace = trpc.apiKeys.saveHuggingFace.useMutation({
    onSuccess: () => {
      toast.success("Chave do Hugging Face salva com sucesso!");
      setHuggingFaceKey("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSaveOpenRouter = () => {
    if (!openRouterKey.trim()) {
      toast.error("Digite uma chave válida");
      return;
    }
    saveOpenRouter.mutate({ apiKey: openRouterKey.trim() });
  };

  const handleSaveHuggingFace = () => {
    if (!huggingFaceKey.trim()) {
      toast.error("Digite uma chave válida");
      return;
    }
    saveHuggingFace.mutate({ apiKey: huggingFaceKey.trim() });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-slate-400 mt-1">Gerencie suas chaves de API e preferências.</p>
        </div>

        {/* OpenRouter API Key */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Key className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-white">OpenRouter API Key</CardTitle>
                  <CardDescription className="text-slate-400">
                    Necessária para análise de IA e geração de documentos
                  </CardDescription>
                </div>
              </div>
              {isLoading ? (
                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
              ) : apiKeyStatus?.openrouter ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Configurada</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span className="text-sm">Não configurada</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openRouterKey" className="text-slate-300">
                {apiKeyStatus?.openrouter ? "Atualizar chave" : "Adicionar chave"}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="openRouterKey"
                    type={showOpenRouter ? "text" : "password"}
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenRouter(!showOpenRouter)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showOpenRouter ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveOpenRouter}
                  disabled={!openRouterKey.trim() || saveOpenRouter.isPending}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {saveOpenRouter.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <ExternalLink className="h-4 w-4" />
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-violet-400 transition-colors"
              >
                Obter chave no OpenRouter
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Hugging Face API Key */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Key className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Hugging Face API Key</CardTitle>
                  <CardDescription className="text-slate-400">
                    Opcional - para integrações futuras com modelos HF
                  </CardDescription>
                </div>
              </div>
              {isLoading ? (
                <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
              ) : apiKeyStatus?.huggingface ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm">Configurada</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-500">
                  <XCircle className="h-5 w-5" />
                  <span className="text-sm">Opcional</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="huggingFaceKey" className="text-slate-300">
                {apiKeyStatus?.huggingface ? "Atualizar chave" : "Adicionar chave"}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="huggingFaceKey"
                    type={showHuggingFace ? "text" : "password"}
                    value={huggingFaceKey}
                    onChange={(e) => setHuggingFaceKey(e.target.value)}
                    placeholder="hf_..."
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHuggingFace(!showHuggingFace)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showHuggingFace ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleSaveHuggingFace}
                  disabled={!huggingFaceKey.trim() || saveHuggingFace.isPending}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {saveHuggingFace.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar"
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <ExternalLink className="h-4 w-4" />
              <a 
                href="https://huggingface.co/settings/tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-amber-400 transition-colors"
              >
                Obter token no Hugging Face
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="pt-6">
            <h3 className="text-white font-medium mb-3">Sobre as API Keys</h3>
            <div className="space-y-3 text-slate-400 text-sm">
              <p>
                <strong className="text-slate-300">OpenRouter:</strong> Usada para acessar modelos de IA como GPT-4 para analisar suas transcrições e gerar documentação técnica estruturada.
              </p>
              <p>
                <strong className="text-slate-300">Hugging Face:</strong> Reservada para integrações futuras com modelos open-source e o Space Wave2MD.
              </p>
              <p className="text-slate-500 text-xs mt-4">
                Suas chaves são armazenadas de forma segura e nunca são expostas no frontend.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
