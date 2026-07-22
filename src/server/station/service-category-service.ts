/**
 * Business logic for service categories and types (used by both services and extras).
 */
import {
  findServiceCategoriesWithTypes,
  type ServiceCategoryWithTypes,
} from './service-category-repository';

export async function getServiceCategoriesWithTypes(): Promise<ServiceCategoryWithTypes[]> {
  return findServiceCategoriesWithTypes();
}
