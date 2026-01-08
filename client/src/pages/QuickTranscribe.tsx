import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Upload, FileAudio, X, Loader2, Copy, Download, Mic } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

const ACCEPTED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave', 'audio/webm', 'audio/ogg'];

export default function QuickTranscribe() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadAudio = trpc.upload.audio.useMutation();
  const transcribeMutation = trpc.transcription.transcribe.useMutation({
    onSuccess: (data) => {
      setTranscription(data.text);
      setDetectedLanguage(data.language);
      toast.success("Transcrição concluída!");
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
    
    // No file size limit

    setFile(selectedFile);
    setTranscription(null);
    setDetectedLanguage(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setTranscription(null);
    setDetectedLanguage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleTranscribe = async () => {
    if (!file) {
      toast.error("Selecione um arquivo de áudio.");
      return;
    }

    setIsTranscribing(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to S3
      const { url: audioUrl } = await uploadAudio.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        base64Data,
      });
      
      // Transcribe
      await transcribeMutation.mutateAsync({ audioUrl });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const copyToClipboard = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription);
      toast.success("Transcrição copiada!");
    }
  };

  const downloadTranscription = () => {
    if (transcription) {
      const blob = new Blob([transcription], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file ? `${file.name.replace(/\.[^/.]+$/, "")}_transcricao.txt` : 'transcricao.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Transcrição baixada!");
    }
  };

  const startNewTranscription = () => {
    setFile(null);
    setTranscription(null);
    setDetectedLanguage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Transcrição Rápida</h1>
          <p className="text-slate-400 mt-1">
            Converta áudio em texto rapidamente. Sem análise de IA, sem custo adicional.
          </p>
        </div>

        {/* Info Banner */}
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="flex items-center gap-4 py-4">
            <Mic className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-emerald-200 font-medium">Transcrição gratuita</p>
              <p className="text-emerald-300/70 text-sm">
                Esta funcionalidade não requer API Key. Apenas converte áudio em texto.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Upload de Áudio</CardTitle>
            <CardDescription className="text-slate-400">
              Selecione um arquivo de áudio para transcrever
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-emerald-500 bg-emerald-500/10' 
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
                  accept=".wav,.mp3,.webm,.ogg,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-emerald-400' : 'text-slate-500'}`} />
                <p className="text-slate-300 font-medium">
                  Arraste e solte seu arquivo aqui
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  ou clique para selecionar
                </p>
                <p className="text-slate-600 text-xs mt-3">
                  Formatos aceitos: WAV, MP3, WebM, OGG (sem limite de tamanho)
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <FileAudio className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-slate-400 text-sm">{formatFileSize(file.size)}</p>
                </div>
                {!isTranscribing && !transcription && (
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

            {/* Transcribe Button */}
            {file && !transcription && (
              <Button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transcrevendo...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-4 w-4" />
                    Transcrever Áudio
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Transcription Result */}
        {transcription && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Transcrição</CardTitle>
                  <CardDescription className="text-slate-400">
                    {detectedLanguage && `Idioma detectado: ${detectedLanguage.toUpperCase()}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                    onClick={copyToClipboard}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                    onClick={downloadTranscription}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-900 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {transcription}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-300"
                onClick={startNewTranscription}
              >
                Nova Transcrição
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="pt-6">
            <h3 className="text-white font-medium mb-3">Transcrição Rápida vs Projeto Completo</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-emerald-400 font-medium text-sm">Transcrição Rápida</p>
                <ul className="text-slate-400 text-sm space-y-1">
                  <li>• Apenas converte áudio em texto</li>
                  <li>• Não requer API Key</li>
                  <li>• Resultado instantâneo</li>
                  <li>• Ideal para notas rápidas</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-violet-400 font-medium text-sm">Projeto Completo</p>
                <ul className="text-slate-400 text-sm space-y-1">
                  <li>• Transcrição + Análise de IA</li>
                  <li>• Gera PRD, README, TODO</li>
                  <li>• Requer API Key do OpenRouter</li>
                  <li>• Ideal para documentação técnica</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
