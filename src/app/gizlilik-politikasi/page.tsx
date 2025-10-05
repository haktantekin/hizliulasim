import type { Metadata } from 'next';
import CmsPage, { generateMetaForSlug } from '../(legal)/CmsPage';

export async function generateMetadata(): Promise<Metadata> {
  return generateMetaForSlug('gizlilik-politikasi');
}

export default function Page() {
  return <CmsPage slug="gizlilik-politikasi" heading="Gizlilik Politikası" />;
}
