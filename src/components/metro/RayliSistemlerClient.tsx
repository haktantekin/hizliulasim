'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import type { MetroLine, MetroRailwayGroup } from '@/types/metro';
import {
  Search, X, Loader2, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

const GROUP_ICONS: Record<string, string> = {
  'Metro Hatları': '🚇',
  'Tramvay Hatları': '🚊',
  'Füniküler Hatları': '🚡',
  'Teleferik Hatları': '🚠',
};

const GROUP_ORDER = ['Metro Hatları', 'Tramvay Hatları', 'Füniküler Hatları', 'Teleferik Hatları'];

function colorToCSS(color: MetroLine['Color']): string {
  if (!color) return '#6B7280';
  if (typeof color === 'string') return color;
  return `rgb(${color.Color_R},${color.Color_G},${color.Color_B})`;
}

export default function RayliSistemlerClient() {
  const [groups, setGroups] = useState<MetroRailwayGroup[]>([]);
  const [lines, setLines] = useState<MetroLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(false);
        const [groupsRes, linesRes] = await Promise.all([
          fetch('/api/metro/gruplar'),
          fetch('/api/metro'),
        ]);

        if (!groupsRes.ok || !linesRes.ok) throw new Error('API error');

        const [groupsData, linesData] = await Promise.all([
          groupsRes.json(),
          linesRes.json(),
        ]);

        if (cancelled) return;
        setGroups(Array.isArray(groupsData) ? groupsData : []);
        setLines(Array.isArray(linesData) ? linesData : []);
        // Expand first group by default
        if (Array.isArray(groupsData) && groupsData.length > 0) {
          setExpandedGroup(groupsData[0].Name || null);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Build a lookup from line Id to MetroLine
  const lineMap = useMemo(() => {
    const map = new Map<number, MetroLine>();
    for (const l of lines) map.set(l.Id, l);
    return map;
  }, [lines]);

  // Build grouped lines: join groups (Record<id,name>) with full line objects
  const groupedLines = useMemo(() => {
    if (groups.length > 0 && lines.length > 0) {
      return groups
        .sort((a, b) => {
          const ai = GROUP_ORDER.indexOf(a.Name);
          const bi = GROUP_ORDER.indexOf(b.Name);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        })
        .map(g => {
          // g.Lines is Record<string, string> e.g. { "9": "M1A", "1": "M2" }
          const groupLines: MetroLine[] = [];
          if (g.Lines && typeof g.Lines === 'object') {
            for (const [idStr] of Object.entries(g.Lines)) {
              const line = lineMap.get(Number(idStr));
              if (line) groupLines.push(line);
            }
          }
          groupLines.sort((a, b) => (a.Name || '').localeCompare(b.Name || '', 'tr'));
          return { name: g.Name, lines: groupLines };
        });
    }
    // Fallback: group by Name prefix
    const map = new Map<string, MetroLine[]>();
    for (const line of lines) {
      const name = line.Name || '';
      let group = 'Diğer';
      if (name.startsWith('M')) group = 'Metro Hatları';
      else if (name.startsWith('T')) group = 'Tramvay Hatları';
      else if (name.startsWith('F')) group = 'Füniküler Hatları';
      else if (name.startsWith('TF')) group = 'Teleferik Hatları';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(line);
    }
    return GROUP_ORDER
      .filter(g => map.has(g))
      .map(g => ({ name: g, lines: map.get(g)! }));
  }, [groups, lines, lineMap]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedLines;
    const q = search.toUpperCase().trim();
    return groupedLines
      .map(g => ({
        ...g,
        lines: g.lines.filter(
          l =>
            (l.Name || '').toUpperCase().includes(q) ||
            (l.LongDescription || '').toUpperCase().includes(q)
        ),
      }))
      .filter(g => g.lines.length > 0);
  }, [groupedLines, search]);

  const stats = useMemo(() => {
    const allLines = groupedLines.flatMap(g => g.lines);
    return {
      total: allLines.length,
      active: allLines.filter(l => l.IsActive).length,
    };
  }, [groupedLines]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p className="text-sm">Raylı sistem bilgileri yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Bilgiler yüklenirken bir hata oluştu.</p>
        <p className="text-sm text-red-500 mt-1">Lütfen daha sonra tekrar deneyin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
          <div className="text-xs text-blue-500">Toplam Hat</div>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.active}</div>
          <div className="text-xs text-green-500">Aktif Hat</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hat adı veya kodu ara... (örn. M2, Taksim)"
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-soft-blue/30 focus:border-brand-soft-blue"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Grouped lines */}
      <div className="space-y-3">
        {filteredGroups.map(group => {
          const isExpanded = expandedGroup === group.name || !!search.trim();
          return (
            <div key={group.name} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedGroup(isExpanded && !search ? null : group.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{GROUP_ICONS[group.name] || '🚃'}</span>
                  <span className="font-semibold text-gray-800">{group.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {group.lines.length} hat
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-50 p-3 space-y-2">
                  {group.lines.map(line => {
                    return (
                      <Link
                        key={line.Id}
                        href={`/rayli-sistemler/${line.Name}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {/* Color indicator */}
                        <div
                          className="w-3 h-3 rounded-full flex-none"
                          style={{ backgroundColor: colorToCSS(line.Color) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">
                              {line.Name}
                            </span>
                            <span className="text-sm text-gray-600 truncate">
                              {line.LongDescription}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            {line.FirstTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {line.FirstTime} – {line.LastTime}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-none ${
                            line.IsActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {line.IsActive ? 'Aktif' : 'Kapalı'}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Aramanızla eşleşen hat bulunamadı.
        </div>
      )}
    </div>
  );
}
