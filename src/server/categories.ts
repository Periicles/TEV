import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { category } from "@/db/schema";
import { colorNumber } from "@/lib/category-colors";
import { InputError, listCategories, NotFoundError } from "@/server/trips";

/**
 * The user's own categories: they can add, rename, recolor, reorder and delete them, built-in ones
 * included (a renamed built-in category keeps its new name in every language).
 */

const name = z.string().trim().min(1).max(50);
const color = z.number().int().min(1).max(8).nullable();

async function findCategory(userId: string, id: string) {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError();
  const [row] = await db
    .select()
    .from(category)
    .where(and(eq(category.id, id), eq(category.userId, userId)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function createCategory(
  userId: string,
  input: { name: string; color: number | null },
) {
  const data = z.object({ name, color }).parse(input);
  await listCategories(userId);
  const [{ last }] = await db
    .select({ last: sql<number>`coalesce(max(${category.position}), -1)`.mapWith(Number) })
    .from(category)
    .where(eq(category.userId, userId));
  const [created] = await db
    .insert(category)
    .values({ userId, name: data.name, color: data.color, position: last + 1 })
    .returning();
  return created;
}

/** Renames (`name`, when given) and/or recolors (`color`, when given) a category. */
export async function updateCategory(
  userId: string,
  id: string,
  input: { name?: string; color?: number | null },
) {
  const data = z.object({ name: name.optional(), color: color.optional() }).parse(input);
  const current = await findCategory(userId, id);
  const [updated] = await db
    .update(category)
    .set({
      // A built-in category given a name of its own stops being translated.
      ...(data.name !== undefined && { name: data.name, key: null }),
      ...(data.color !== undefined && { color: data.color }),
    })
    .where(eq(category.id, current.id))
    .returning();
  return updated;
}

/**
 * Swaps a category with its neighbor. Both keep the color they had, even one that followed their
 * position, so reordering never repaints the charts.
 */
export async function moveCategory(userId: string, id: string, direction: "up" | "down") {
  const current = await findCategory(userId, id);
  const all = await db
    .select()
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(asc(category.position));
  const index = all.findIndex((c) => c.id === current.id);
  const neighbor = all[direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return;

  await db.transaction(async (tx) => {
    await tx
      .update(category)
      .set({ position: neighbor.position, color: colorNumber(current) })
      .where(eq(category.id, current.id));
    await tx
      .update(category)
      .set({ position: current.position, color: colorNumber(neighbor) })
      .where(eq(category.id, neighbor.id));
  });
}

/**
 * Deletes a category; its expenses become uncategorized. The last one stays: with none left, the
 * built-in categories would come back on the next visit.
 */
export async function deleteCategory(userId: string, id: string) {
  const current = await findCategory(userId, id);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(category)
    .where(eq(category.userId, userId));
  if (count <= 1) throw new InputError("lastCategory");
  await db.delete(category).where(eq(category.id, current.id));
}
