"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  removeProductImage,
  uploadProductImage,
} from "@/lib/storage/upload-product-image";
import { cn } from "@/lib/utils";

export function ProductImageUpload({
  orgId,
  value,
  onChange,
  disabled = false,
}: {
  orgId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const url = await uploadProductImage(supabase, orgId, file);
      onChange(url);
      toast.success("Photo uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload photo"
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!value) return;
    setUploading(true);
    try {
      const supabase = createClient();
      await removeProductImage(supabase, value);
      onChange(null);
      toast.success("Photo removed");
    } catch {
      onChange(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm text-zinc-400">Photo</span>

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950",
          disabled && "opacity-60"
        )}
      >
        {value ? (
          <div className="relative h-40 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Product preview"
              className="size-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                className="absolute right-2 top-2 rounded-lg bg-zinc-950/80 p-2 text-zinc-300 backdrop-blur-sm transition hover:bg-red-950/80 hover:text-red-300"
                aria-label="Remove photo"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-zinc-500">
            <ImagePlus className="size-8 text-zinc-600" />
            <p className="text-xs">No photo yet</p>
          </div>
        )}

        <div className="border-t border-zinc-800 p-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading…
              </>
            ) : value ? (
              "Replace photo"
            ) : (
              "Upload photo"
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-zinc-600">
            JPG, PNG or WebP · max 5 MB
          </p>
        </div>
      </div>
    </div>
  );
}
