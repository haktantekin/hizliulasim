type CategoryRouteInfo = {
  id: number;
  slug: string;
  parentId?: number;
};

type RootPostRoute<TCategory extends CategoryRouteInfo> = {
  category: TCategory;
  pathname: string;
};

export function resolveRootPostRoute<TCategory extends CategoryRouteInfo>({
  mainCategorySlug,
  postSlug,
  postCategoryIds,
  categories,
}: {
  mainCategorySlug: string;
  postSlug: string;
  postCategoryIds: number[];
  categories: TCategory[];
}): RootPostRoute<TCategory> | null {
  const rootCategory = categories.find(
    (category) => category.slug === mainCategorySlug && !category.parentId,
  );

  if (!rootCategory) return null;

  const assignedCategoryIds = new Set(postCategoryIds);
  if (!assignedCategoryIds.has(rootCategory.id)) return null;

  const hasAssignedChildCategory = categories.some(
    (category) => category.parentId && assignedCategoryIds.has(category.id),
  );
  if (hasAssignedChildCategory) return null;

  return {
    category: rootCategory,
    pathname: `/${rootCategory.slug}/${postSlug}`,
  };
}
