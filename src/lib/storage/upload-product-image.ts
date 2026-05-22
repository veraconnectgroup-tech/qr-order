import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGES_BUCKET = "product-images";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function uploadProductImage(
  supabase: SupabaseClient,
  orgId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use JPG, PNG, or WebP (max 5 MB).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large. Maximum size is 5 MB.");
  }

  const path = `${orgId}/${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function removeProductImage(
  supabase: SupabaseClient,
  publicUrl: string
): Promise<void> {
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return;

  const path = publicUrl.slice(index + marker.length);
  await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
}
