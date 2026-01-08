# Wave2MD - Project TODO

## Fase 1: Fundação ✅
- [x] Configurar schema do banco de dados (users, projects, api_keys, documents)
- [x] Criar queries helpers no db.ts

## Fase 2: Gerenciamento de API Keys ✅
- [x] Endpoint para salvar/atualizar chave OpenRouter
- [x] Endpoint para salvar/atualizar chave HuggingFace
- [x] Interface de configuração de API keys
- [x] Armazenamento seguro das chaves

## Fase 3: Upload de Áudio ✅
- [x] Interface de upload com drag-and-drop
- [x] Validação de formato (WAV, MP3)
- [x] Upload para S3
- [x] Integração com Manus Speech-to-Text

## Fase 4: Pipeline de Análise LLM ✅
- [x] Integração com Open Router (GPT-4.5 Opus)
- [x] Prompt estruturado para geração de documentos
- [x] Geração de PRD em Markdown
- [x] Geração de README em Markdown
- [x] Geração de TODO em Markdown

## Fase 5: Empacotamento e Download ✅
- [x] Geração de arquivo ZIP com todos os documentos
- [x] Upload do ZIP para S3
- [x] Endpoint de download seguro

## Fase 6: Dashboard ✅
- [x] Lista de projetos processados
- [x] Status de cada projeto
- [x] Acesso rápido aos resultados
- [x] Histórico de processamentos

## Fase 7: Visualizador de Documentos ✅
- [x] Interface com abas para cada documento
- [x] Preview de Markdown renderizado
- [x] Opção de download individual

## Fase 8: Indicadores de Progresso ✅
- [x] Barra de progresso em tempo real
- [x] Status por etapa (transcrição, análise, geração, empacotamento)
- [x] Feedback visual durante carregamento

## Fase 9: Estilização e UX ✅
- [x] Design responsivo (Mobile First)
- [x] Tema visual consistente (Dark mode com violet/indigo)
- [x] Micro-interações e estados vazios
- [x] DashboardLayout com sidebar

## Novas Funcionalidades Implementadas ✅
- [x] Aba "Transcrição Rápida" na sidebar (só transcreve, sem gerar documentos)
- [x] Configuração PWA para Android (manifest, service worker, ícones)
- [x] Instalador PWA no header da aplicação

## Fase 10: Deploy 🚀
- [ ] Checkpoint final
- [ ] Publicação no Manus

## Melhorias Futuras
- [ ] Geração de ícones PNG para PWA (atualmente só SVG)
- [ ] Upload real para S3 (atualmente usando URL temporária)
- [ ] Testes automatizados com Vitest
- [ ] Integração com Hugging Face Space
- [ ] Suporte a mais formatos de áudio (M4A, FLAC)
- [ ] Histórico de transcrições rápidas
- [ ] Edição de documentos gerados
- [ ] Exportação para PDF
- [ ] Compartilhamento de projetos

## Em Desenvolvimento
- [x] Gerar ícones PNG para PWA (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512)

- [x] Implementar endpoint de upload real para S3 (/api/upload)
- [x] Atualizar frontend para usar o novo endpoint de upload

## Novas Funcionalidades Concluídas
- [x] Implementar indicador de progresso real durante upload para S3
- [x] Criar sistema de templates de prompts customizáveis
- [x] Adicionar interface de gerenciamento de templates
- [x] Salvar templates no banco de dados por usuário
- [x] Endpoint completo de CRUD de templates
- [x] Interface de criação/edição de templates com preview
- [x] Sistema de templates padrão por tipo de documento
- [x] Aba Templates no menu lateral
