import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Upload, FileAudio, X, Loader2, Copy, Download, Mic, Trash2, Clock, FileText } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const ACCEPTED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg'];

export default function QuickTranscribe() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const uploadAudio = trpc.upload.audio.useMutation();
  
  const { data: history = [], isLoading: loadingHistory } = trpc.transcription.list.useQuery({
    limit: 50,
  });

  const saveTranscription = trpc.transcription.save.useMutation({
    onSuccess: () => {
      utils.transcription.list.invalidate();
      toast.success("Transcrição salva no histórico!");
    },
  });

  const deleteTranscription = trpc.transcription.delete.useMutation({
    onSuccess: () => {
      utils.transcription.list.invalidate();
      toast.success("Transcrição removida do histórico!");
    },
  });

  const transcribeMutation = trpc.transcription.transcribe.useMutation({
    onSuccess: async (data) => {
      setTranscription(data.text);
      setDetectedLanguage(data.language);
      toast.success("Transcrição concluída!");
      
      // Save to history automatically
      if (file) {
        const audioUrl = await uploadAudio.mutateAsync({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type,
          base64Data: await fileToBase64(file),
        });
        
        await saveTranscription.mutateAsync({
          audioUrl: audioUrl.url,
          audioFilename: file.name,
          transcription: data.text,
          language: data.language,
          duration: data.duration,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    onSettled: () => {
      setIsTranscribing(false);
    },
  });

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
      toast.error("Formato inválido. Use WAV, MP3, WebM ou OGG.");
      return;
    }
    
    setFile(selectedFile);
    setTranscription(null);
    setDetectedLanguage(null);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleTranscribe = async () => {
    if (!file) return;

    setIsTranscribing(true);

    try {
      const base64Data = await fileToBase64(file);
      
      const uploadResult = await uploadAudio.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        base64Data,
      });

      await transcribeMutation.mutateAsync({
        audioUrl: uploadResult.url,
      });
    } catch (error) {
      toast.error("Erro ao processar áudio");
      setIsTranscribing(false);
    }
  };

  const handleCopy = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      toast.success("Transcrição copiada!");
    }
  };

  const handleDownload = () => {
    if (transcription && file) {
      const blob = new Blob([transcription], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name.replace(/\.[^/.]+$/, "")}-transcricao.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = (transcriptionId: number) => {
    if (confirm("Deseja remover esta transcrição do histórico?")) {
      deleteTranscription.mutate({ transcriptionId });
    }
  };

  const handleCopyFromHistory = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Transcrição copiada!");
  };

  const handleDownloadFromHistory = (transcription: string, filename: string) => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}-transcricao.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredHistory = history.filter((item) =>
    item.audioFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.transcription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transcrição Rápida</h1>
          <p className="text-muted-foreground mt-2">
            Transcreva áudios rapidamente sem gerar documentação completa
          </p>
        </div>

        <Tabs defaultValue="transcribe" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="transcribe">
              <Mic className="w-4 h-4 mr-2" />
              Nova Transcrição
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transcribe" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Áudio</CardTitle>
                <CardDescription>
                  Envie um arquivo de áudio para transcrever (WAV, MP3, WebM, OGG)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
                    ${isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FORMATS.join(',')}
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) validateAndSetFile(selectedFile);
                    }}
                    className="hidden"
                  />
                  
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileAudio className="w-8 h-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setTranscription(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                      <p className="text-lg font-medium">Arraste um arquivo ou clique para selecionar</p>
                      <p className="text-sm text-muted-foreground">
                        Formatos aceitos: WAV, MP3, WebM, OGG
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleTranscribe}
                  disabled={!file || isTranscribing}
                  className="w-full"
                  size="lg"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Transcrevendo...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Transcrever Áudio
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {transcription && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Transcrição</CardTitle>
                      {detectedLanguage && (
                        <CardDescription>Idioma detectado: {detectedLanguage}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Baixar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <p className="whitespace-pre-wrap">{transcription}</p>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Transcrições</CardTitle>
                <CardDescription>
                  Suas transcrições anteriores salvas automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Buscar por nome de arquivo ou conteúdo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? "Nenhuma transcrição encontrada" : "Nenhuma transcrição no histórico"}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {filteredHistory.map((item) => (
                        <Card key={item.id}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <CardTitle className="text-base">{item.audioFilename}</CardTitle>
                                <CardDescription>
                                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                                  {item.language && ` • ${item.language}`}
                                  {item.duration && ` • ${Math.floor(item.duration / 60)}min ${item.duration % 60}s`}
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyFromHistory(item.transcription)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDownloadFromHistory(item.transcription, item.audioFilename)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {item.transcription}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
