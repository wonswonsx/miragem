"use client";

import { uploadGenerationResultAction, type AdminGenerationActionState } from "@/app/admin/geracoes/actions";
import { CheckCircle2, LoaderCircle, UploadCloud } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

const initialState: AdminGenerationActionState = {
  ok: false,
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
      {pending ? "Enviando..." : "Enviar imagem final"}
    </button>
  );
}

type Props = {
  generationId: string;
};

export function SubmitResultForm({ generationId }: Props) {
  const [state, formAction] = useActionState(uploadGenerationResultAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="generationId" value={generationId} />
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-violet-200/80">
          Imagem final
        </span>
        <input
          type="file"
          name="resultFile"
          accept="image/*"
          required
          className="block w-full cursor-pointer rounded-xl border border-[rgba(147,112,219,0.25)] bg-black/30 text-sm text-zinc-200 file:mr-4 file:border-0 file:bg-violet-600 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500"
        />
      </label>
      <SubmitButton />
      {state.message ? (
        <p className={`flex items-center gap-2 text-sm ${state.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {state.ok ? <CheckCircle2 className="h-4 w-4" /> : null}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
