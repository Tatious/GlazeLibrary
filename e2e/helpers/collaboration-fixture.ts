import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { adminAuth, adminDb } from "../../server/lib/firebase-admin.js";
import {
  Collections,
  Pieces,
  ResourceMembers,
  UserData,
} from "../../server/lib/repositories.js";

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  displayName: string;
}

export async function createTestUser(label: string): Promise<TestUser> {
  if (!adminAuth || !adminDb) throw new Error("Firebase Admin is unavailable");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const displayName = `E2E ${label} ${suffix.slice(0, 5)}`;
  const email = `glaze-e2e-${label.toLowerCase()}-${suffix}@example.com`;
  const password = `GlazeE2E!${suffix}`;
  let uid: string | undefined;
  try {
    const record = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    uid = record.uid;
    const now = new Date().toISOString();
    await adminDb.collection("profiles").doc(record.uid).set({
      id: record.uid,
      display_name: displayName,
      photo_data_url: null,
      role: "user",
      created_at: now,
      updated_at: now,
    });
    return { uid: record.uid, email, password, displayName };
  } catch (error) {
    if (uid) await adminAuth.deleteUser(uid).catch(() => {});
    throw error;
  }
}

export function createTestPiece(
  ownerId: string,
  options: {
    name?: string;
    stageRecords?: Array<{
      stage: "greenware" | "bisqueware" | "fired";
      date: string;
      photos: string[];
      notes?: string | null;
    }>;
    glazes?: Array<{
      glazeId: string;
      coats?: number;
      overGlazeId?: string;
      overCoats?: number;
    }>;
    inspoLikes?: Array<{
      type: "glaze" | "combination";
      id: string;
      likedAt: string;
    }>;
  } = {},
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const now = new Date().toISOString();
  const id = `piece-e2e-${suffix}`;
  Pieces.insert({
    id,
    userId: ownerId,
    name: options.name || `Collaboration Piece ${suffix}`,
    clayBody: "E2E stoneware",
    notes: "Created by the collaboration test",
    weight: "250g",
    currentStage: "bisqueware",
    stageRecords: options.stageRecords || [
      {
        stage: "bisqueware",
        date: now,
        photos: [],
        notes: "Ready for glaze planning",
      },
    ],
    glazes: options.glazes || [
      { glazeId: "mayco-sc-27", coats: 2 },
      {
        glazeId: "amaco-sh-21",
        coats: 2,
        overGlazeId: "amaco-pc-56",
        overCoats: 2,
      },
    ],
    inspoCollectionId: null,
    publishedEntries: [],
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
  const inspoCollectionId = Pieces.createInspoCollection(id, ownerId);
  Collections.update(inspoCollectionId, {
    likes: options.inspoLikes || [
      { type: "glaze", id: "amaco-hf-56", likedAt: now },
    ],
  });
  return Pieces.get(id);
}

export function deleteTestPiece(pieceId: string) {
  const piece = Pieces.get(pieceId);
  if (!piece) return;
  ResourceMembers.removeAllFor("piece", pieceId);
  if (piece.inspoCollectionId) Collections.delete(piece.inspoCollectionId);
  Pieces.delete(pieceId);
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user || !adminAuth || !adminDb) return;
  UserData.purge(user.uid);
  await adminDb.collection("profiles").doc(user.uid).delete().catch(() => {});
  await adminAuth.deleteUser(user.uid).catch(() => {});
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/glazes$/);
}

export async function authenticatedJson(
  page: Page,
  url: string,
  options: { method?: string; body?: unknown } = {},
) {
  return page.evaluate(
    async ({ requestUrl, method, body }) => {
      const { auth } = await import("/src/lib/firebase.ts");
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("No authenticated test user");
      const response = await fetch(requestUrl, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: await response.json().catch(() => null),
      };
    },
    { requestUrl: url, method: options.method || "GET", body: options.body },
  );
}