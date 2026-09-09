'use client';
import { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import {
  Home,
  Files,
  Zap,
  Star,
  Clock,
  Folder,
  Layers,
  BookOpen,
  CircleCheck,
  Bookmark,
  Code,
  Network,
  Archive,
  Trash2,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  Feather,
  SlidersHorizontal,
  Pin,
  Upload,
  Download,
  Bell,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  PanelTop,
  FileText,
  Lightbulb,
  PenLine,
  RefreshCw,
  Lock,
  LogOut,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandShortcut,
} from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Choice } from './choice';
import {
  emptyDoc,
  searchItems,
  types,
  type Item,
  type Vault,
  type Collection,
} from '@/lib/model';
const NoteEditor = lazy(() => import('./note-editor'));
const Graph = lazy(() => import('./graph'));
const navigation = [
  [Home, 'Home'],
  [Files, 'All notes'],
  [Zap, 'Quick capture'],
  [Star, 'Favorites'],
  [Clock, 'Recent'],
  [Folder, 'Collections'],
  [Layers, 'Projects'],
  [BookOpen, 'Journal'],
  [CircleCheck, 'Tasks'],
  [Bookmark, 'Bookmarks'],
  [Code, 'Code'],
  [Files, 'Files'],
  [Network, 'Knowledge graph'],
  [Archive, 'Archive'],
  [Trash2, 'Trash'],
] as const;
const iconFor: Record<string, typeof FileText> = {
  note: FileText,
  quick: Zap,
  journal: BookOpen,
  checklist: CircleCheck,
  task: CircleCheck,
  bookmark: Bookmark,
  code: Code,
  idea: Lightbulb,
  document: Files,
  project: Layers,
  canvas: PanelTop,
};
const labels: Record<string, string> = {
  note: 'Note',
  quick: 'Quick note',
  journal: 'Journal entry',
  checklist: 'Checklist',
  task: 'Task',
  bookmark: 'Bookmark',
  code: 'Code snippet',
  idea: 'Idea',
  document: 'Document',
  project: 'Project',
  canvas: 'Canvas',
};
const blank: Vault = {
  items: [],
  collections: [],
  files: [],
  activity: [],
  settings: {},
  user: { name: 'Your workspace', email: '' },
};
const defaultModules = [
  'Pinned',
  'Recently edited',
  'Journal',
  'Collections',
  'Tasks',
  'Projects',
  'Bookmarks',
];
const when = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const safeUrl = (s: string) => {
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
};
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Workspace() {
  const [vault, setVault] = useState<Vault>(blank),
    [view, setView] = useState('Home'),
    [selected, setSelected] = useState<string | null>(null),
    [palette, setPalette] = useState<'search' | 'create' | null>(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [layout, setLayout] = useState('grid'),
    [settingsOpen, setSettingsOpen] = useState(false),
    [customize, setCustomize] = useState(false),
    [collectionModal, setCollectionModal] = useState(false),
    [collectionName, setCollectionName] = useState(''),
    [collectionColor, setCollectionColor] = useState('#638771'),
    [editingCollection, setEditingCollection] = useState<Collection | null>(
      null,
    ),
    [notice, setNotice] = useState(''),
    [undo, setUndo] = useState<Item | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [activityOpen, setActivityOpen] = useState(false),
    [deleteTarget, setDeleteTarget] = useState<Item | null>(null),
    [recentSearches, setRecentSearches] = useState<string[]>([]),
    [limit, setLimit] = useState(60),
    [quick, setQuick] = useState(''),
    [journalView, setJournalView] = useState('feed'),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    vaultRef = useRef(vault);
  vaultRef.current = vault;
  const notify = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => {
      setNotice('');
      setUndo(null);
    }, 5000);
  };
  async function api(body: any, method = 'POST') {
    const res = await fetch('/api/vault', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = await res.text();
      try {
        message = JSON.parse(message).error || message;
      } catch {}
      throw Error(message || 'Could not save.');
    }
    return res.json() as Promise<any>;
  }
  const reload = async () => {
    try {
      setError('');
      const res = await fetch('/api/vault');
      if (!res.ok)
        throw Error(
          res.status === 401
            ? 'Sign in to open your private vault.'
            : 'Your vault could not load. Please retry.',
        );
      const data = (await res.json()) as Vault;
      setVault(data);
      setLayout(data.settings.defaultView || 'grid');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
    try {
      setRecentSearches(
        JSON.parse(localStorage.getItem('folio-searches') || '[]'),
      );
    } catch {}
  }, []);
  const setPrefs = async (patch: Record<string, any>) => {
    const value = { ...vaultRef.current.settings, ...patch };
    try {
      await api({ action: 'settings', value });
      setVault((v) => ({ ...v, settings: value }));
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    const settings = vault.settings;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle(
        'dark',
        settings.theme === 'dark' ||
          (settings.theme === 'system' && media.matches),
      );
      document.documentElement.dataset.motion =
        settings.animations === false ? 'off' : 'on';
      document.documentElement.dataset.density =
        settings.density || 'comfortable';
      if (settings.accent)
        document.documentElement.style.setProperty(
          '--primary',
          settings.accent,
        );
      else document.documentElement.style.removeProperty('--primary');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [vault.settings]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette('search');
        setQuery('');
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setPalette('create');
        setQuery('');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    setLimit(60);
  }, [view, query, filter]);
  const save = async (item: Item) => {
    const result = await api({ action: 'save', item });
    const saved = { ...item, ...result };
    setVault((v) => ({
      ...v,
      items: [saved, ...v.items.filter((n) => n.id !== saved.id)],
    }));
    return saved;
  };
  const create = async (type = 'note', title = '', markdown = '') => {
    if (flushRef.current && !(await flushRef.current()))
      throw Error('Save the current note before opening another.');
    setBusy(true);
    try {
      const now = new Date().toISOString();
      let doc: any = emptyDoc;
      if (markdown)
        doc = {
          type: 'doc',
          content: markdown
            .split('\n')
            .map((line) => ({
              type: 'paragraph',
              content: line ? [{ type: 'text', text: line }] : undefined,
            })),
        };
      if (type === 'code')
        doc = {
          type: 'doc',
          content: [{ type: 'codeBlock', attrs: { language: null } }],
        };
      if (type === 'checklist')
        doc = {
          type: 'doc',
          content: [
            {
              type: 'taskList',
              content: [
                {
                  type: 'taskItem',
                  attrs: { checked: false },
                  content: [{ type: 'paragraph' }],
                },
              ],
            },
          ],
        };
      const n: Item = {
        id: crypto.randomUUID(),
        type,
        title:
          title ||
          (type === 'journal'
            ? new Date().toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : ''),
        content: JSON.stringify(doc),
        markdown,
        collection_id: view.startsWith('collection:') ? view.slice(11) : null,
        project_id: null,
        metadata: type === 'journal' ? { date: now.slice(0, 10) } : {},
        pinned: 0,
        favorite: 0,
        status: 'active',
        created: now,
        updated: now,
        revision: 0,
        tags: [],
      };
      const saved = await save(n);
      setSelected(saved.id);
      setPalette(null);
      setQuery('');
      return saved;
    } catch (e) {
      notify((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const open = async (item: Item) => {
    if (flushRef.current && !(await flushRef.current())) return;
    setSelected(item.id);
    setPalette(null);
    void api({ action: 'opened', id: item.id }).catch(() => {});
  };
  const action = async (name: string, item: Item) => {
    try {
      if (name === 'open') {
        open(item);
        return;
      }
      if (name === 'export') {
        download(
          `${item.title || 'Untitled'}.md`,
          `# ${item.title}\n\n${item.markdown}`,
          'text/markdown',
        );
        return;
      }
      if (name === 'duplicate') {
        const copy = await save({
          ...item,
          id: crypto.randomUUID(),
          revision: 0,
          title: `${item.title || 'Untitled'} — copy`,
        });
        open(copy);
        notify('A fresh copy is ready.');
        return;
      }
      if (name === 'delete') {
        setDeleteTarget(item);
        return;
      }
      const patch =
        name === 'pin'
          ? { pinned: item.pinned ? 0 : 1 }
          : name === 'favorite'
            ? { favorite: item.favorite ? 0 : 1 }
            : {
                status:
                  name === 'archive'
                    ? 'archived'
                    : name === 'trash'
                      ? 'trash'
                      : 'active',
              };
      await save({ ...item, ...patch });
      if (name === 'trash' || name === 'archive') {
        setSelected(null);
        setUndo(item);
        notify(name === 'trash' ? 'Moved to trash.' : 'Archived.');
      } else if (name === 'restore') notify('Back in your vault.');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const upload = async (file: File, id?: string) => {
    const data = new FormData();
    data.set('file', file);
    if (id) data.set('itemId', id);
    const r = await fetch('/api/files', { method: 'POST', body: data });
    if (!r.ok) throw Error(`Could not upload ${file.name}.`);
    const result = (await r.json()) as any;
    setVault((v) => ({
      ...v,
      files: [
        { ...result, item_id: id || null, created: new Date().toISOString() },
        ...v.files,
      ],
    }));
    notify(`${file.name} is in your vault.`);
    return result;
  };
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'create_note',
            title: 'Create a note',
            description:
              'Save a private note in this vault and open it for editing.',
            inputSchema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['title', 'content'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async (input: any) => {
              if (
                !input ||
                typeof input.title !== 'string' ||
                typeof input.content !== 'string'
              )
                throw Error('title and content must be strings');
              const saved = await create('note', input.title, input.content);
              return { id: saved.id, title: saved.title };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const active = vault.items.filter((n) => n.status === 'active'),
    collection = vault.collections.find((c) => `collection:${c.id}` === view),
    title = collection?.name || view;
  const viewTypes: Record<string, string> = {
    'Quick capture': 'quick',
    Projects: 'project',
    Journal: 'journal',
    Tasks: 'task',
    Bookmarks: 'bookmark',
    Code: 'code',
  };
  const filtered = useMemo(
    () =>
      searchItems(
        vault.items
          .filter((n) =>
            view === 'Trash'
              ? n.status === 'trash'
              : view === 'Archive'
                ? n.status === 'archived'
                : n.status === 'active' &&
                  (view === 'Favorites'
                    ? !!n.favorite
                    : collection
                      ? n.collection_id === collection.id
                      : viewTypes[view]
                        ? n.type === viewTypes[view]
                        : true),
          )
          .filter((n) => filter === 'all' || n.type === filter),
        query,
        vault.collections,
      ),
    [vault.items, vault.collections, view, query, filter, collection],
  );
  const results = searchItems(active, query, vault.collections).slice(0, 30),
    pinned = active.filter((n) => n.pinned),
    selectedItem = vault.items.find((n) => n.id === selected),
    modules: string[] = vault.settings.modules || defaultModules;
  const newNote = (type = 'note', t = '', m = '') =>
    void create(type, t, m).catch(() => {});
  const nav = (label: string) => {
    setView(label);
    setQuery('');
    setFilter('all');
    setSelected(null);
  };
  const journal = () => {
    const today = new Date().toISOString().slice(0, 10),
      entry = active.find(
        (n) => n.type === 'journal' && n.metadata.date === today,
      );
    entry ? open(entry) : newNote('journal');
  };
  const exportAll = () =>
    download(
      `folio-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(
        {
          format: 'folio-v1',
          exported: new Date().toISOString(),
          items: vault.items,
          collections: vault.collections,
          settings: vault.settings,
          attachments: vault.files,
        },
        null,
        2,
      ),
      'application/json',
    );
  const Card = ({ item }: { item: Item }) => {
    const Icon = iconFor[item.type] || FileText;
    return (
      <article
        className={`note-card ${item.pinned ? 'featured' : ''}`}
        draggable
        onDragStart={(e) =>
          e.dataTransfer.setData('application/folio-note', item.id)
        }
        tabIndex={0}
        role="button"
        aria-label={`Open ${item.title || 'Untitled'}`}
        onClick={() => open(item)}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === 'Enter' || e.key === ' ')
          ) {
            e.preventDefault();
            open(item);
          }
        }}
      >
        <div className="card-top">
          <span className="type-label">
            <Icon size={15} />
            {labels[item.type]}
          </span>
          <div className="card-quick-actions">
            <button
              title="Pin note"
              aria-label="Pin note"
              onClick={(e) => {
                e.stopPropagation();
                void action('pin', item);
              }}
            >
              <Pin size={14} fill={item.pinned ? 'currentColor' : 'none'} />
            </button>
            <button
              title="Favorite note"
              aria-label="Favorite note"
              onClick={(e) => {
                e.stopPropagation();
                void action('favorite', item);
              }}
            >
              <Star size={14} fill={item.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
        <h3>{item.title || 'Untitled'}</h3>
        <p>
          {(item.metadata.description || item.markdown)
            .replace(/[#*`>]/g, '')
            .slice(0, 180) || 'A little room for a new thought.'}
        </p>
        {item.type === 'bookmark' && safeUrl(item.metadata.url) && (
          <div className="bookmark-domain">
            ↗ {new URL(item.metadata.url).hostname}
          </div>
        )}
        {item.type === 'project' && (
          <span className="project-stage">
            {item.metadata.stage || 'Planning'}
          </span>
        )}
        <div className="card-bottom">
          <span>
            {item.tags.length ? (
              <span className="tag">#{item.tags[0]}</span>
            ) : (
              vault.collections.find((c) => c.id === item.collection_id)
                ?.name || 'Unfiled'
            )}
          </span>
          <span>{when(item.updated)}</span>
        </div>
        {['trash', 'archived'].includes(item.status) && (
          <div className="card-recovery">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void action('restore', item);
              }}
            >
              Restore
            </button>
            {item.status === 'trash' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void action('delete', item);
                }}
              >
                Delete forever
              </button>
            )}
          </div>
        )}
      </article>
    );
  };
  const empty = (kind = 'note') => (
    <div className="empty-inline roomy">
      <Feather size={32} />
      <h3>Nothing here yet.</h3>
      <p>A thought, a reference, a fresh idea. Give it a home.</p>
      <button className="primary" disabled={busy} onClick={() => newNote(kind)}>
        Write something <Plus size={16} />
      </button>
    </div>
  );
  const cards = (items: Item[], mode = layout) => (
    <div className={`notes-grid ${mode}`}>
      {items.slice(0, limit).map((item) => (
        <Card key={item.id} item={item} />
      ))}
    </div>
  );
  const collectionSave = async () => {
    try {
      const result = await api({
        action: 'collection',
        ...editingCollection,
        name: collectionName,
        color: collectionColor,
        position: editingCollection?.position ?? vault.collections.length,
      });
      const c = {
        id: result.id,
        name: collectionName,
        color: collectionColor,
        position: editingCollection?.position ?? vault.collections.length,
        pinned: editingCollection?.pinned || 0,
      };
      setVault((v) => ({
        ...v,
        collections: [...v.collections.filter((x) => x.id !== c.id), c].sort(
          (a, b) => a.position - b.position,
        ),
      }));
      setCollectionModal(false);
      notify('Collection saved.');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const addCollection = () => {
    setEditingCollection(null);
    setCollectionName('');
    setCollectionColor('#638771');
    setCollectionModal(true);
    setPalette(null);
  };
  const dropInto = async (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    const note = vault.items.find(
      (n) => n.id === e.dataTransfer.getData('application/folio-note'),
    );
    if (note) {
      try {
        await save({ ...note, collection_id: id });
        notify('Moved to collection.');
      } catch (err) {
        notify((err as Error).message);
      }
    }
  };
  const recordSearch = () => {
    if (query.trim()) {
      const next = [query, ...recentSearches.filter((s) => s !== query)].slice(
        0,
        6,
      );
      setRecentSearches(next);
      localStorage.setItem('folio-searches', JSON.stringify(next));
    }
  };
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="brand">
            <Feather />
            <span>
              folio<span className="brand-dot">.</span>
            </span>
          </div>
          <button
            className="workspace-picker"
            onClick={() => setSettingsOpen(true)}
          >
            <span className="avatar">{vault.user.name.charAt(0)}</span>
            <span>
              Personal workspace<small>Your space to think</small>
            </span>
          </button>
          <button
            className="create"
            disabled={loading || !!error}
            onClick={() => {
              setPalette('create');
              setQuery('');
            }}
          >
            <Plus size={18} />
            Create<kbd>⌘ N</kbd>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navigation.map(([Icon, label]) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  isActive={view === label}
                  onClick={() => nav(label)}
                  tooltip={label}
                >
                  <Icon />
                  <span>{label}</span>
                  {label === 'All notes' && (
                    <span className="nav-count">{active.length}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="nav-label">
            MY COLLECTIONS
            <button aria-label="Add collection" onClick={addCollection}>
              <Plus size={14} />
            </button>
          </div>
          {vault.collections.map((c) => (
            <button
              className={`collection-nav ${collection?.id === c.id ? 'selected' : ''}`}
              key={c.id}
              onClick={() => nav(`collection:${c.id}`)}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('drop-target');
              }}
              onDragLeave={(e) =>
                e.currentTarget.classList.remove('drop-target')
              }
              onDrop={(e) => void dropInto(e, c.id)}
            >
              <i style={{ background: c.color }} />
              {c.name}
              {c.pinned ? ' ·' : ''}
            </button>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <button
            className="collection-nav"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={17} />
            Settings & preferences
          </button>
          <div className="private-label">
            <Lock size={12} />
            Your thoughts. Your space.
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger />
            <span>Workspace</span>
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <button
            className="search-button"
            onClick={() => {
              setPalette('search');
              setQuery('');
            }}
          >
            <Search size={16} />
            Search anything<kbd>⌘ K</kbd>
          </button>
          <button
            aria-label="Recent activity"
            title="Recent activity"
            className="icon-button"
            onClick={() => {
              setActivityOpen(true);
              void reload();
            }}
          >
            <Bell size={17} />
          </button>
          <button
            aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}
            className="avatar"
          >
            {vault.user.name.charAt(0)}
          </button>
        </header>
        <main className="content" key={view}>
          {error ? (
            <div className="connection-error">
              <Lock size={26} />
              <h2>{error}</h2>
              <button className="subtle" onClick={() => void reload()}>
                <RefreshCw size={15} />
                Retry
              </button>
              {error.startsWith('Sign in') && (
                <a
                  href="/signin-with-chatgpt?return_to=%2F"
                  target="_top"
                  className="primary"
                >
                  Sign in with ChatGPT
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="eyebrow">
                {view === 'Home'
                  ? 'YOUR PERSONAL KNOWLEDGE SPACE'
                  : view === 'Journal'
                    ? 'A PAGE FROM YOUR LIFE'
                    : 'YOUR PRIVATE VAULT'}
              </div>
              <div className="page-heading">
                <div>
                  <h1>
                    {view === 'Home' ? 'A little space for big ideas.' : title}
                  </h1>
                  <p>
                    {view === 'Home'
                      ? 'Pick up a thought, or start a new one.'
                      : view === 'Journal'
                        ? 'Let the day leave a trace.'
                        : view === 'Knowledge graph'
                          ? 'Follow a thought. Discover a connection.'
                          : `${filtered.length} things worth remembering.`}
                  </p>
                </div>
                {view === 'Home' ? (
                  <button className="subtle" onClick={() => setCustomize(true)}>
                    <SlidersHorizontal size={16} />
                    Customize
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={busy || loading}
                    onClick={() =>
                      view === 'Collections'
                        ? addCollection()
                        : view === 'Files'
                          ? fileInput.current?.click()
                          : newNote(viewTypes[view] || 'note')
                    }
                  >
                    <Plus size={16} />
                    {view === 'Collections'
                      ? 'Collection'
                      : view === 'Files'
                        ? 'Upload'
                        : 'Create'}
                  </button>
                )}
              </div>
              {loading ? (
                <div className="loading-state">
                  <RefreshCw className="spin" />
                  Opening your space…
                </div>
              ) : view === 'Home' ? (
                <>
                  <section className="capture-surface">
                    <div className="capture-icon">
                      <Feather size={23} />
                    </div>
                    <div>
                      <h2>What’s on your mind?</h2>
                      <p>
                        A fleeting thought. A brilliant idea. Anything worth
                        keeping.
                      </p>
                    </div>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => newNote()}
                    >
                      Write something <ArrowUpRight size={17} />
                    </button>
                  </section>
                  <div className="dashboard-modules">
                    {modules.map((module) => (
                      <section
                        key={module}
                        className={`dashboard-module ${vault.settings.moduleSizes?.[module] === 'wide' ? 'wide' : ''} ${module === 'Pinned' ? 'wide' : ''}`}
                      >
                        {module === 'Pinned' ? (
                          <>
                            <div className="section-heading">
                              <h2>
                                Pinned for a reason{' '}
                                <span className="muted">
                                  {String(pinned.length).padStart(2, '0')}
                                </span>
                              </h2>
                              <button
                                className="text-button"
                                onClick={() => nav('All notes')}
                              >
                                View all <ArrowUpRight size={15} />
                              </button>
                            </div>
                            <div className="pinned-grid">
                              {pinned.length ? (
                                pinned
                                  .slice(0, 3)
                                  .map((n) => <Card key={n.id} item={n} />)
                              ) : (
                                <article
                                  className="note-card featured"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    newNote(
                                      'note',
                                      'A home for everything',
                                      'Collect your thoughts, connect your ideas, and make a little room for what comes next.',
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' &&
                                    newNote('note', 'A home for everything')
                                  }
                                >
                                  <div className="card-top">
                                    <span className="type-label">
                                      <BookOpen size={15} />
                                      THE STARTING POINT
                                    </span>
                                    <Feather size={16} />
                                  </div>
                                  <h3>
                                    A home for everything
                                    <br />
                                    you want to remember.
                                  </h3>
                                  <p>
                                    Collect your thoughts, connect your ideas,
                                    and make a little room for what comes next.
                                  </p>
                                  <div className="card-bottom">
                                    <span className="tag">
                                      Make your first note
                                    </span>
                                    <ArrowUpRight size={18} />
                                  </div>
                                </article>
                              )}
                              <button
                                className="new-card"
                                disabled={busy}
                                onClick={() => newNote()}
                              >
                                <Plus />
                                <h3>Make room for an idea</h3>
                                <p>Your next note starts here.</p>
                              </button>
                            </div>
                          </>
                        ) : module === 'Journal' ? (
                          <section className="daily">
                            <div className="eyebrow">A MOMENT FOR YOURSELF</div>
                            <BookOpen size={25} />
                            <h2>
                              Let the day
                              <br />
                              <em>leave a trace.</em>
                            </h2>
                            <p>
                              One good thing. One new thought.
                              <br />
                              That’s enough to begin.
                            </p>
                            <button className="text-button" onClick={journal}>
                              Open today’s journal <ArrowUpRight size={16} />
                            </button>
                          </section>
                        ) : (
                          <>
                            <div className="section-heading">
                              <h2>{module}</h2>
                              <button
                                className="text-button"
                                onClick={() =>
                                  nav(
                                    module === 'Recently edited'
                                      ? 'Recent'
                                      : module,
                                  )
                                }
                              >
                                View all <ArrowUpRight size={14} />
                              </button>
                            </div>
                            {module === 'Collections' ? (
                              <div className="collection-mini">
                                {vault.collections.slice(0, 4).map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => nav(`collection:${c.id}`)}
                                  >
                                    <Folder color={c.color} size={20} />
                                    <span>{c.name}</span>
                                    <span className="muted">
                                      {
                                        active.filter(
                                          (n) => n.collection_id === c.id,
                                        ).length
                                      }
                                    </span>
                                  </button>
                                ))}
                                <button onClick={addCollection}>
                                  <Plus size={18} />
                                  Make a collection
                                </button>
                              </div>
                            ) : (
                              <>
                                {(module === 'Recently edited'
                                  ? active
                                  : active.filter(
                                      (n) => n.type === viewTypes[module],
                                    )
                                )
                                  .slice(0, 4)
                                  .map((n) => (
                                    <button
                                      key={n.id}
                                      className="recent-row"
                                      onClick={() => open(n)}
                                    >
                                      <span className="recent-icon">
                                        <FileText size={18} />
                                      </span>
                                      <span>
                                        <strong>{n.title || 'Untitled'}</strong>
                                        <small>
                                          {labels[n.type]} · {when(n.updated)}
                                        </small>
                                      </span>
                                      <ChevronRight size={15} />
                                    </button>
                                  ))}
                                {!(
                                  module === 'Recently edited'
                                    ? active
                                    : active.filter(
                                        (n) => n.type === viewTypes[module],
                                      )
                                ).length && (
                                  <div className="empty-inline">
                                    <Files size={24} />
                                    <h3>
                                      {module === 'Recently edited'
                                        ? 'Your next chapter is unwritten.'
                                        : 'Nothing here yet.'}
                                    </h3>
                                    <button
                                      className="text-button"
                                      onClick={() =>
                                        newNote(viewTypes[module] || 'note')
                                      }
                                    >
                                      Start something <ArrowUpRight size={14} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </section>
                    ))}
                  </div>
                </>
              ) : view === 'Collections' ? (
                <div className="collections-grid">
                  {vault.collections.map((c, i) => (
                    <div
                      className="collection-tile"
                      key={c.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('drop-target');
                      }}
                      onDragLeave={(e) =>
                        e.currentTarget.classList.remove('drop-target')
                      }
                      onDrop={(e) => void dropInto(e, c.id)}
                    >
                      <button
                        className="collection-open"
                        onClick={() => nav(`collection:${c.id}`)}
                      >
                        <Folder size={34} strokeWidth={1.4} color={c.color} />
                        <h2>{c.name}</h2>
                        <p>
                          {
                            active.filter((n) => n.collection_id === c.id)
                              .length
                          }{' '}
                          items
                        </p>
                      </button>
                      <div className="collection-tools">
                        <button
                          aria-label={`Edit ${c.name}`}
                          onClick={() => {
                            setEditingCollection(c);
                            setCollectionName(c.name);
                            setCollectionColor(c.color);
                            setCollectionModal(true);
                          }}
                        >
                          <PenLine size={15} />
                        </button>
                        <button
                          aria-label={`Pin ${c.name}`}
                          onClick={async () => {
                            await api({
                              action: 'collection',
                              ...c,
                              pinned: !c.pinned,
                            });
                            void reload();
                          }}
                        >
                          <Pin
                            size={15}
                            fill={c.pinned ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button
                          disabled={i === 0}
                          aria-label={`Move ${c.name} up`}
                          onClick={async () => {
                            const before = vault.collections[i - 1];
                            await api({
                              action: 'collection',
                              ...c,
                              position: before.position,
                            });
                            await api({
                              action: 'collection',
                              ...before,
                              position: c.position,
                            });
                            void reload();
                          }}
                        >
                          <ArrowUp size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="new-card" onClick={addCollection}>
                    <Plus />
                    <h3>Another place to grow</h3>
                    <p>Create a collection</p>
                  </button>
                </div>
              ) : view === 'Files' ? (
                <>
                  <div
                    className="upload-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      for (const file of Array.from(e.dataTransfer.files))
                        void upload(file).catch((e) => notify(e.message));
                    }}
                  >
                    <Upload size={30} />
                    <h2>Drop something worth keeping.</h2>
                    <p>Documents, images, code, or any file you need.</p>
                    <button
                      className="subtle"
                      onClick={() => fileInput.current?.click()}
                    >
                      Choose files
                    </button>
                  </div>
                  {vault.files.map((f) => (
                    <a
                      key={f.id}
                      className="file-row"
                      href={`/api/files?id=${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Files size={20} />
                      <span>
                        {f.name}
                        <small>
                          {f.item_id
                            ? vault.items.find((n) => n.id === f.item_id)
                                ?.title || 'Attached to a note'
                            : 'In your vault'}
                        </small>
                      </span>
                      <span>{(f.size / 1024).toFixed(1)} KB</span>
                      <Download size={16} />
                    </a>
                  ))}
                </>
              ) : view === 'Knowledge graph' ? (
                <Suspense fallback={<p>Connecting your thoughts…</p>}>
                  <Graph
                    items={active}
                    collections={vault.collections}
                    onOpen={open}
                  />
                </Suspense>
              ) : (
                <>
                  {view === 'Quick capture' && (
                    <div className="quick-capture">
                      <textarea
                        aria-label="Quick capture"
                        placeholder="Don’t organize it yet. Just get it down…"
                        value={quick}
                        onChange={(e) => setQuick(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            (e.ctrlKey || e.metaKey) &&
                            e.key === 'Enter' &&
                            quick.trim()
                          ) {
                            void create(
                              'quick',
                              quick.split('\n')[0].slice(0, 90),
                              quick,
                            )
                              .then(() => setQuick(''))
                              .catch(() => {});
                          }
                        }}
                      />
                      <button
                        className="primary"
                        disabled={busy || !quick.trim()}
                        onClick={() => {
                          void create(
                            'quick',
                            quick.split('\n')[0].slice(0, 90),
                            quick,
                          )
                            .then(() => setQuick(''))
                            .catch(() => {});
                        }}
                      >
                        Capture thought <Zap size={16} />
                      </button>
                    </div>
                  )}
                  <div className="view-toolbar">
                    <div className="filter-search">
                      <Search size={16} />
                      <input
                        aria-label="Filter notes"
                        placeholder="Find in this space…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <Choice
                      label="Content type"
                      value={filter}
                      options={[
                        { value: 'all', label: 'All types' },
                        ...types.map((t) => ({ value: t, label: labels[t] })),
                      ]}
                      onChange={setFilter}
                    />
                    <Choice
                      label="Layout"
                      value={layout}
                      options={[
                        'grid',
                        'list',
                        'masonry',
                        'timeline',
                        'compact',
                      ].map((v) => ({
                        value: v,
                        label: v.charAt(0).toUpperCase() + v.slice(1),
                      }))}
                      onChange={setLayout}
                    />
                  </div>
                  {view === 'Journal' && (
                    <Tabs
                      value={journalView}
                      onValueChange={(v) => setJournalView(String(v))}
                    >
                      <TabsList>
                        <TabsTrigger value="feed">Feed</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        <TabsTrigger value="calendar">Calendar</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  {view === 'Journal' && journalView === 'calendar' ? (
                    <div className="journal-calendar">
                      <input
                        type="month"
                        aria-label="Calendar month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                      />
                      <div className="calendar-grid">
                        {Array.from(
                          {
                            length: new Date(
                              Number(month.slice(0, 4)),
                              Number(month.slice(5)),
                              0,
                            ).getDate(),
                          },
                          (_, i) => {
                            const date = `${month}-${String(i + 1).padStart(2, '0')}`,
                              entries = filtered.filter(
                                (n) => n.metadata.date === date,
                              );
                            return (
                              <div className="calendar-day" key={date}>
                                <span>{i + 1}</span>
                                {entries.map((n) => (
                                  <button key={n.id} onClick={() => open(n)}>
                                    {n.title}
                                    <small>{n.metadata.mood}</small>
                                  </button>
                                ))}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ) : view === 'Tasks' ? (
                    <div className="task-list">
                      {filtered.map((n) => (
                        <div
                          key={n.id}
                          className={`task-row ${n.metadata.done ? 'done' : ''}`}
                        >
                          <Checkbox
                            aria-label={`Complete ${n.title || 'task'}`}
                            checked={!!n.metadata.done}
                            onCheckedChange={(done) =>
                              void save({
                                ...n,
                                metadata: { ...n.metadata, done },
                              }).catch((e) => notify(e.message))
                            }
                          />
                          <button onClick={() => open(n)}>
                            {n.title || 'Untitled task'}
                          </button>
                          <span className="muted">
                            {n.metadata.due
                              ? when(n.metadata.due)
                              : 'No due date'}
                          </span>
                          <button
                            aria-label="Edit task"
                            onClick={() => open(n)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      ))}
                      {!filtered.length && empty('task')}
                    </div>
                  ) : filtered.length ? (
                    cards(
                      filtered,
                      view === 'Journal' && journalView === 'timeline'
                        ? 'timeline'
                        : layout,
                    )
                  ) : (
                    empty(viewTypes[view] || 'note')
                  )}
                  {filtered.length > limit && (
                    <button
                      className="subtle load-more"
                      onClick={() => setLimit((n) => n + 60)}
                    >
                      Show more ({filtered.length - limit} remaining)
                    </button>
                  )}
                </>
              )}
              <footer className="page-footer">
                <span>A place for everything on your mind.</span>
                <span>Capture → Organize → Find → Use</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {selectedItem && (
        <Suspense
          fallback={
            <div className="editor-overlay loading-state">
              Opening your note…
            </div>
          }
        >
          <NoteEditor
            key={selectedItem.id}
            item={selectedItem}
            vault={vault}
            settings={vault.settings}
            onClose={() => setSelected(null)}
            onSave={save}
            registerFlush={(fn) => {
              flushRef.current = fn;
            }}
            onAction={(a, n) => void action(a, n)}
            onUpload={upload}
            notify={notify}
          />
        </Suspense>
      )}
      <Dialog
        open={palette !== null}
        onOpenChange={(v) => !v && setPalette(null)}
      >
        <DialogContent className="command-modal">
          <DialogTitle className="palette-title">
            {palette === 'create'
              ? 'Make room for something.'
              : 'Your thoughts, within reach.'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search your vault or run a command.
          </DialogDescription>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={
                palette === 'create'
                  ? 'What would you like to create?'
                  : 'Search notes, tags, or type a thought…'
              }
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>Nothing here yet.</CommandEmpty>
              {palette === 'search' && (
                <>
                  <CommandGroup heading="Found in your vault">
                    {results.map((n) => (
                      <CommandItem
                        key={n.id}
                        value={n.id}
                        onSelect={() => {
                          recordSearch();
                          open(n);
                        }}
                      >
                        <FileText size={16} />
                        {n.title || 'Untitled'}
                        <span className="muted">{labels[n.type]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {query.trim() && (
                    <CommandItem
                      onSelect={() => newNote('quick', query, query)}
                    >
                      <Zap size={16} />
                      Capture “{query.slice(0, 55)}”
                      <CommandShortcut>↵</CommandShortcut>
                    </CommandItem>
                  )}
                  {!query && recentSearches.length > 0 && (
                    <CommandGroup heading="Recent searches">
                      {recentSearches.map((s) => (
                        <CommandItem key={s} onSelect={() => setQuery(s)}>
                          <Clock size={15} />
                          {s}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
              <CommandGroup heading="Create">
                {types
                  .filter(
                    (t) =>
                      labels[t].toLowerCase().includes(query.toLowerCase()) ||
                      !query,
                  )
                  .map((t) => {
                    const Icon = iconFor[t];
                    return (
                      <CommandItem key={t} onSelect={() => newNote(t)}>
                        <Icon size={16} />
                        {labels[t]}
                        {t === 'note' && <CommandShortcut>⌘ N</CommandShortcut>}
                      </CommandItem>
                    );
                  })}
                {(!query || 'collection'.includes(query.toLowerCase())) && (
                  <CommandItem onSelect={addCollection}>
                    <Folder size={16} />
                    Collection
                  </CommandItem>
                )}
              </CommandGroup>
              <CommandGroup heading="Workspace">
                {vault.collections
                  .filter((c) =>
                    c.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <CommandItem
                      key={c.id}
                      onSelect={() => {
                        nav(`collection:${c.id}`);
                        setPalette(null);
                      }}
                    >
                      <Folder size={16} />
                      {c.name}
                    </CommandItem>
                  ))}
                {[
                  [
                    'Toggle dark mode',
                    () =>
                      void setPrefs({
                        theme: document.documentElement.classList.contains(
                          'dark',
                        )
                          ? 'light'
                          : 'dark',
                      }),
                  ],
                  [
                    'Change layout',
                    () => setLayout(layout === 'grid' ? 'list' : 'grid'),
                  ],
                  ['Upload files', () => fileInput.current?.click()],
                  ['Import notes', () => importInput.current?.click()],
                  ['Export vault', exportAll],
                  ['Open settings', () => setSettingsOpen(true)],
                ]
                  .filter(([name]) =>
                    String(name).toLowerCase().includes(query.toLowerCase()),
                  )
                  .map(([name, run]) => (
                    <CommandItem
                      key={String(name)}
                      onSelect={() => {
                        (run as () => void)();
                        setPalette(null);
                      }}
                    >
                      {String(name)}
                    </CommandItem>
                  ))}
                {selectedItem &&
                  ['pin', 'favorite', 'archive', 'duplicate', 'trash', 'export']
                    .filter((a) => a.includes(query.toLowerCase()))
                    .map((a) => (
                      <CommandItem
                        key={a}
                        onSelect={() => {
                          void action(a, selectedItem);
                          setPalette(null);
                        }}
                      >
                        {a} current note
                      </CommandItem>
                    ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="palette-footer">
            <span>↑ ↓ to navigate · ↵ to select</span>
            <span>Esc to close</span>
          </div>
          {palette === 'search' && (
            <p className="search-help">
              Try tag:python, type:journal, collection:college, created:today,
              or before:2026-01-01
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={collectionModal} onOpenChange={setCollectionModal}>
        <DialogContent>
          <DialogTitle>
            {editingCollection
              ? 'Edit collection'
              : 'A place for related thoughts.'}
          </DialogTitle>
          <DialogDescription>
            Name your collection. You can organize it as you go.
          </DialogDescription>
          <input
            className="field"
            aria-label="Collection name"
            placeholder="Collection name"
            autoFocus
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' &&
              collectionName.trim() &&
              void collectionSave()
            }
          />
          <label className="setting-row">
            Color
            <input
              type="color"
              aria-label="Collection color"
              value={collectionColor}
              onChange={(e) => setCollectionColor(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={!collectionName.trim()}
            onClick={() => void collectionSave()}
          >
            Save collection
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={customize} onOpenChange={setCustomize}>
        <DialogContent className="settings-modal">
          <DialogTitle>Make this space yours.</DialogTitle>
          <DialogDescription>
            Choose what appears, then arrange it around the way you think.
          </DialogDescription>
          {defaultModules.map((module) => {
            const index = modules.indexOf(module);
            return (
              <div className="module-setting" key={module}>
                <Checkbox
                  aria-label={`Show ${module}`}
                  checked={index >= 0}
                  onCheckedChange={(checked) =>
                    void setPrefs({
                      modules: checked
                        ? [...modules, module]
                        : modules.filter((m) => m !== module),
                    })
                  }
                />
                <span>{module}</span>
                <Choice
                  label={`${module} size`}
                  value={vault.settings.moduleSizes?.[module] || 'normal'}
                  options={[
                    { value: 'normal', label: 'Half width' },
                    { value: 'wide', label: 'Full width' },
                  ]}
                  onChange={(size) =>
                    void setPrefs({
                      moduleSizes: {
                        ...vault.settings.moduleSizes,
                        [module]: size,
                      },
                    })
                  }
                />
                <button
                  aria-label={`Move ${module} up`}
                  disabled={index <= 0}
                  onClick={() => {
                    const next = [...modules];
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    void setPrefs({ modules: next });
                  }}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  aria-label={`Move ${module} down`}
                  disabled={index < 0 || index === modules.length - 1}
                  onClick={() => {
                    const next = [...modules];
                    [next[index + 1], next[index]] = [
                      next[index],
                      next[index + 1],
                    ];
                    void setPrefs({ modules: next });
                  }}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            );
          })}
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="settings-modal">
          <DialogTitle>A space that feels like you.</DialogTitle>
          <DialogDescription>
            Fine-tune your workspace and keep your data in your hands.
          </DialogDescription>
          <Tabs defaultValue="general">
            <TabsList className="settings-tabs">
              {[
                'general',
                'editor',
                'shortcuts',
                'storage',
                'privacy',
                'appearance',
              ].map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="general">
              <label className="setting-row">
                Theme
                <Choice
                  label="Theme"
                  value={vault.settings.theme || 'light'}
                  options={['light', 'dark', 'system'].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                  onChange={(theme) => void setPrefs({ theme })}
                />
              </label>
              <label className="setting-row">
                Accent color
                <input
                  type="color"
                  aria-label="Accent color"
                  value={vault.settings.accent || '#426956'}
                  onChange={(e) => void setPrefs({ accent: e.target.value })}
                />
              </label>
              <label className="setting-row">
                Default view
                <Choice
                  label="Default view"
                  value={vault.settings.defaultView || 'grid'}
                  options={[
                    'grid',
                    'list',
                    'masonry',
                    'timeline',
                    'compact',
                  ].map((v) => ({ value: v, label: v }))}
                  onChange={(defaultView) => {
                    setLayout(defaultView);
                    void setPrefs({ defaultView });
                  }}
                />
              </label>
              <p className="settings-note">Interface language: English</p>
            </TabsContent>
            <TabsContent value="editor">
              <label className="setting-row">
                Writing font
                <Choice
                  label="Writing font"
                  value={vault.settings.editorFont || 'sans'}
                  options={[
                    { value: 'sans', label: 'Modern sans' },
                    { value: 'serif', label: 'Editorial serif' },
                    { value: 'mono', label: 'Monospace' },
                  ]}
                  onChange={(editorFont) => void setPrefs({ editorFont })}
                />
              </label>
              <label className="setting-row">
                Font size
                <Choice
                  label="Font size"
                  value={String(vault.settings.fontSize || 17)}
                  options={[16, 17, 18, 20, 22].map((v) => ({
                    value: String(v),
                    label: `${v}px`,
                  }))}
                  onChange={(fontSize) =>
                    void setPrefs({ fontSize: Number(fontSize) })
                  }
                />
              </label>
              <label className="setting-row">
                Line height
                <Choice
                  label="Line height"
                  value={String(vault.settings.lineHeight || 1.8)}
                  options={[1.5, 1.8, 2].map((v) => ({
                    value: String(v),
                    label: String(v),
                  }))}
                  onChange={(lineHeight) =>
                    void setPrefs({ lineHeight: Number(lineHeight) })
                  }
                />
              </label>
              <label className="setting-row">
                Autosave
                <Switch
                  checked={vault.settings.autosave !== false}
                  onCheckedChange={(autosave) => void setPrefs({ autosave })}
                />
              </label>
              <p className="settings-note">
                Markdown shortcuts: # headings, **bold**, &gt; quotes, and
                fenced code blocks.
              </p>
            </TabsContent>
            <TabsContent value="shortcuts">
              {[
                ['Search & quick capture', 'Ctrl / ⌘ K'],
                ['Creation menu', 'Ctrl / ⌘ N'],
                ['Toggle sidebar', 'Ctrl / ⌘ B'],
                ['Save note', 'Ctrl / ⌘ S'],
                ['Capture a thought', 'Ctrl / ⌘ Enter'],
                ['Insert block', '/'],
                ['Undo', 'Ctrl / ⌘ Z'],
                ['Bold', 'Ctrl / ⌘ B (in editor)'],
              ].map(([label, key]) => (
                <div className="setting-row" key={label}>
                  {label}
                  <kbd>{key}</kbd>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="storage">
              <div className="storage-summary">
                <Files />
                <h2>
                  {(
                    vault.files.reduce((sum, f) => sum + f.size, 0) /
                    1024 /
                    1024
                  ).toFixed(2)}{' '}
                  MB
                </h2>
                <p>
                  {vault.files.length} files · {vault.items.length} notes
                </p>
              </div>
              <div className="settings-actions">
                <button
                  className="subtle"
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={16} />
                  Import Markdown / JSON
                </button>
                <button className="subtle" onClick={exportAll}>
                  <Download size={16} />
                  Export all as JSON
                </button>
                <button
                  className="subtle"
                  onClick={() =>
                    download(
                      'folio-vault.md',
                      vault.items
                        .map((n) => `# ${n.title}\n\n${n.markdown}`)
                        .join('\n\n---\n\n'),
                      'text/markdown',
                    )
                  }
                >
                  <Download size={16} />
                  Bulk Markdown export
                </button>
                <button className="subtle" onClick={() => window.print()}>
                  Print / Save as PDF
                </button>
              </div>
              <p className="settings-note">
                JSON includes notes, collections, and settings. Download
                attachment files separately from Files.
              </p>
            </TabsContent>
            <TabsContent value="privacy">
              <div className="privacy-panel">
                <Lock />
                <h2>Only yours, by default.</h2>
                <p>
                  Notes and file downloads require your signed-in account. Each
                  record is scoped to its owner.
                </p>
                <p>
                  Storage is not end-to-end encrypted. Your notes are never
                  stored in the source repository.
                </p>
                <div className="setting-row">
                  Signed in as<span>{vault.user.email}</span>
                </div>
                <a
                  className="subtle"
                  href="/signout-with-chatgpt?return_to=%2F"
                  target="_top"
                >
                  <LogOut size={16} />
                  Sign out of this session
                </a>
              </div>
            </TabsContent>
            <TabsContent value="appearance">
              <label className="setting-row">
                Animations
                <Switch
                  checked={vault.settings.animations !== false}
                  onCheckedChange={(animations) =>
                    void setPrefs({ animations })
                  }
                />
              </label>
              <label className="setting-row">
                Density
                <Choice
                  label="Density"
                  value={vault.settings.density || 'comfortable'}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'compact', label: 'Compact' },
                  ]}
                  onChange={(density) => void setPrefs({ density })}
                />
              </label>
              <button
                className="subtle"
                onClick={() => {
                  setSettingsOpen(false);
                  setCustomize(true);
                }}
              >
                <SlidersHorizontal size={16} />
                Customize dashboard
              </button>
              <p className="settings-note">
                Your system’s reduced-motion preference is always respected.
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="history-modal">
          <DialogTitle>A quiet record of your day.</DialogTitle>
          <DialogDescription>
            Recent changes in your personal vault.
          </DialogDescription>
          <div className="history-list">
            {vault.activity.length ? (
              vault.activity.map((a) => (
                <button
                  className="recent-row"
                  key={a.id}
                  onClick={() => {
                    const n = vault.items.find((n) => n.id === a.item_id);
                    if (n) {
                      open(n);
                      setActivityOpen(false);
                    }
                  }}
                >
                  <Clock size={16} />
                  <span>
                    <strong>{a.title || 'Untitled'}</strong>
                    <small>
                      {a.action} · {new Date(a.created).toLocaleString()}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p>Your activity will appear here as you write.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Let this thought go?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete “{deleteTarget?.title || 'Untitled'}” and its
              version history. Attached files will stay in Files. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await api({ id: deleteTarget.id }, 'DELETE');
                  setVault((v) => ({
                    ...v,
                    items: v.items.filter((n) => n.id !== deleteTarget.id),
                  }));
                  setDeleteTarget(null);
                  notify('Permanently deleted.');
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <input
        type="file"
        hidden
        multiple
        ref={fileInput}
        onChange={async (e) => {
          for (const file of Array.from(e.target.files || [])) {
            try {
              await upload(file);
            } catch (err) {
              notify((err as Error).message);
            }
          }
          e.target.value = '';
        }}
      />
      <input
        type="file"
        hidden
        multiple
        accept=".md,.markdown,.txt,.json"
        ref={importInput}
        onChange={async (e) => {
          const input = e.currentTarget;
          setBusy(true);
          try {
            for (const file of Array.from(input.files || [])) {
              const text = await file.text();
              if (file.name.endsWith('.json')) {
                const data = JSON.parse(text);
                if (
                  data.format !== 'folio-v1' ||
                  !Array.isArray(data.items) ||
                  !Array.isArray(data.collections)
                )
                  throw Error('Use a Folio JSON export.');
                const map = new Map<string, string>();
                for (const c of data.collections) {
                  const saved = await api({
                    action: 'collection',
                    name: c.name,
                    color: c.color,
                    position: c.position,
                  });
                  map.set(c.id, saved.id);
                }
                const itemMap = new Map<string, string>(
                  data.items.map((n: Item) => [n.id, crypto.randomUUID()]),
                );
                const savedItems: Item[] = [];
                for (const n of data.items) {
                  savedItems.push(
                    await save({
                      ...n,
                      id: itemMap.get(n.id),
                      revision: 0,
                      collection_id: map.get(n.collection_id) || null,
                      project_id: null,
                    }),
                  );
                }
                for (const n of data.items.filter((n: Item) => n.project_id)) {
                  const saved = savedItems.find(
                    (x) => x.id === itemMap.get(n.id),
                  );
                  if (saved)
                    await save({
                      ...saved,
                      project_id: itemMap.get(n.project_id) || null,
                    });
                }
                if (data.settings) await setPrefs(data.settings);
              } else {
                const { MarkdownManager } = await import('@tiptap/markdown');
                const StarterKit = (await import('@tiptap/starter-kit'))
                  .default;
                const manager = new MarkdownManager({
                  extensions: [StarterKit],
                });
                const doc = manager.parse(text);
                const now = new Date().toISOString();
                await save({
                  id: crypto.randomUUID(),
                  type: 'note',
                  title: file.name.replace(/\.[^.]+$/, ''),
                  content: JSON.stringify(doc),
                  markdown: text,
                  tags: [],
                  collection_id: null,
                  project_id: null,
                  metadata: {},
                  pinned: 0,
                  favorite: 0,
                  status: 'active',
                  created: now,
                  updated: now,
                  revision: 0,
                });
              }
            }
            await reload();
            notify('Your notes are in their new home.');
          } catch (err) {
            notify(
              `Import stopped: ${(err as Error).message}. Already imported notes are retained.`,
            );
          } finally {
            setBusy(false);
            input.value = '';
          }
        }}
      />
      {notice && (
        <div role="status" className="toast">
          <Check size={16} />
          <span>{notice}</span>
          {undo && (
            <button
              onClick={() => {
                const current = vault.items.find((n) => n.id === undo.id);
                void save({
                  ...undo,
                  revision: current?.revision || undo.revision,
                })
                  .then(() => {
                    setUndo(null);
                    notify('Restored.');
                  })
                  .catch((e) => notify(e.message));
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </SidebarProvider>
  );
}
