"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTab } from "@/app/admin/_components/AccountsTab";
import { CardUploadTab } from "@/app/admin/tabs/CardUploadTab";
import { DeliveryTab } from "@/app/admin/tabs/DeliveryTab";
import type { AdminPedido } from "@/app/admin/pedidos/AdminPedidosTicketClient";
import type { AdminProfileRow } from "@/types/database";

interface AdminTabsProps {
  initialVideos: unknown[];
  initialProfiles: AdminProfileRow[];
  initialGenerations: AdminPedido[];
}

export function AdminTabs({
  initialVideos,
  initialProfiles,
  initialGenerations,
}: AdminTabsProps) {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Painel Administrativo</h1>
        <p className="mt-2 text-sm text-zinc-400">Gerencie pedidos, entregas e contas do Miragem</p>
      </div>

      <Tabs defaultValue="delivery" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-zinc-900 p-1 sm:grid-cols-3">
          <TabsTrigger
            value="upload"
            className="min-h-11 data-[state=active]:bg-violet-600 data-[state=active]:text-white text-zinc-300"
          >
            Upload de Cards
          </TabsTrigger>
          <TabsTrigger
            value="delivery"
            className="min-h-11 data-[state=active]:bg-violet-600 data-[state=active]:text-white text-zinc-300"
          >
            Pedidos
            {initialGenerations.length > 0 ? (
              <span className="ml-2 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
                {initialGenerations.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            className="min-h-11 data-[state=active]:bg-violet-600 data-[state=active]:text-white text-zinc-300"
          >
            Gerenciar contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-0 space-y-6 focus-visible:outline-none">
          <CardUploadTab initialVideos={initialVideos} />
        </TabsContent>

        <TabsContent value="delivery" className="mt-0 space-y-6 focus-visible:outline-none">
          <DeliveryTab initialGenerations={initialGenerations} />
        </TabsContent>

        <TabsContent value="accounts" className="mt-0 space-y-6 focus-visible:outline-none">
          <AccountsTab initialProfiles={initialProfiles} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
