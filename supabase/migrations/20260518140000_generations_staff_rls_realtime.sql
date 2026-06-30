-- Staff vê todos os pedidos (alinhado com isStaff no app: metadata + is_admin)
DROP POLICY IF EXISTS "Admin can view all generations" ON public.generations;

CREATE POLICY "Staff can view all generations"
  ON public.generations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
    OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean, false) = true
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'mod')
  );

-- Realtime: publicar INSERT/UPDATE na fila de pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'generations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;
  END IF;
END $$;
