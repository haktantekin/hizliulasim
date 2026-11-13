import { formatIettFreshness, type IettFreshness } from '@/lib/iett-static/presentation';

export default function IettDataFreshness({ freshness, className = '' }: { freshness: IettFreshness | null; className?: string }) {
  const text = formatIettFreshness(freshness);
  if (text === null) return null;
  return <p className={`text-xs text-gray-500 ${className}`}>{text}</p>;
}
