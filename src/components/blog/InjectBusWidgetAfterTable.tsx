'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import HomeBusFinder from '@/components/home/HomeBusFinder';

function findTargetTable(): HTMLTableElement | null {
  const article = document.querySelector('.post-detail');
  if (!article) return null;

  const headingCandidates = article.querySelectorAll('h1, h2, h3, h4, h5, h6, p, strong, b');

  for (const candidate of headingCandidates) {
    const text = candidate.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!text) continue;

    // Example target: "Mecidiyekoy giden Otobus Hatlari"
    if (!/\S+\s+giden\s+otob[üu]s\s+hatlar[ıi]/i.test(text)) {
      continue;
    }

    let cursor: Element | null = candidate.nextElementSibling;
    while (cursor) {
      if (cursor instanceof HTMLTableElement) {
        return cursor;
      }

      const nestedTable = cursor.querySelector('table');
      if (nestedTable instanceof HTMLTableElement) {
        return nestedTable;
      }

      // Stop scanning when next section begins
      if (/^H[1-6]$/.test(cursor.tagName)) {
        break;
      }

      cursor = cursor.nextElementSibling;
    }
  }

  return null;
}

export default function InjectBusWidgetAfterTable() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const table = findTargetTable();
    if (!table) return;

    const host = document.createElement('div');
    host.className = 'mt-6';
    table.insertAdjacentElement('afterend', host);
    setPortalTarget(host);

    return () => {
      setPortalTarget(null);
      host.remove();
    };
  }, []);

  if (!portalTarget) return null;

  return createPortal(<HomeBusFinder />, portalTarget);
}
