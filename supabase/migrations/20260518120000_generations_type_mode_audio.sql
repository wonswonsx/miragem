-- Compat: type (obrigatório no PostgREST), mode (legado/paralelo), áudio pedido pelo cliente
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS audio_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.generations.type IS 'padrao | estendido — tipo principal do pedido';
COMMENT ON COLUMN public.generations.mode IS 'Espelho de type para compatibilidade com código legado';
COMMENT ON COLUMN public.generations.audio_enabled IS 'Cliente solicitou vídeo com som';
