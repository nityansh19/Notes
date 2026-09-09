'use client';
import { useState, useMemo, useRef } from 'react';
import { Plus, Minus, RotateCcw, Search } from 'lucide-react';
import { Choice } from './choice';
import type { Item, Collection } from '@/lib/model';
export default function Graph({
  items,
  collections,
  onOpen,
}: {
  items: Item[];
  collections: Collection[];
  onOpen: (n: Item) => void;
}) {
  const [query, setQuery] = useState(''),
    [collection, setCollection] = useState('all'),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const nodes = useMemo(
    () =>
      items
        .filter(
          (n) =>
            (collection === 'all' || n.collection_id === collection) &&
            [n.title, ...n.tags]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, 150)
        .map((n, i, a) => ({
          ...n,
          x: 450 + Math.cos(i * 2.39996) * Math.sqrt(i + 1) * 24,
          y: 300 + Math.sin(i * 2.39996) * Math.sqrt(i + 1) * 20,
        })),
    [items, query, collection],
  );
  const edges = nodes.flatMap((n) =>
    nodes
      .filter((t) => t.id !== n.id && n.markdown.includes(`[[${t.title}]]`))
      .map((t) => ({ source: n, target: t })),
  );
  return (
    <div className="graph-shell">
      <div className="view-toolbar">
        <div className="filter-search">
          <Search size={16} />
          <input
            aria-label="Search graph"
            placeholder="Find a thought or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Choice
          label="Collection filter"
          value={collection}
          options={[
            { value: 'all', label: 'All collections' },
            ...collections.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={setCollection}
        />
        <button
          className="icon-button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
        >
          <Plus size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
        >
          <Minus size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Reset graph"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <svg
        className="knowledge-graph"
        viewBox="0 0 900 600"
        role="img"
        aria-label="Knowledge graph. Use Tab to select notes and Enter to open."
        onPointerDown={(e) => {
          if ((e.target as Element).tagName !== 'svg') return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) {
            const r = e.currentTarget.getBoundingClientRect();
            setPan({
              x:
                drag.current.px +
                ((e.clientX - drag.current.x) * 900) / r.width,
              y:
                drag.current.py +
                ((e.clientY - drag.current.y) * 600) / r.height,
            });
          }
        }}
        onPointerUp={() => (drag.current = null)}
      >
        <g
          transform={`translate(${pan.x} ${pan.y}) translate(450 300) scale(${zoom}) translate(-450 -300)`}
        >
          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.source.x}
              y1={e.source.y}
              x2={e.target.x}
              y2={e.target.y}
              stroke="var(--primary)"
              opacity=".22"
            />
          ))}
          {nodes.map((n) => (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-label={n.title || 'Untitled'}
              onClick={() => onOpen(n)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(n)}
              className="graph-node"
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={n.pinned ? 13 : 8}
                fill={
                  collections.find((c) => c.id === n.collection_id)?.color ||
                  'var(--primary)'
                }
              />
              <text
                x={n.x}
                y={n.y + 27}
                textAnchor="middle"
                fill="var(--foreground)"
                fontSize="12"
              >
                {(n.title || 'Untitled').slice(0, 24)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {!nodes.length && (
        <div className="graph-empty">
          <h2>Every connection begins with a thought.</h2>
          <p>Create notes, then link them with [[Note title]].</p>
        </div>
      )}
      <div className="graph-legend">
        <span>
          {nodes.length} thoughts · {edges.length} connections
        </span>
        <span>Drag empty space to pan · Click a thought to open</span>
      </div>
    </div>
  );
}
