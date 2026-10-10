import { ApiError } from "@/lib/api";

// Turn any thrown error into a human-readable (Bahasa Indonesia) message.
export function apiErrorText(err: unknown, fallback = "Terjadi kesalahan jaringan — coba lagi"): string {
  if (err instanceof ApiError) {
    const body = err.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
    return `Permintaan gagal (${err.status})`;
  }
  return fallback;
}
