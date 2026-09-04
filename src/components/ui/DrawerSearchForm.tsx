import { Search } from 'lucide-react';

type DrawerSearchFormProps = {
  autoFocus?: boolean;
};

export default function DrawerSearchForm({ autoFocus = false }: DrawerSearchFormProps) {
  return (
    <form action="/arama" method="get" role="search" className="px-4 py-2">
      <div className="relative">
        <input
          name="q"
          type="search"
          aria-label="Sitede ara"
          autoFocus={autoFocus}
          minLength={2}
          maxLength={100}
          required
          placeholder="Sitede ara..."
          className="w-full rounded-full border border-brand-light-blue py-2.5 pl-4 pr-11 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-orange focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Ara"
          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange text-white transition-opacity hover:opacity-90"
        >
          <Search size={17} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
