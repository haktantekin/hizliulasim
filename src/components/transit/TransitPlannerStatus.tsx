import { AlertCircle, Loader2 } from 'lucide-react';
import type { PlannerRoute } from '@/lib/transit/presentation';

interface TransitPlannerStatusProps {
  route: PlannerRoute;
  canCalculate: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  onRetry: () => void;
}

const buttonClass = 'shrink-0 rounded px-1 py-1 text-sm font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-brand-soft-blue';

export default function TransitPlannerStatus({ route, canCalculate, onCancel, onSubmit, onRetry }: TransitPlannerStatusProps) {
  return (
    <div className={route.kind === 'loading' ? 'flex flex-wrap items-center gap-2' : 'contents'}>
      <div role="status" className={route.kind === 'loading' ? undefined : 'sr-only'}>
        {route.kind === 'loading' && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" />
            Rota hesaplanıyor…
          </p>
        )}
        {route.kind === 'success' && <span className="sr-only">{route.alternatives.length} rota bulundu.</span>}
      </div>
      {route.kind === 'loading' && (
        <button type="button" onClick={onCancel} className={`${buttonClass} text-brand-soft-blue`}>İptal et</button>
      )}
      {route.kind === 'idle' && (
        <button
          type="button"
          disabled={!canCalculate}
          onClick={onSubmit}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-orange px-5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange disabled:cursor-not-allowed disabled:opacity-40"
        >
          Yol Tarifi
        </button>
      )}
      {route.kind === 'error' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p role="alert" className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {route.message}
          </p>
          <button type="button" onClick={onRetry} className={buttonClass}>Tekrar dene</button>
        </div>
      )}
    </div>
  );
}
