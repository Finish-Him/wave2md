import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { MessageCircle, X, Send, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

type ChatBotProps = {
  projectId?: number;
};

export default function ChatBot({ projectId }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: history, refetch } = trpc.chat.getHistory.useQuery(
    { projectId },
    { enabled: isOpen }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
      // Scroll to bottom after new message
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const clearMutation = trpc.chat.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Histórico limpo com sucesso!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSend = () => {
    if (!message.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ message: message.trim(), projectId });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Reverse history to show oldest first
  const messages = history ? [...history].reverse() : [];

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 z-50"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl bg-slate-800 border-slate-700 z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Assistente Wave2MD</h3>
                <p className="text-xs text-slate-400">Sempre pronto para ajudar</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja limpar o histórico?")) {
                      clearMutation.mutate();
                    }
                  }}
                  className="text-slate-400 hover:text-red-400 h-8 w-8"
                  title="Limpar histórico"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 mb-2">Olá! Como posso ajudar?</p>
                <p className="text-slate-500 text-sm">
                  Pergunte sobre funcionalidades, processo de transcrição ou qualquer dúvida sobre o Wave2MD.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                          : "bg-slate-700 text-slate-100"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {sendMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-slate-700 rounded-lg p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                      <span className="text-sm text-slate-300">Pensando...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={sendMutation.isPending}
                className="flex-1 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                size="icon"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
