"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AdminSettingsTabs({
  venue,
  denis,
  payments,
  integrations,
  defaultTab = "venue",
}: {
  venue: React.ReactNode;
  denis: React.ReactNode;
  payments: React.ReactNode;
  integrations: React.ReactNode;
  defaultTab?: "venue" | "denis" | "payments" | "integrations";
}) {
  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card/50 p-1 sm:w-auto">
        <TabsTrigger
          value="venue"
          className="rounded-lg px-4 py-2 data-[state=active]:bg-[var(--qr-ember)] data-[state=active]:text-white"
        >
          Venue
        </TabsTrigger>
        <TabsTrigger value="denis" className="rounded-lg px-4 py-2">
          Denis
        </TabsTrigger>
        <TabsTrigger value="payments" className="rounded-lg px-4 py-2">
          Payments & fiscal
        </TabsTrigger>
        <TabsTrigger value="integrations" className="rounded-lg px-4 py-2">
          Integrations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="venue" className="mt-0 space-y-6 focus-visible:outline-none">
        {venue}
      </TabsContent>
      <TabsContent value="denis" className="mt-0 space-y-6 focus-visible:outline-none">
        {denis}
      </TabsContent>
      <TabsContent value="payments" className="mt-0 space-y-6 focus-visible:outline-none">
        {payments}
      </TabsContent>
      <TabsContent value="integrations" className="mt-0 space-y-6 focus-visible:outline-none">
        {integrations}
      </TabsContent>
    </Tabs>
  );
}
