"use client";

import { LoaderCircle, Upload, X, Download, Sparkles, Gem } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GenerationStatus = 'idle' | 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';

interface VideoGenerationUploadProps {
  userId: string | null;
  onGenerateComplete?: () => void;
}

export function VideoGenerationUpload({ userId, onGenerateComplete }: VideoGenerationUploadProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!userId) {
      setError('Usuário não autenticado');
      return;
    }

    if (!file.type.startsWith('image/') && file.type !== 'video/mp4' && file.type !== 'video/quicktime') {
      setError('Formato não suportado. Envie imagem (PNG, JPG, GIF) ou vídeo (MP4).');
      return;
    }

    setStatus('uploading');
    setError(null);
    setUploadProgress(0);

    try {
      const sb = createClient();
      const fileName = `generations/${userId}/${Date.now()}-${file.name}`;
      
      // Upload para o Supabase Storage
      const { error } = await sb.storage
        .from('generations')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Obter URL pública
      const { data: { publicUrl } } = sb.storage
        .from('generations')
        .getPublicUrl(fileName);

      setUploadedImageUrl(publicUrl);
      setUploadProgress(100);
      setStatus('pending');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload');
      setStatus('failed');
    }
  }, [userId]);

  const startStatusPolling = (genId: string) => {
    // Implementar Supabase Realtime para atualização em tempo real
    const sb = createClient();
    
    const channel = sb
      .channel(`generation-${genId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'generations',
          filter: `id=eq.${genId}`
        },
        (payload) => {
          console.log('Status atualizado:', payload.new);
          
          const newStatus = (payload.new as any).status;
          const videoUrl = (payload.new as any).video_url;
          
          if (newStatus === 'completed') {
            setStatus('completed');
            setFinalVideoUrl(videoUrl);
            setUploadProgress(100);
            sb.removeChannel(channel);
          } else if (newStatus === 'failed') {
            setStatus('failed');
            setError('Falha na geração do vídeo');
            sb.removeChannel(channel);
          }
        }
      )
      .subscribe();

    // Fallback com polling caso Realtime falhe
    const pollInterval = setInterval(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await sb
          .from('generations' as any)
          .select('status, video_url')
          .eq('id', genId)
          .single();

        if (error) {
          console.error('Erro ao verificar status:', error);
          return;
        }

        const generation = data as unknown as { status: string; video_url: string | null };
        
        if (generation.status === 'completed') {
          clearInterval(pollInterval);
          sb.removeChannel(channel);
          setStatus('completed');
          setFinalVideoUrl(generation.video_url);
          setUploadProgress(100);
        } else if (generation.status === 'failed') {
          clearInterval(pollInterval);
          sb.removeChannel(channel);
          setStatus('failed');
          setError('Falha na geração do vídeo');
        }
      } catch (err) {
        console.error('Erro no polling:', err);
      }
    }, 5000); // Verificar a cada 5 segundos

    // Cleanup function
    return () => {
      clearInterval(pollInterval);
      sb.removeChannel(channel);
    };
  };

  const isAcceptedFile = (file: File) =>
    file.type.startsWith('image/') || file.type === 'video/mp4' || file.type === 'video/quicktime';

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!isAcceptedFile(file)) {
        setError('Formato não suportado. Envie imagem (PNG, JPG, GIF) ou vídeo (MP4).');
        return;
      }

      setSelectedFile(file);

      if (file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
      }

      setError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isAcceptedFile(file)) {
        setError('Formato não suportado. Envie imagem (PNG, JPG, GIF) ou vídeo (MP4).');
        return;
      }

      setSelectedFile(file);

      if (file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
      }

      setError(null);
    }
  }, []);

  const handleGenerateVideo = useCallback(async (mode: 'padrao' | 'estendido' = 'padrao', cost: number = 50) => {
    console.log('>>> DISPARANDO GERAÇÃO:', { tipo: mode, diamantes: cost, arquivo: selectedFile?.name ?? 'nenhum', userId });

    if (!userId) {
      setError('Usuário não autenticado. Faça login primeiro.');
      return;
    }

    if (!selectedFile) {
      setError('Selecione uma imagem, GIF ou vídeo MP4 primeiro!');
      return;
    }
    setStatus('uploading');
    setError(null);

    try {
      const sb = createClient();

      // 1. Verificar e debitar diamantes atomicamente via RPC
      const { data: debitResult, error: debitError } = await sb
        .rpc('check_and_debit_diamonds' as any, {
          user_id_param: userId,
          cost_param: cost,
        });

      if (debitError) {
        throw new Error('Erro ao processar diamantes. Tente novamente.');
      }

      const debit = Array.isArray(debitResult) ? debitResult[0] : debitResult;
      if (!debit?.success) {
        throw new Error(
          debit?.message === 'Saldo insuficiente'
            ? `Diamantes insuficientes. Você precisa de ${cost} 💎.`
            : (debit?.message ?? 'Erro ao debitar diamantes'),
        );
      }

      // 2. Upload para bucket 'imagens'
      const fileName = `${userId}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await sb.storage
        .from('imagens')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: selectedFile.type,
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      // 3. Obter URL pública
      const { data: { publicUrl } } = sb.storage
        .from('imagens')
        .getPublicUrl(fileName);

      // 4. Registrar transação de diamantes
      const { error: txErr } = await sb
        .from('transactions' as any)
        .insert({
          user_id: userId,
          amount: -cost,
          type: mode === 'estendido' ? 'generation_extended' : 'generation',
          description: `Geração de vídeo ${mode === 'estendido' ? 'estendida' : 'padrão'} (${cost} 💎)`,
        });

      if (txErr) {
        console.error('Erro Supabase (transactions):', txErr);
      }

      // 4b. Atualizar saldo na tabela profiles
      const { error: profileErr } = await sb.rpc('debit_diamonds' as any, {
        user_id_param: userId,
        amount_param: cost,
      });

      if (profileErr) {
        console.error('Erro Supabase (profiles debit):', profileErr);
      }

      // 5. Criar registro em generations
      const { error: generationError, data: generationData } = await sb
        .from('generations' as any)
        .insert({
          user_id: userId,
          image_url: publicUrl,
          status: 'pending',
          mode: mode,
          diamond_cost: cost,
        })
        .select('id')
        .single();

      if (generationError) {
        console.error('Erro ao criar registro:', generationError);
      }

      // 6. Salvar preview no localStorage
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        localStorage.setItem('recentGenerationImage', previewUrl);
        localStorage.setItem('recentGenerationFileName', selectedFile.name);
        localStorage.setItem('recentGenerationTime', new Date().toISOString());
        if (generationData && 'id' in (generationData as any)) {
          localStorage.setItem('recentGenerationId', (generationData as any).id);
        }
      };
      reader.readAsDataURL(selectedFile);

      setUploadProgress(100);

      console.log('Geração criada:', { mode, cost, saldo_restante: debit?.diamonds_after });

      // 7. Redirecionar para /minhas-geracoes após sucesso
      setTimeout(() => {
        router.push('/minhas-geracoes');
      }, 1500);

    } catch (err) {
      console.error('Erro na geração:', err);
      setError(err instanceof Error ? err.message : 'Erro ao gerar vídeo');
      setStatus('failed');
    }
  }, [selectedFile, userId, router]);

  const resetUpload = () => {
    setStatus('idle');
    setUploadedImageUrl(null);
    setFinalVideoUrl(null);
    setError(null);
    setUploadProgress(0);
    setGenerationId(null);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  if (status === 'completed' && finalVideoUrl) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-1 relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
          <video
            src={finalVideoUrl}
            className="h-full w-full object-cover"
            controls
            muted
            loop
            playsInline
            autoPlay
          />
        </div>
        <a
          href={finalVideoUrl}
          download
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 text-center font-medium text-white transition hover:from-green-600 hover:to-emerald-700"
        >
          <Download className="h-4 w-4" />
          Baixar Vídeo
        </a>
        <button
          onClick={resetUpload}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Gerar Novo Vídeo
        </button>
      </div>
    );
  }

  if ((status === 'pending' || status === 'processing') && uploadedImageUrl) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-1 relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black">
          <img
            src={uploadedImageUrl}
            alt="Imagem enviada"
            className="h-full w-full object-cover"
            style={{ filter: 'blur(8px)' }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
            <LoaderCircle className="h-12 w-12 animate-spin mb-4" />
            <p className="text-center text-lg font-medium">
              {status === 'pending' ? 'Sua mágica está sendo processada...' : 'Processando vídeo...'}
            </p>
            <p className="text-center text-sm text-zinc-300 mt-2">
              Isso pode levar alguns minutos
            </p>
          </div>
        </div>
        <button
          onClick={resetUpload}
          className="w-full rounded-xl border border-red-500/50 bg-red-950/50 px-4 py-3 text-center font-medium text-red-300 transition hover:bg-red-900/50"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Bloco de Instruções (Topo) - Discreto */}
      <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/30">
        <h4 className="text-sm font-medium text-zinc-300 mb-2 leading-relaxed">Dicas para melhor resultado:</h4>
        <ul className="text-sm text-zinc-300 space-y-1 leading-relaxed">
          <li>• Imagem nítida e bem iluminada</li>
          <li>• Pessoa em foco, fundo neutro</li>
          <li>• Posição similar ao vídeo</li>
        </ul>
      </div>

      {/* 2. Área de Upload (Centro) - Altura Fixa */}
      <div className="flex justify-center">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="h-56 w-64 relative overflow-hidden rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 cursor-pointer transition-all duration-200 hover:border-violet-500/50 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(147,112,219,0.1)]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {status === 'uploading' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
              <LoaderCircle className="h-10 w-10 animate-spin mb-3" />
              <p className="text-center text-sm font-medium">Enviando...</p>
              <div className="mt-3 w-48 rounded-full bg-zinc-700">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : previewUrl ? (
            <div className="absolute inset-0">
              {selectedFile?.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview do arquivo selecionado"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-xs text-white font-medium truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-xs text-zinc-300">
                  Clique para trocar o arquivo
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Upload className="h-10 w-10 text-zinc-500 mb-3" />
              <p className="text-sm font-medium text-zinc-300 mb-1.5">
                Arraste seu arquivo
              </p>
              <p className="text-xs text-zinc-500 mb-2">
                ou clique para selecionar
              </p>
              <p className="text-xs text-zinc-600">
                PNG, JPG, GIF, MP4 até 10MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Botões de Geração */}
      <div className="flex flex-col gap-2.5">
        {/* Botão A: Padrão 50 💎 — Violeta */}
        <button
          type="button"
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={() => void handleGenerateVideo('padrao', 50)}
          className="w-full rounded-xl border border-violet-500/50 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-all duration-200 hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-xl active:scale-[0.98]"
        >
          {status === 'uploading' ? (
            <span className="flex items-center justify-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Processando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar Vídeo (50 💎)
            </span>
          )}
        </button>

        {/* Botão B: Estendido 100 💎 — Dourado VIP */}
        <button
          type="button"
          style={{ pointerEvents: 'auto', cursor: 'pointer', boxShadow: '0 0 24px rgba(251,191,36,0.2), 0 4px 16px rgba(0,0,0,0.5)' }}
          onClick={() => void handleGenerateVideo('estendido', 100)}
          className="w-full rounded-xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-900/60 to-yellow-900/60 px-5 py-3.5 text-sm font-semibold text-amber-200 transition-all duration-200 hover:border-amber-300 hover:from-amber-800/70 hover:to-yellow-800/70 hover:text-amber-100 hover:shadow-xl active:scale-[0.98]"
        >
          {status === 'uploading' ? (
            <span className="flex items-center justify-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Processando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Gem className="h-4 w-4" />
              Geração Estendida (100 💎)
            </span>
          )}
        </button>
      </div>

      <div className="flex-1" />

      {/* Card de Custo */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-950/40 p-3">
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 rounded-full bg-violet-500 flex items-center justify-center text-xs font-bold text-white">
            💎
          </div>
          <div>
            <p className="text-xs font-medium text-violet-300">Padrão: 50 💎 · Estendida: 100 💎</p>
            <p className="text-xs text-violet-400 mt-0.5">
              Processamento em alguns minutos.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/50 p-3">
          <div className="flex items-start gap-2">
            <X className="h-4 w-4 text-red-400 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-red-300">Erro</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={resetUpload}
            className="mt-2 text-xs text-red-400 hover:text-red-300"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
