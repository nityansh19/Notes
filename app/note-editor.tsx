'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Toggle } from '@/lib/toggle';
import { bookmarkPreview } from '@/lib/bookmark';
import Embed from './embed';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from '@tiptap/markdown';
import { createLowlight, common } from 'lowlight';
import { useState, useEffect, useRef } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link,
  ImagePlus,
  Minus,
  Table,
  Undo2,
  Redo2,
  Highlighter,
  Paperclip,
  Copy,
  Maximize2,
  Minimize2,
  History,
  ArrowLeft,
  Pin,
  Star,
  Archive,
  Trash2,
  Download,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Choice } from './choice';
import CanvasBoard from './canvas-board';
import { Checkbox } from '@/components/ui/checkbox';
import type { Item, Vault } from '@/lib/model';
const lowlight = createLowlight(common);
export default function NoteEditor({
  item,
  vault,
  onClose,
  onSave,
  onAction,
  onUpload,
  notify,
  settings,
  registerFlush,
}: {
  item: Item;
  vault: Vault;
  onClose: () => void;
  onSave: (item: Item) => Promise<Item>;
  onAction: (action: string, item: Item) => void;
  onUpload: (file: File, id?: string) => Promise<any>;
  notify: (s: string) => void;
  settings: Record<string, any>;
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
}) {
  const [draft, setDraft] = useState(item),
    [saveState, setSaveState] = useState('Saved'),
    [focus, setFocus] = useState(false),
    [slash, setSlash] = useState(false),
    [insert, setInsert] = useState(''),
    [input, setInput] = useState(''),
    [history, setHistory] = useState<any[] | null>(null),
    [markdownMode, setMarkdownMode] = useState(false);
  const draftRef = useRef(item),
    dirty = useRef(false),
    saving = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    fileRef = useRef<HTMLInputElement>(null),
    saveRef = useRef<() => Promise<void>>(async () => {});
  const change = (patch: Partial<Item>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    dirty.current = true;
    setSaveState('Unsaved');
    if (timer.current) clearTimeout(timer.current);
    if (settings.autosave !== false)
      timer.current = setTimeout(() => void saveRef.current(), 700);
  };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Toggle,
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: false,
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing, or type / for commands…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit,
      Image.configure({ allowBase64: false }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Markdown,
    ],
    content: JSON.parse(item.content),
    editorProps: {
      attributes: { 'aria-label': 'Note content', spellcheck: 'true' },
      handleKeyDown: (_view, event) => {
        if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
          setSlash(true);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) =>
      change({
        content: JSON.stringify(editor.getJSON()),
        markdown: editor.getMarkdown(),
      }),
  });
  saveRef.current = async () => {
    if (saving.current || !dirty.current) return;
    saving.current = true;
    setSaveState('Saving');
    const snapshot = { ...draftRef.current };
    dirty.current = false;
    try {
      const saved = await onSave(snapshot);
      draftRef.current = {
        ...draftRef.current,
        revision: saved.revision,
        updated: saved.updated,
      };
      setDraft(draftRef.current);
      setSaveState(dirty.current ? 'Unsaved' : 'Saved');
    } catch (e) {
      dirty.current = true;
      setSaveState('Save failed');
      notify(e instanceof Error ? e.message : 'Save failed');
      return;
    } finally {
      saving.current = false;
    }
    if (dirty.current && settings.autosave !== false)
      timer.current = setTimeout(() => void saveRef.current(), 1200);
  };
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('beforeunload', protect);
    window.addEventListener('keydown', keys);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener('beforeunload', protect);
      window.removeEventListener('keydown', keys);
    };
  }, []);
  useEffect(() => {
    registerFlush(async () => {
      while (saving.current)
        await new Promise((resolve) => setTimeout(resolve, 40));
      await saveRef.current();
      while (saving.current)
        await new Promise((resolve) => setTimeout(resolve, 40));
      return !dirty.current;
    });
    return () => registerFlush(null);
  }, []);
  const close = async () => {
    while (saving.current)
      await new Promise((resolve) => setTimeout(resolve, 40));
    await saveRef.current();
    if (!dirty.current && !saving.current) onClose();
  };
  const commands = [
    [
      'Link a note',
      () => {
        setInsert('Note');
        setInput('');
      },
    ],
    ['Text', () => editor?.chain().focus().setParagraph().run()],
    [
      'Heading',
      () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    ],
    ['Checklist', () => editor?.chain().focus().toggleTaskList().run()],
    ['Quote', () => editor?.chain().focus().toggleBlockquote().run()],
    ['Code', () => editor?.chain().focus().toggleCodeBlock().run()],
    ['Image', () => fileRef.current?.click()],
    [
      'Table',
      () =>
        editor
          ?.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    ],
    [
      'Callout',
      () => editor?.chain().focus().toggleBlockquote().toggleHighlight().run(),
    ],
    ['Divider', () => editor?.chain().focus().setHorizontalRule().run()],
    [
      'Embed',
      () => {
        setInsert('Embed');
        setInput('');
      },
    ],
    ['File', () => fileRef.current?.click()],
    [
      'Toggle',
      () =>
        editor
          ?.chain()
          .focus()
          .insertContent({
            type: 'details',
            attrs: { summary: 'Details' },
            content: [{ type: 'paragraph' }],
          })
          .run(),
    ],
    ['Task', () => editor?.chain().focus().toggleTaskList().run()],
  ] as const;
  const tools = [
    [Bold, 'Bold', () => editor?.chain().focus().toggleBold().run()],
    [Italic, 'Italic', () => editor?.chain().focus().toggleItalic().run()],
    [
      Underline,
      'Underline',
      () => editor?.chain().focus().toggleUnderline().run(),
    ],
    [
      Strikethrough,
      'Strikethrough',
      () => editor?.chain().focus().toggleStrike().run(),
    ],
    [List, 'Bullets', () => editor?.chain().focus().toggleBulletList().run()],
    [
      ListOrdered,
      'Numbered list',
      () => editor?.chain().focus().toggleOrderedList().run(),
    ],
    [
      CheckSquare,
      'Checklist',
      () => editor?.chain().focus().toggleTaskList().run(),
    ],
    [Quote, 'Quote', () => editor?.chain().focus().toggleBlockquote().run()],
    [Code, 'Code block', () => editor?.chain().focus().toggleCodeBlock().run()],
    [
      Link,
      'Link',
      () => {
        setInsert('Link');
        setInput('');
      },
    ],
    [ImagePlus, 'Image', () => fileRef.current?.click()],
    [
      Table,
      'Table',
      () =>
        editor
          ?.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    ],
    [
      Highlighter,
      'Highlight',
      () => editor?.chain().focus().toggleHighlight().run(),
    ],
    [Minus, 'Divider', () => editor?.chain().focus().setHorizontalRule().run()],
    [Undo2, 'Undo', () => editor?.chain().focus().undo().run()],
    [Redo2, 'Redo', () => editor?.chain().focus().redo().run()],
  ] as const;
  const related = vault.items.filter(
    (n) =>
      n.id !== item.id &&
      n.status === 'active' &&
      (draft.markdown.includes(`[[${n.title}]]`) ||
        n.markdown.includes(`[[${draft.title}]]`)),
  );
  const words = draft.markdown.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div
      onKeyDown={(e) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 'b' &&
          (e.target as HTMLElement).closest('[contenteditable]')
        )
          e.stopPropagation();
      }}
      className={`editor-overlay ${focus ? 'focus-mode' : ''}`}
    >
      <div className="editor-top">
        <button className="subtle" onClick={() => void close()}>
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="muted">
          {draft.type} /{' '}
          {vault.collections.find((c) => c.id === draft.collection_id)?.name ||
            'Unfiled'}
        </span>
        <div className="editor-actions">
          <button className="save-state" onClick={() => void saveRef.current()}>
            {saveState === 'Saving' ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <Check size={14} />
            )}{' '}
            {saveState}
          </button>
          <button
            title="Focus mode"
            aria-label="Focus mode"
            onClick={() => setFocus(!focus)}
          >
            {focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <button
            title="Version history"
            aria-label="Version history"
            onClick={async () => {
              try {
                const r = await fetch(`/api/vault?history=${item.id}`);
                if (!r.ok) throw Error('History unavailable');
                setHistory(((await r.json()) as any).versions);
              } catch (e) {
                notify(String(e));
              }
            }}
          >
            <History size={17} />
          </button>
          <button
            title="Pin"
            aria-label="Pin"
            className={draft.pinned ? 'selected' : ''}
            onClick={() => change({ pinned: draft.pinned ? 0 : 1 })}
          >
            <Pin size={17} />
          </button>
          <button
            title="Favorite"
            aria-label="Favorite"
            className={draft.favorite ? 'selected' : ''}
            onClick={() => change({ favorite: draft.favorite ? 0 : 1 })}
          >
            <Star size={17} />
          </button>
          <button
            title="Export Markdown"
            aria-label="Export Markdown"
            onClick={() => onAction('export', draft)}
          >
            <Download size={17} />
          </button>
        </div>
      </div>
      <div className="editor-layout">
        <article className="writing-page">
          <div className="eyebrow">
            {draft.type === 'journal'
              ? 'A PAGE FROM YOUR LIFE'
              : 'ROOM FOR A THOUGHT'}
          </div>
          <input
            className="title-input"
            aria-label="Note title"
            placeholder="Untitled"
            value={draft.title}
            onChange={(e) => change({ title: e.target.value })}
          />
          <div className="note-properties">
            <Choice
              label="Collection"
              value={draft.collection_id || 'none'}
              options={[
                { value: 'none', label: 'Unfiled' },
                ...vault.collections.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
              onChange={(s) =>
                change({ collection_id: s === 'none' ? null : s })
              }
            />
            <input
              aria-label="Tags, separated by commas"
              placeholder="Add tags, separated by commas"
              value={draft.tags.join(', ')}
              onChange={(e) =>
                change({ tags: e.target.value.split(',').map((s) => s.trim()) })
              }
            />
          </div>
          {draft.type === 'journal' && (
            <div className="journal-meta">
              <Choice
                label="Mood"
                value={draft.metadata.mood || 'reflective'}
                options={[
                  'wonderful',
                  'good',
                  'reflective',
                  'low',
                  'difficult',
                ].map((v) => ({ value: v, label: v }))}
                onChange={(mood) =>
                  change({ metadata: { ...draft.metadata, mood } })
                }
              />
              <input
                type="date"
                aria-label="Journal date"
                value={draft.metadata.date || draft.created.slice(0, 10)}
                onChange={(e) =>
                  change({
                    metadata: { ...draft.metadata, date: e.target.value },
                  })
                }
              />
              <input
                aria-label="Location"
                placeholder="Add a location"
                value={draft.metadata.location || ''}
                onChange={(e) =>
                  change({
                    metadata: { ...draft.metadata, location: e.target.value },
                  })
                }
              />
            </div>
          )}
          {draft.type === 'task' && (
            <div className="journal-meta">
              <label className="inline-label">
                <Checkbox
                  checked={!!draft.metadata.done}
                  onCheckedChange={(done) =>
                    change({ metadata: { ...draft.metadata, done } })
                  }
                />{' '}
                Completed
              </label>
              <input
                type="date"
                aria-label="Due date"
                value={draft.metadata.due || ''}
                onChange={(e) =>
                  change({
                    metadata: { ...draft.metadata, due: e.target.value },
                  })
                }
              />
            </div>
          )}
          {draft.type === 'bookmark' && (
            <input
              className="url-input"
              type="url"
              aria-label="Bookmark URL"
              placeholder="https://…"
              onBlur={async (e) => {
                try {
                  const value = e.target.value;
                  const preview = await bookmarkPreview(value);
                  if (draftRef.current.metadata.url !== value) return;
                  change({
                    title: draftRef.current.title || preview.siteTitle,
                    metadata: { ...draftRef.current.metadata, ...preview },
                  });
                } catch (error) {
                  notify((error as Error).message);
                }
              }}
              value={draft.metadata.url || ''}
              onChange={(e) =>
                change({ metadata: { ...draft.metadata, url: e.target.value } })
              }
            />
          )}
          {draft.type === 'bookmark' && (
            <>
              <input
                className="url-input"
                aria-label="Bookmark description"
                placeholder="A few words about this link…"
                value={draft.metadata.description || ''}
                onChange={(e) =>
                  change({
                    metadata: {
                      ...draft.metadata,
                      description: e.target.value,
                    },
                  })
                }
              />
              {/^https?:\/\//.test(draft.metadata.url || '') && (
                <a
                  className="text-button"
                  href={draft.metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open saved website ↗
                </a>
              )}
            </>
          )}
          {draft.type === 'project' && (
            <div className="journal-meta">
              <Choice
                label="Project status"
                value={draft.metadata.stage || 'Planning'}
                options={['Planning', 'In progress', 'On hold', 'Complete'].map(
                  (v) => ({ value: v, label: v }),
                )}
                onChange={(stage) =>
                  change({ metadata: { ...draft.metadata, stage } })
                }
              />
              <input
                type="date"
                aria-label="Project deadline"
                value={draft.metadata.due || ''}
                onChange={(e) =>
                  change({
                    metadata: { ...draft.metadata, due: e.target.value },
                  })
                }
              />
            </div>
          )}
          {draft.type === 'code' && (
            <div className="journal-meta">
              <Choice
                label="Code language"
                value={draft.metadata.language || 'auto'}
                options={[
                  'auto',
                  'python',
                  'javascript',
                  'typescript',
                  'sql',
                  'html',
                  'css',
                  'java',
                  'bash',
                  'json',
                ].map((v) => ({ value: v, label: v }))}
                onChange={(language) => {
                  change({ metadata: { ...draft.metadata, language } });
                  editor
                    ?.chain()
                    .focus()
                    .updateAttributes('codeBlock', {
                      language: language === 'auto' ? null : language,
                    })
                    .run();
                }}
              />
              <button
                className="subtle"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(editor?.getText() || '')
                    .then(() => notify('Copied to clipboard.'))
                    .catch(() => notify('Clipboard unavailable.'));
                }}
              >
                <Copy size={14} />
                Copy code
              </button>
            </div>
          )}
          <div className="format-toolbar">
            {tools.map(([Icon, label, run]) => (
              <button
                key={label}
                title={label}
                aria-label={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={run}
              >
                <Icon size={16} />
              </button>
            ))}
            <button
              className="mode-button"
              onClick={() => setMarkdownMode(!markdownMode)}
            >
              {markdownMode ? 'Rich text' : 'Markdown'}
            </button>
          </div>
          {draft.type === 'canvas' && (
            <CanvasBoard
              value={draft.metadata.cards || []}
              onChange={(cards) =>
                change({ metadata: { ...draft.metadata, cards } })
              }
              items={vault.items.filter(
                (n) => n.id !== draft.id && n.status === 'active',
              )}
              onOpen={async (n) => {
                await saveRef.current();
                if (!dirty.current) onAction('open', n);
              }}
            />
          )}
          {markdownMode ? (
            <textarea
              className="markdown-editor"
              aria-label="Markdown source"
              value={draft.markdown}
              onChange={(e) => {
                editor?.commands.setContent(e.target.value, {
                  contentType: 'markdown',
                });
              }}
            />
          ) : (
            <EditorContent
              editor={editor}
              style={{
                fontSize: `${settings.fontSize || 17}px`,
                lineHeight: settings.lineHeight || 1.8,
                fontFamily:
                  settings.editorFont === 'serif'
                    ? 'Georgia, serif'
                    : settings.editorFont === 'mono'
                      ? 'monospace'
                      : undefined,
              }}
            />
          )}
          <div className="editor-bottom">
            <span>
              {words} words · {Math.max(1, Math.ceil(words / 220))} min read
            </span>
            <button onClick={() => fileRef.current?.click()}>
              <Paperclip size={14} /> Attach a file
            </button>
          </div>
          {draft.metadata.embed && <Embed url={draft.metadata.embed} />}
          {vault.files
            .filter((f) => f.item_id === draft.id)
            .map((f) => (
              <a
                className="file-row"
                key={f.id}
                href={`/api/files?id=${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Paperclip size={16} />
                {f.name}
                <span>{Math.ceil(f.size / 1024)} KB</span>
              </a>
            ))}
          {draft.type === 'project' && (
            <div className="related">
              <h2>Milestones</h2>
              {(draft.metadata.milestones || []).map((m: any, i: number) => (
                <div className="task-row" key={m.id}>
                  <Checkbox
                    aria-label={m.title}
                    checked={m.done}
                    onCheckedChange={(done) =>
                      change({
                        metadata: {
                          ...draft.metadata,
                          milestones: draft.metadata.milestones.map(
                            (v: any, j: number) =>
                              i === j ? { ...v, done } : v,
                          ),
                        },
                      })
                    }
                  />
                  <input
                    className="milestone-title"
                    aria-label="Milestone title"
                    value={m.title}
                    onChange={(e) =>
                      change({
                        metadata: {
                          ...draft.metadata,
                          milestones: draft.metadata.milestones.map(
                            (v: any, j: number) =>
                              i === j ? { ...v, title: e.target.value } : v,
                          ),
                        },
                      })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Milestone date"
                    value={m.date || ''}
                    onChange={(e) =>
                      change({
                        metadata: {
                          ...draft.metadata,
                          milestones: draft.metadata.milestones.map(
                            (v: any, j: number) =>
                              i === j ? { ...v, date: e.target.value } : v,
                          ),
                        },
                      })
                    }
                  />
                  <button
                    aria-label="Remove milestone"
                    onClick={() =>
                      change({
                        metadata: {
                          ...draft.metadata,
                          milestones: draft.metadata.milestones.filter(
                            (_: any, j: number) => j !== i,
                          ),
                        },
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="text-button"
                onClick={() =>
                  change({
                    metadata: {
                      ...draft.metadata,
                      milestones: [
                        ...(draft.metadata.milestones || []),
                        {
                          id: crypto.randomUUID(),
                          title: 'New milestone',
                          done: false,
                          date: '',
                        },
                      ],
                    },
                  })
                }
              >
                + Add milestone
              </button>
              <h2>In this project</h2>
              {vault.items
                .filter(
                  (n) => n.project_id === draft.id && n.status === 'active',
                )
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={async () => {
                      await saveRef.current();
                      if (!dirty.current) onAction('open', n);
                    }}
                  >
                    {n.type} · {n.title || 'Untitled'}
                  </button>
                ))}
              <p>
                Assign notes and tasks using the Project field in their details.
              </p>
            </div>
          )}
        </article>
        <aside className="note-inspector">
          <div className="eyebrow">NOTE DETAILS</div>
          <dl>
            <dt>Created</dt>
            <dd>{new Date(draft.created).toLocaleDateString()}</dd>
            <dt>Last edited</dt>
            <dd>{new Date(draft.updated).toLocaleString()}</dd>
            <dt>Project</dt>
            <dd>
              <Choice
                label="Project"
                value={draft.project_id || 'none'}
                options={[
                  { value: 'none', label: 'No project' },
                  ...vault.items
                    .filter(
                      (n) =>
                        n.type === 'project' &&
                        n.id !== draft.id &&
                        n.status === 'active',
                    )
                    .map((n) => ({ value: n.id, label: n.title })),
                ]}
                onChange={(s) =>
                  change({ project_id: s === 'none' ? null : s })
                }
              />
            </dd>
          </dl>
          <div className="eyebrow">CONNECTED THOUGHTS</div>
          {related.length ? (
            related.map((n) => (
              <button
                className="related-link"
                key={n.id}
                onClick={async () => {
                  await saveRef.current();
                  if (!dirty.current) onAction('open', n);
                }}
              >
                {n.title}
              </button>
            ))
          ) : (
            <p>Link a thought with [[Note title]] to connect your knowledge.</p>
          )}
          <div className="inspector-actions">
            <button
              onClick={async () => {
                await saveRef.current();
                if (!dirty.current) onAction('duplicate', draftRef.current);
              }}
            >
              <Copy size={15} />
              Duplicate
            </button>
            <button
              onClick={async () => {
                await saveRef.current();
                if (!dirty.current) onAction('archive', draftRef.current);
              }}
            >
              <Archive size={15} />
              Archive
            </button>
            <button
              onClick={async () => {
                await saveRef.current();
                if (!dirty.current) onAction('trash', draftRef.current);
              }}
            >
              <Trash2 size={15} />
              Move to trash
            </button>
          </div>
        </aside>
      </div>
      <input
        hidden
        type="file"
        multiple
        ref={fileRef}
        onChange={async (e) => {
          for (const file of Array.from(e.target.files || [])) {
            try {
              const saved = await onUpload(file, draft.id);
              if (
                [
                  'image/png',
                  'image/jpeg',
                  'image/webp',
                  'image/gif',
                  'image/avif',
                ].includes(file.type)
              )
                editor
                  ?.chain()
                  .focus()
                  .setImage({ src: saved.url, alt: file.name })
                  .run();
            } catch (error) {
              notify(String(error));
            }
          }
          e.target.value = '';
        }}
      />
      <Dialog open={slash} onOpenChange={setSlash}>
        <DialogContent className="command-modal">
          <DialogTitle>Insert a block</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a block for your note.
          </DialogDescription>
          <Command>
            <CommandInput placeholder="Find a block…" />
            <CommandList>
              {commands.map(([name, run]) => (
                <CommandItem
                  key={name}
                  onSelect={() => {
                    setSlash(false);
                    run();
                  }}
                >
                  {name}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
      <Dialog open={!!insert} onOpenChange={(v) => !v && setInsert('')}>
        <DialogContent>
          <DialogTitle>Add {insert.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {insert === 'Note'
              ? 'Connect this thought to another note.'
              : 'Use a full https:// address.'}
          </DialogDescription>
          {insert === 'Note' && (
            <Command>
              <CommandInput placeholder="Find a note…" />
              <CommandList>
                {vault.items
                  .filter((n) => n.id !== draft.id && n.status === 'active')
                  .map((n) => (
                    <CommandItem
                      key={n.id}
                      onSelect={() => {
                        editor
                          ?.chain()
                          .focus()
                          .insertContent(`[[${n.title}]]`)
                          .run();
                        setInsert('');
                      }}
                    >
                      {n.title || 'Untitled'}
                    </CommandItem>
                  ))}
              </CommandList>
            </Command>
          )}
          <input
            className="field"
            autoFocus
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="URL"
          />
          <button
            className="primary"
            onClick={() => {
              try {
                const url = new URL(input);
                if (!['https:', 'http:'].includes(url.protocol)) throw Error();
                if (insert === 'Embed')
                  change({ metadata: { ...draft.metadata, embed: url.href } });
                else editor?.chain().focus().setLink({ href: url.href }).run();
                setInsert('');
              } catch {
                notify('Enter a valid http or https URL.');
              }
            }}
          >
            Insert
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={history !== null}
        onOpenChange={(v) => !v && setHistory(null)}
      >
        <DialogContent className="history-modal">
          <DialogTitle>Earlier versions</DialogTitle>
          <DialogDescription>
            Restore a previous version without losing the current one.
          </DialogDescription>
          <div className="history-list">
            {history?.length ? (
              history.map((v) => (
                <div key={v.id}>
                  <div>
                    <strong>{v.snapshot.title || 'Untitled'}</strong>
                    <p>{new Date(v.created).toLocaleString()}</p>
                    <pre>{v.snapshot.markdown?.slice(0, 220)}</pre>
                  </div>
                  <button
                    className="subtle"
                    onClick={() => {
                      change({
                        ...v.snapshot,
                        revision: draftRef.current.revision,
                        tags: v.snapshot.tags || draft.tags,
                      });
                      editor?.commands.setContent(
                        JSON.parse(v.snapshot.content),
                      );
                      setHistory(null);
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))
            ) : (
              <p>No earlier versions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
