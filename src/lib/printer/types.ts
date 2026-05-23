import type { Database } from "@/types/database";

export type PrinterConfig =
  Database["public"]["Tables"]["printer_configs"]["Row"];

export type PrinterTarget = "kitchen" | "bar" | "receipt";

export type PrinterSetup = {
  configs: PrinterConfig[];
  productTargets: Record<string, PrinterTarget>;
  location: {
    address: string | null;
    city: string | null;
    in_person_payment_location: "bar" | "counter" | "table";
  };
};
