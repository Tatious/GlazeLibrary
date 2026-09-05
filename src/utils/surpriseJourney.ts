export type SurpriseKind = "glaze" | "combination";

export interface SurpriseJourney {
  kind: SurpriseKind;
  poolIds: string[];
  remainingIds: string[];
}

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % maxExclusive;
}

function shuffle(ids: string[]): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Start a no-repeat surprise run from the current filtered, owned pool.
 * The first item is returned separately; the rest travel in navigation state
 * so the detail page can keep serving new picks without returning to the grid.
 */
export function startSurpriseJourney(
  kind: SurpriseKind,
  ids: string[],
): { id: string; journey: SurpriseJourney } | null {
  const poolIds = [...new Set(ids)];
  if (poolIds.length === 0) return null;
  const [id, ...remainingIds] = shuffle(poolIds);
  return { id, journey: { kind, poolIds, remainingIds } };
}

/**
 * Take the next unseen item. After the whole pool has been shown, reshuffle it
 * and begin another run, keeping the current item out of the first slot.
 */
export function continueSurpriseJourney(
  journey: SurpriseJourney,
  currentId: string,
): { id: string; journey: SurpriseJourney } | null {
  if (journey.poolIds.length < 2) return null;

  if (journey.remainingIds.length > 0) {
    const [id, ...remainingIds] = journey.remainingIds;
    return { id, journey: { ...journey, remainingIds } };
  }

  const nextRun = shuffle(journey.poolIds);
  if (nextRun[0] === currentId) {
    [nextRun[0], nextRun[1]] = [nextRun[1], nextRun[0]];
  }
  const [id, ...remainingIds] = nextRun;
  return { id, journey: { ...journey, remainingIds } };
}

export function readSurpriseJourney(
  state: unknown,
  kind: SurpriseKind,
): SurpriseJourney | null {
  if (!state || typeof state !== "object" || !("surprise" in state)) return null;
  const surprise = (state as { surprise?: unknown }).surprise;
  if (!surprise || typeof surprise !== "object") return null;
  const candidate = surprise as Partial<SurpriseJourney>;
  if (
    candidate.kind !== kind ||
    !Array.isArray(candidate.poolIds) ||
    !Array.isArray(candidate.remainingIds) ||
    !candidate.poolIds.every((id) => typeof id === "string") ||
    !candidate.remainingIds.every((id) => typeof id === "string")
  ) {
    return null;
  }
  return candidate as SurpriseJourney;
}
