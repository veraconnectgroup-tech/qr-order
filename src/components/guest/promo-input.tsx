"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { formatPrice } from "@/lib/format";
import { readJsonResponse } from "@/lib/api/read-json-response";
import type { PromoErrorCode } from "@/lib/promo/validate-promo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AppliedPromo = {
  promoCodeId: string;
  code: string;
  discountAmount: number;
};

export function PromoInput({
  locationId,
  orderAmount,
  currency,
  value,
  onChange,
}: {
  locationId: string;
  orderAmount: number;
  currency: string;
  value: AppliedPromo | null;
  onChange: (promo: AppliedPromo | null) => void;
}) {
  const { tUI } = useAppLocale();
  const [code, setCode] = useState(value?.code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return;
    void validateCode(value.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderAmount]);

  function errorMessage(err: PromoErrorCode, minOrderAmount?: number) {
    switch (err) {
      case "expired":
        return tUI("promo.errorExpired");
      case "not_yet_valid":
        return tUI("promo.errorNotYetValid");
      case "inactive":
        return tUI("promo.errorInactive");
      case "max_uses":
        return tUI("promo.errorMaxUses");
      case "min_order":
        return tUI("promo.errorMinOrder", {
          amount: formatPrice(minOrderAmount ?? 0, currency),
        });
      default:
        return tUI("promo.errorInvalid");
    }
  }

  async function validateCode(inputCode: string, silent = false) {
    const trimmed = inputCode.trim();
    if (!trimmed) {
      setError(tUI("promo.errorInvalid"));
      return;
    }

    setLoading(true);
    if (!silent) setError(null);

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          locationId,
          orderAmount,
        }),
      });

      const parsed = await readJsonResponse<{
        data?: {
          valid: boolean;
          error?: PromoErrorCode;
          minOrderAmount?: number;
          promoCodeId?: string;
          code?: string;
          discountAmount?: number;
        };
      }>(res);

      if (!parsed.ok || !parsed.data.data) {
        throw new Error(tUI("error.generic"));
      }

      const data = parsed.data.data;
      if (!data.valid) {
        if (silent) {
          onChange(null);
          setError(errorMessage(data.error ?? "not_found", data.minOrderAmount));
        } else {
          setError(errorMessage(data.error ?? "not_found", data.minOrderAmount));
        }
        return;
      }

      onChange({
        promoCodeId: data.promoCodeId!,
        code: data.code!,
        discountAmount: data.discountAmount!,
      });
      setCode(data.code!);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tUI("error.generic"));
    } finally {
      setLoading(false);
    }
  }

  function handleRemove() {
    setCode("");
    setError(null);
    onChange(null);
  }

  if (value) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-300">{value.code}</p>
              <p className="text-xs text-green-200/70">
                {tUI("promo.applied", {
                  amount: formatPrice(value.discountAmount, currency),
                })}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-zinc-400 hover:text-zinc-200"
          >
            {tUI("promo.remove")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="mb-2 text-sm font-medium text-zinc-200">{tUI("promo.title")}</p>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={tUI("promo.placeholder")}
          className="border-zinc-700 bg-zinc-950 uppercase text-zinc-100"
          disabled={loading}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || !code.trim()}
          onClick={() => validateCode(code)}
          className="shrink-0 border-zinc-700"
        >
          {loading ? tUI("promo.applying") : tUI("promo.apply")}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
