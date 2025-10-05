import type { Metadata } from 'next';
import CmsPage, { generateMetaForSlug } from '../(legal)/CmsPage';

export async function generateMetadata(): Promise<Metadata> {
  return generateMetaForSlug('cerez-politikasi');
}

export default function Page() {
  return <CmsPage slug="cerez-politikasi" heading="Çerez Politikası" />;
}
