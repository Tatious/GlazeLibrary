/**
 * `crypto.randomUUID` is only exposed in secure contexts (HTTPS / localhost).
 * iOS Safari hitting the dev server over a LAN IP, or any HTTP deployment,
 * gets `undefined` and crashes. These IDs only need to be unique within a
 * session (used as React keys for upload slots), so a `getRandomValues`
 * fallback — and a final `Math.random` fallback for ancient browsers — is
 * sufficient.
 */
export function randomId(): string {
  const c: Crypto | undefined =
    typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
