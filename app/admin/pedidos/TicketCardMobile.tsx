"use client";

import type { DeliverPedidoVideoState } from "@/app/admin/pedidos/actions";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { TicketCardPanel } from "@/app/admin/pedidos/TicketCardPanel";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  pedido: AdminPedido;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>, pedido: AdminPedido) => void;
  isSubmitting: boolean;
  feedback?: DeliverPedidoVideoState | null;
};

export function TicketCardMobile({ pedido, onClose, onSubmit, isSubmitting, feedback }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-center sm:p-4 lg:hidden"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 mx-auto w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <TicketCardPanel
          pedido={pedido}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          feedback={feedback}
          onClose={onClose}
          modal
        />
      </div>
    </div>,
    document.body
  );
}
