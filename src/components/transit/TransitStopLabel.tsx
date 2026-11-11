import Link from 'next/link';
import { getCanonicalStopHref, type TimelineStop } from '@/lib/transit/presentation';

export default function TransitStopLabel({ name, href }: TimelineStop) {
  const canonicalHref = getCanonicalStopHref(href);

  return canonicalHref ? (
    <Link
      href={canonicalHref}
      prefetch={false}
      className="rounded-sm font-semibold text-brand-soft-blue underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft-blue"
    >
      {name}
    </Link>
  ) : <span className="font-semibold">{name}</span>;
}
