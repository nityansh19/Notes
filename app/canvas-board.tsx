'use client';
import { useRef, useState } from 'react';
import { Plus, Minus, Trash2, Move, RotateCcw } from 'lucide-react';
import type { Item } from '@/lib/model';
import { Choice } from './choice';
type Card = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  noteId?: string;
};
export default function CanvasBoard({
  value,
  onChange,
  items,
  onOpen,
}: {
  value: Card[];
  onChange: (cards: Card[]) => void;
  items: Item[];
  onOpen: (n: Item) => void;
}) {
  const [zoom, setZoom] = useState(1),
    [link, setLink] = useState('none');
  const drag = useRef<{
    id: string;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const update = (id: string, patch: Partial<Card>) =>
    onChange(latest.current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="canvas-board">
      <div className="view-toolbar">
        <button
          className="subtle"
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                x: 30 + (value.length % 4) * 35,
                y: 30 + (value.length % 5) * 35,
                text: '',
                color: '#f3e9b9',
              },
            ])
          }
        >
          <Plus size={16} />
          Add thought
        </button>
        <Choice
          label="Link a note"
          value={link}
          options={[
            { value: 'none', label: 'Add a note' },
            ...items.map((n) => ({
              value: n.id,
              label: n.title || 'Untitled',
            })),
          ]}
          onChange={(id) => {
            const n = items.find((n) => n.id === id);
            if (n) {
              onChange([
                ...value,
                {
                  id: crypto.randomUUID(),
                  x: 60,
                  y: 60,
                  text: n.title,
                  color: '#dce9e0',
                  noteId: n.id,
                },
              ]);
              setLink('none');
            }
          }}
        />
        <button
          className="icon-button"
          aria-label="Zoom in canvas"
          onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out canvas"
          onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
        >
          <Minus size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Reset canvas zoom"
          onClick={() => setZoom(1)}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="canvas-viewport">
        <div
          className="canvas-space"
          style={{ width: 1600 * zoom, height: 1000 * zoom }}
        >
          <div
            style={{
              width: 1600,
              height: 1000,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {value.map((c) => (
              <div
                key={c.id}
                className="canvas-card"
                style={{ left: c.x, top: c.y, background: c.color }}
              >
                <div
                  className="canvas-handle"
                  role="button"
                  tabIndex={0}
                  aria-label="Move thought with arrow keys"
                  onKeyDown={(e) => {
                    const dx =
                        e.key === 'ArrowLeft'
                          ? -10
                          : e.key === 'ArrowRight'
                            ? 10
                            : 0,
                      dy =
                        e.key === 'ArrowUp'
                          ? -10
                          : e.key === 'ArrowDown'
                            ? 10
                            : 0;
                    if (dx || dy) {
                      e.preventDefault();
                      update(c.id, {
                        x: Math.max(0, c.x + dx),
                        y: Math.max(0, c.y + dy),
                      });
                    }
                  }}
                  onPointerDown={(e) => {
                    drag.current = {
                      id: c.id,
                      x: e.clientX,
                      y: e.clientY,
                      left: c.x,
                      top: c.y,
                    };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (drag.current?.id === c.id)
                      update(c.id, {
                        x: Math.max(
                          0,
                          Math.min(
                            1360,
                            drag.current.left +
                              (e.clientX - drag.current.x) / zoom,
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            780,
                            drag.current.top +
                              (e.clientY - drag.current.y) / zoom,
                          ),
                        ),
                      });
                  }}
                  onPointerUp={() => (drag.current = null)}
                >
                  <Move size={14} />
                  <span>THOUGHT</span>
                </div>
                <textarea
                  aria-label="Canvas thought"
                  placeholder="A thought worth keeping…"
                  value={c.text}
                  onChange={(e) => update(c.id, { text: e.target.value })}
                />
                <div className="canvas-card-footer">
                  {c.noteId && (
                    <button
                      onClick={() => {
                        const n = items.find((n) => n.id === c.noteId);
                        if (n) onOpen(n);
                      }}
                    >
                      Open note ↗
                    </button>
                  )}
                  <input
                    aria-label="Thought color"
                    type="color"
                    value={c.color}
                    onChange={(e) => update(c.id, { color: e.target.value })}
                  />
                  <button
                    aria-label="Remove canvas thought"
                    onClick={() => onChange(value.filter((n) => n.id !== c.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="settings-note">
        Drag thoughts by their handle. Use the scrollbars to explore your
        canvas.
      </p>
    </div>
  );
}
