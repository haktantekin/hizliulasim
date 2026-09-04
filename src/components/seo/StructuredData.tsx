import type { JsonLdObject } from '@/lib/entitySchema';
import { serializeJsonLd } from '@/lib/structuredData';

export default function StructuredData({ id, data }: { id: string; data: JsonLdObject }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(data),
      }}
    />
  );
}
