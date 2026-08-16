import type { JsonLdObject } from '@/lib/entitySchema';

export default function StructuredData({ id, data }: { id: string; data: JsonLdObject }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
