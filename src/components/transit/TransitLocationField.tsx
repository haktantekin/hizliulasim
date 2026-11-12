import { useId, useRef, useState, type Dispatch, type KeyboardEvent } from 'react';
import { Loader2, LocateFixed, LockKeyhole, MapPin, X } from 'lucide-react';
import type { PlannerAction, PlannerEndpoint, PlannerEndpointRole } from '@/lib/transit/presentation';

export interface TransitLocationFieldProps extends PlannerEndpoint {
  role: PlannerEndpointRole;
  allowCurrentLocation: boolean;
  locked?: boolean;
  dispatch: Dispatch<PlannerAction>;
}

export default function TransitLocationField({
  role, value, query, lookup, allowCurrentLocation, locked, dispatch,
}: TransitLocationFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const label = role === 'origin' ? 'Başlangıç' : 'Hedef';
  const listId = `${id}-suggestions`;
  const statusId = `${id}-status`;
  const suggestions = lookup.kind === 'suggestions' ? lookup.predictions : [];
  const expanded = !locked && open && suggestions.length > 0;
  const active = expanded && suggestions[activeIndex];

  function closeSuggestions() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function choosePlace(placeId: string) {
    closeSuggestions();
    dispatch({ type: 'choose-place', role, placeId });
  }

  function editLocation(text: string) {
    setActiveIndex(-1);
    setOpen(true);
    dispatch({ type: 'edit-location', role, query: text });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      closeSuggestions();
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      choosePlace(active.id);
    } else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length > 0) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const from = active ? activeIndex : (direction === 1 ? -1 : 0);
      const nextIndex = (from + direction + suggestions.length) % suggestions.length;
      setOpen(true);
      setActiveIndex(nextIndex);
      document.getElementById(`${listId}-${nextIndex}`)?.scrollIntoView({ block: 'nearest' });
    }
  }

  const locating = lookup.kind === 'geolocation';
  const trailingPadding = allowCurrentLocation ? (query ? 'pr-20' : 'pr-10') : (query ? 'pr-10' : 'pr-3');
  let message = '';
  if (lookup.kind === 'search' && open) message = 'Yer aranıyor…';
  if (lookup.kind === 'suggestions' && open && suggestions.length === 0) message = 'Yer bulunamadı.';
  if (lookup.kind === 'details') message = 'Konum alınıyor…';
  if (locating) message = 'Konumunuz alınıyor…';
  if (lookup.kind === 'error') message = lookup.message;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-800">{label}</label>
      <div className="relative">
        {locked
          ? <LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-gray-500" />
          : <MapPin aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-gray-500" />}
        {locked ? (
          <input
            id={id}
            type="text"
            readOnly
            value={value?.name ?? ''}
            title={value?.name}
            className="min-h-10 w-full truncate rounded-xl border border-gray-200 bg-gray-50 pr-3 pl-9 text-sm text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-soft-blue"
          />
        ) : (
          <>
            <input
              ref={input}
              id={id}
              type="text"
              role="combobox"
              aria-expanded={expanded}
              aria-autocomplete="list"
              aria-controls={expanded ? listId : undefined}
              aria-activedescendant={active ? `${listId}-${activeIndex}` : undefined}
              aria-describedby={message ? statusId : undefined}
              autoComplete="off"
              placeholder="Durak, adres veya yer ara"
              value={query}
              onChange={(event) => editLocation(event.target.value)}
              onFocus={() => setOpen(true)}
              onBlur={closeSuggestions}
              onKeyDown={handleKeyDown}
              className={`min-h-10 w-full rounded-xl border border-gray-200 bg-white ${trailingPadding} pl-9 text-sm text-gray-900 placeholder:text-gray-500 focus-visible:outline-2 focus-visible:outline-brand-soft-blue`}
            />
            <div className="absolute inset-y-0 right-0 flex items-center">
              {allowCurrentLocation && (
                <button
                  type="button"
                  aria-label={`Konumum (${label})`}
                  title="Konumumu kullan"
                  disabled={locating}
                  onClick={() => dispatch({ type: 'locate', role })}
                  className="grid h-full w-10 place-items-center text-brand-soft-blue hover:text-brand-orange focus-visible:outline-2 focus-visible:outline-brand-soft-blue disabled:opacity-60"
                >
                  {locating
                    ? <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                    : <LocateFixed aria-hidden="true" className="size-4" />}
                </button>
              )}
              {query && (
                <button
                  type="button"
                  aria-label={`${label} alanını temizle`}
                  className="grid h-full w-10 place-items-center rounded-r-xl text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-soft-blue"
                  onClick={() => { input.current?.focus(); editLocation(''); }}
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>
            {expanded && (
              <ul
                id={listId}
                role="listbox"
                aria-label={`${label} konum önerileri`}
                className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
              >
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.id} role="presentation">
                    <button
                      id={`${listId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choosePlace(suggestion.id)}
                      className="w-full border-b border-gray-100 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 aria-selected:bg-brand-light-blue/40"
                    >
                      {suggestion.description}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <p id={statusId} role="status" className={lookup.kind === 'error' ? 'text-sm text-red-700' : 'text-sm text-gray-600'}>
        {message}
      </p>
    </div>
  );
}
