import type { Metadata } from 'next';
import CmsPage, { generateMetaForSlug } from '../(legal)/CmsPage';

export async function generateMetadata(): Promise<Metadata> {
  return generateMetaForSlug('kunye');
}

export default function Page() {
  return <CmsPage slug="kunye" heading="Künye" />;
}
