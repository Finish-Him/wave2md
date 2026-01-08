import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Copy, Lock, Loader2, AlertCircle } from "lucide-react";
import { useParams } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function SharedProject() {
  const params = useParams<{ token: string }>();
  const shareToken = params.token || "";
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  const { data, isLoading, error, refetch } = trpc.shares.get.useQuery(
    { shareToken, password: isUnlocked ? password : undefined },
    { enabled: shareToken.length > 0 && (isUnlocked || !password), retry: false }
  );

  const handleUnlock = () => {
    if (!password) {
      toast.error("Digite a senha para acessar");
      return;
    }
    setIsUnlocked(true);
    setTimeout(() => refetch(), 100);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  const downloadDocument = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} baixado com sucesso!`);
  };

  // Check if password is required
  const needsPassword = error?.message === "Invalid password" || 
    (error?.message === "Unauthorized" && !isUnlocked);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-violet-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Carregando projeto compartilhado...</p>
        </div>
      </div>
    );
  }

  if (needsPassword && !isUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-white text-2xl">Projeto Protegido</CardTitle>
            <CardDescription className="text-slate-400">
              Este projeto requer uma senha para acessar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="Digite a senha"
                className="bg-slate-700/50 border-slate-600 text-white"
              />
            </div>
            <Button
              onClick={handleUnlock}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              Desbloquear
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <CardTitle className="text-white text-2xl">Link Inválido</CardTitle>
            <CardDescription className="text-slate-400">
              {error?.message || "Este link de compartilhamento não existe ou expirou"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { project, documents, permissions } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container max-w-5xl py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 mb-2">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{project.name}</h1>
          <p className="text-slate-400">
            Projeto compartilhado via Wave2MD
          </p>
        </div>

        {/* Documents */}
        {documents.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Documentos</CardTitle>
              <CardDescription className="text-slate-400">
                {permissions === "download" 
                  ? "Visualize e baixe os documentos gerados" 
                  : "Visualize os documentos gerados"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={documents[0]?.type || "prd"} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-700/50">
                  {documents.map((doc) => (
                    <TabsTrigger
                      key={doc.type}
                      value={doc.type}
                      className="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                    >
                      {doc.type.toUpperCase()}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {documents.map((doc) => (
                  <TabsContent key={doc.type} value={doc.type} className="space-y-4 mt-4">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-600 text-slate-300"
                        onClick={() => copyToClipboard(doc.content, doc.type.toUpperCase())}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar
                      </Button>
                      {permissions === "download" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-600 text-slate-300"
                          onClick={() => downloadDocument(doc.content, `${doc.type}.md`)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Baixar
                        </Button>
                      )}
                    </div>

                    <div className="bg-slate-900 rounded-lg p-6 prose prose-invert prose-slate max-w-none">
                      <Streamdown>{doc.content}</Streamdown>
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

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm">
          <p>Powered by Wave2MD - Transforme áudios em documentação</p>
        </div>
      </div>
    </div>
  );
}
