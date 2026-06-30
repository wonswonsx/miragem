-- Admin que está atendendo o pedido (nome ou e-mail legível).
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS assigned_to text;

COMMENT ON COLUMN public.generations.assigned_to IS
  'Nome/e-mail do administrador que assumiu o pedido (multi-admin).';

CREATE INDEX IF NOT EXISTS idx_generations_assigned_to
  ON public.generations (assigned_to)
  WHERE assigned_to IS NOT NULL;
