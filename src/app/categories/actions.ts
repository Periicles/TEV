"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ErrorCode } from "@/i18n/errors";
import { requireSession } from "@/lib/session";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/server/categories";
import { InputError } from "@/server/trips";

/** `undefined` on success, else a translation key under `errors`. */
async function run(change: (userId: string) => Promise<unknown>): Promise<ErrorCode | undefined> {
  const { user } = await requireSession();
  try {
    await change(user.id);
  } catch (error) {
    if (error instanceof InputError) return error.code;
    if (error instanceof z.ZodError) return "required";
    console.error(error);
    return "unexpected";
  } finally {
    // Category names and colors show on every trip page.
    revalidatePath("/", "layout");
  }
}

export async function addCategory(name: string, color: number | null) {
  return run((userId) => createCategory(userId, { name, color }));
}

export async function renameCategory(id: string, name: string) {
  return run((userId) => updateCategory(userId, id, { name }));
}

export async function recolorCategory(id: string, color: number) {
  return run((userId) => updateCategory(userId, id, { color }));
}

export async function reorderCategory(id: string, direction: "up" | "down") {
  return run((userId) => moveCategory(userId, id, direction));
}

export async function removeCategory(id: string) {
  return run((userId) => deleteCategory(userId, id));
}
