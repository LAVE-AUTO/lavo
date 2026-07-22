/**
 * Data access for service categories (wash_types) and their service types
 * (service_types). Global catalog — not station-scoped.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { washTypes, serviceTypes } from '@/lib/db/schema';

export type WashType = typeof washTypes.$inferSelect;
export type ServiceTypeRow = typeof serviceTypes.$inferSelect;

export type ServiceCategoryWithTypes = WashType & {
  types: ServiceTypeRow[];
};

export async function findActiveServiceCategories(): Promise<WashType[]> {
  return db.query.washTypes.findMany({
    where: eq(washTypes.is_active, true),
    orderBy: (wt, { asc }) => [asc(wt.sort_order)],
  });
}

export async function findActiveServiceTypes(): Promise<ServiceTypeRow[]> {
  return db.query.serviceTypes.findMany({
    where: eq(serviceTypes.is_active, true),
    orderBy: (st, { asc }) => [asc(st.sort_order)],
  });
}

export async function findServiceCategoriesWithTypes(): Promise<ServiceCategoryWithTypes[]> {
  const [categories, types] = await Promise.all([
    findActiveServiceCategories(),
    findActiveServiceTypes(),
  ]);
  return categories.map((category) => ({
    ...category,
    types: types.filter((t) => t.wash_type_id === category.id),
  }));
}

export async function findWashTypeByCode(code: string): Promise<WashType | undefined> {
  return db.query.washTypes.findFirst({
    where: and(eq(washTypes.code, code), eq(washTypes.is_active, true)),
  });
}

export async function findServiceTypeByCodeAndCategory(
  categoryId: string,
  code: string
): Promise<ServiceTypeRow | undefined> {
  return db.query.serviceTypes.findFirst({
    where: and(
      eq(serviceTypes.wash_type_id, categoryId),
      eq(serviceTypes.code, code),
      eq(serviceTypes.is_active, true)
    ),
  });
}
