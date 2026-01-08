import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Share2, Copy, Trash2, Eye, Download, Lock, Unlock, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ShareManagerProps = {
  projectId: number;
};

export default function ShareManager({ projectId }: ShareManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<"view" | "download">("view");
  const [expiresInDays, setExpiresInDays] = useState<string>("");

  const { data: shares, refetch } = trpc.shares.list.useQuery({ projectId });

  const createMutation = trpc.shares.create.useMutation({
    onSuccess: (data) => {
      toast.success("Link de compartilhamento criado!");
      // Copy to clipboard
      navigator.clipboard.writeText(data.shareUrl);
      toast.info("Link copiado para a área de transferência!");
      setIsOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.shares.delete.useMutation({
    onSuccess: () => {
      toast.success("Compartilhamento revogado!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setIsPublic(true);
    setPassword("");
    setPermissions("view");
    setExpiresInDays("");
  };

  const handleCreate = () => {
    if (!isPublic && !password) {
      toast.error("Senha é obrigatória para links privados");
      return;
    }

    createMutation.mutate({
      projectId,
      isPublic,
      password: isPublic ? undefined : password,
      permissions,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
    });
  };

  const handleCopy = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  };

  const handleDelete = (shareId: number) => {
    if (confirm("Tem certeza que deseja revogar este compartilhamento?")) {
      deleteMutation.mutate({ shareId });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Compartilhamentos</h3>
          <p className="text-sm text-slate-400">Gerencie links de compartilhamento deste projeto</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
              <Share2 className="h-4 w-4 mr-2" />
              Criar Link
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Criar Link de Compartilhamento</DialogTitle>
              <DialogDescription className="text-slate-400">
                Configure as opções de compartilhamento para este projeto
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Public/Private Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-white">Link Público</Label>
                  <p className="text-sm text-slate-400">
                    {isPublic ? "Qualquer pessoa com o link pode acessar" : "Requer senha para acessar"}
                  </p>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              {/* Password (if private) */}
              {!isPublic && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite uma senha"
                    className="bg-slate-700/50 border-slate-600 text-white"
                  />
                </div>
              )}

              {/* Permissions */}
              <div className="space-y-2">
                <Label htmlFor="permissions">Permissões</Label>
                <Select value={permissions} onValueChange={(v: "view" | "download") => setPermissions(v)}>
                  <SelectTrigger id="permissions" className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="view">Apenas Visualizar</SelectItem>
                    <SelectItem value="download">Visualizar e Baixar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Expiration */}
              <div className="space-y-2">
                <Label htmlFor="expires">Expiração (opcional)</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="expires" className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Nunca expira" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="">Nunca expira</SelectItem>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  resetForm();
                }}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Link"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Shares List */}
      {shares && shares.length > 0 ? (
        <div className="space-y-3">
          {shares.map((share) => (
            <Card key={share.id} className="bg-slate-700/50 border-slate-600 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {share.isPublic === 1 ? (
                      <Unlock className="h-4 w-4 text-green-400" />
                    ) : (
                      <Lock className="h-4 w-4 text-yellow-400" />
                    )}
                    <span className="text-sm font-medium text-white">
                      {share.isPublic === 1 ? "Link Público" : "Link Privado"}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    {share.permissions === "view" ? (
                      <Eye className="h-3 w-3 text-slate-400" />
                    ) : (
                      <Download className="h-3 w-3 text-slate-400" />
                    )}
                    <span className="text-xs text-slate-400">
                      {share.permissions === "view" ? "Visualizar" : "Baixar"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>{share.viewCount} visualizações</span>
                    {share.expiresAt && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Expira em {format(new Date(share.expiresAt), "dd/MM/yyyy")}</span>
                        </div>
                      </>
                    )}
                    <span>•</span>
                    <span>Criado em {format(new Date(share.createdAt), "dd/MM/yyyy")}</span>
                  </div>

                  <code className="block text-xs bg-slate-800 p-2 rounded text-violet-400 break-all">
                    {window.location.origin}/share/{share.shareToken}
                  </code>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(share.shareToken)}
                    className="text-slate-400 hover:text-white h-8 w-8"
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(share.id)}
                    className="text-slate-400 hover:text-red-400 h-8 w-8"
                    title="Revogar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-slate-700/30 border-slate-600 border-dashed p-8">
          <div className="text-center">
            <Share2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 mb-2">Nenhum compartilhamento ativo</p>
            <p className="text-slate-500 text-sm">
              Crie um link para compartilhar este projeto com outras pessoas
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
