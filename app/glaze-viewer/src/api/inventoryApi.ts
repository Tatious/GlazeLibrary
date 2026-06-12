/**
 * Inventory API client. The studio inventory is a single shared list of
 * owned glaze IDs — anyone can read it (including signed-out visitors), only
 * admins can write it. Personal favorites still live in `glazeApi`'s
 * `my_glazes` config.
 */

import { authFetch } from "../lib/authFetch";

export interface InventoryResponse {
  ownedGlazeIds: string[];
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Fetch the studio inventory. Public — never throws for unauth users; falls
 * back to an empty list if the request fails so the UI keeps rendering.
 */
export async function fetchInventory(): Promise<InventoryResponse> {
  try {
    const res = await fetch("/api/inventory");
    if (!res.ok) throw new Error(`Inventory fetch failed: ${res.status}`);
    return (await res.json()) as InventoryResponse;
  } catch (error) {
    console.warn("Failed to fetch inventory, using empty list", error);
    return {
      ownedGlazeIds: [],
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    };
  }
}

/**
 * Replace the studio inventory. Admin-only on the server; non-admins will
 * see a 403 thrown.
 */
export async function saveInventory(
  ownedGlazeIds: string[],
): Promise<InventoryResponse> {
  return authFetch<InventoryResponse>("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownedGlazeIds }),
  });
}
