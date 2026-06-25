"use client";

import type { AdminProfileRow, VideoRow } from "@/types/database";
import { useState } from "react";
import { AccountsTab } from "@/app/admin/_components/AccountsTab";
import {
  DiamondTransactionsTab,
  type DiamondTxRow,
} from "@/app/admin/_components/DiamondTransactionsTab";
import { DeliveryTab } from "@/app/admin/tabs/DeliveryTab";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import { ProductionQueueTab } from "@/app/admin/_components/ProductionQueueTab";
import { UploadTab } from "@/app/admin/_components/UploadTab";

export type AdminTabId = "upload" | "pedidos" | "producao" | "transacoes" | "contas";

type Props = {
  initialModels: VideoRow[];
  initialProfiles: AdminProfileRow[];
  initialDiamondTransactions: DiamondTxRow[];
  initialGenerations?: AdminPedido[];
  suggestedTags: string[];
};

export function AdminTabsClient({
  initialModels,
  initialProfiles,
  initialDiamondTransactions,
  initialGenerations = [],
  suggestedTags,
}: Props) {
  const [tab, setTab] = useState<AdminTabId>("upload");
  const tabBtn = (id: AdminTabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
        tab === id
          ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40"
          : "border border-[rgba(147,112,219,0.25)] bg-black/30 text-violet-200/80 hover:border-violet-400/40 hover:text-violet-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <nav
        className="flex flex-wrap gap-2 border-b border-[rgba(147,112,219,0.2)] pb-4"
        aria-label="Secções do painel"
      >
        {tabBtn("upload", "Upload")}
        {tabBtn("pedidos", "Pedidos")}
        {tabBtn("producao", "Fila de Produção")}
        {tabBtn("transacoes", "Transações")}
        {tabBtn("contas", "Gerenciar contas")}
      </nav>

      {tab === "upload" ? (
        <UploadTab initialModels={initialModels} suggestedTags={suggestedTags} />
      ) : null}
      {tab === "pedidos" ? (
        <DeliveryTab initialGenerations={initialGenerations} />
      ) : null}
      {tab === "producao" ? (
        <ProductionQueueTab />
      ) : null}
      {tab === "transacoes" ? (
        <DiamondTransactionsTab initialTransactions={initialDiamondTransactions} />
      ) : null}
      {tab === "contas" ? (
        <AccountsTab initialProfiles={initialProfiles} />
      ) : null}
    </div>
  );
}
