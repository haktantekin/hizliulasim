'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  className?: string;
}

export default function FaqAccordion({ items, className = '' }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <section className={`mt-10 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-brand-soft-blue">Sıkça Sorulan Sorular</h2>
      <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        {items.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="bg-white">
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <svg
                  className={`w-5 h-5 shrink-0 ml-2 text-brand-soft-blue transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div
                  className="px-4 pb-4 text-sm text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: item.answer }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
