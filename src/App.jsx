import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import logoWhite from './assets/logo-white.png';
import { QUALITY, SALUTATIONS } from './lib/constants';
import { loadFonts } from './lib/text';
import { loadBrandAssets } from './lib/brandAssets';
import { planPages, fileNameFor } from './lib/layout';
import { importImage, ImportError, estimateSlotPixels, naturalCompare } from './lib/images';
import { clearAll, deleteImageBlobs, loadDraft, saveDraft, saveImageBlobs } from './lib/storage';
import { emptyState, imageMeta, newId, reducer } from './state';
import RoomCard from './components/RoomCard';
import PageGrid from './components/PageGrid';
import { Field, Icon } from './components/ui';

// Rough JPEG bytes per output pixel for interior renders, plus fonts, logo and brand pages.
const BYTES_PER_PX = { share: 0.13, print: 0.2 };
const FIXED_BYTES = 650_000;

const formatBytes = (n) => (n < 1e6 ? `${Math.max(1, Math.round(n / 1e3))} KB` : `${(n / 1e6).toFixed(1)} MB`);

const canShareFiles = (() => {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }));
  } catch {
    return false;
  }
})();

function withPreviewUrls(images) {
  return Object.fromEntries(
    Object.entries(images).map(([id, img]) => [id, { ...img, previewUrl: URL.createObjectURL(img.previewBlob) }]),
  );
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function QualityToggle({ value, onChange, estimate }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-border p-0.5 text-xs" role="radiogroup" aria-label="PDF quality">
        {Object.entries(QUALITY).map(([key, q]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            title={q.hint}
            onClick={() => onChange(key)}
            className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
              value === key ? 'bg-white/10 text-text' : 'text-text-muted hover:text-text'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>
      {estimate > 0 && (
        <span className="text-xs text-text-muted tabular-nums" title="Estimated file size">
          ≈ {formatBytes(estimate)}
        </span>
      )}
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const tone = toast.kind === 'error' ? 'border-danger/50' : 'border-border';
  return (
    <div className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
      <div className={`pointer-events-auto max-w-lg w-full sm:w-auto flex items-center gap-3 rounded-xl border ${tone} bg-surface-2 px-4 py-3 text-sm shadow-2xl`}>
        <p className={`flex-1 ${toast.kind === 'error' ? 'text-danger' : ''}`}>{toast.text}</p>
        {toast.action && (
          <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={toast.action.run}>
            {toast.action.label}
          </button>
        )}
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text cursor-pointer" aria-label="Dismiss">
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [assets, setAssets] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [pending, setPending] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const { project, images } = state;

  // Fonts and brand art are needed to lay out pages; the draft restores the last session.
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFonts(), loadBrandAssets(), loadDraft().catch(() => null)]).then(([, brand, draft]) => {
      if (cancelled) return;
      setAssets(brand);
      if (draft?.project) {
        const restored = withPreviewUrls(draft.images);
        const base = emptyState().project;
        const rooms = draft.project.rooms?.length ? draft.project.rooms : base.rooms;
        dispatch({
          type: 'hydrate',
          state: {
            project: {
              ...base,
              ...draft.project,
              rooms: rooms.map((r) => ({ ...r, imageIds: r.imageIds.filter((id) => restored[id]) })),
            },
            images: restored,
          },
        });
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      setSaveState('saving');
      const meta = Object.fromEntries(Object.entries(images).map(([id, img]) => [id, imageMeta(img)]));
      saveDraft({ project, images: meta })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 400);
    return () => clearTimeout(t);
  }, [project, images, hydrated]);

  useEffect(() => {
    if (!toast || toast.sticky) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const addFiles = useCallback(async (roomId, fileList) => {
    const files = Array.from(fileList).sort((a, b) => naturalCompare(a.name, b.name));
    if (!files.length) return;
    setPending((p) => ({ ...p, [roomId]: (p[roomId] || 0) + files.length }));
    for (const file of files) {
      try {
        const rec = await importImage(file);
        const id = newId();
        dispatch({
          type: 'addImage',
          roomId,
          image: {
            id,
            ...rec,
            previewUrl: URL.createObjectURL(rec.previewBlob),
            caption: '',
            layout: 'auto',
            flip: false,
            focal: { x: 0.5, y: 0.5 },
            pairNext: false,
          },
        });
        saveImageBlobs(id, rec.blob, rec.previewBlob).catch(() => setSaveState('error'));
      } catch (err) {
        const msg = err instanceof ImportError ? err.message : `${file.name} couldn't be added.`;
        setErrors((e) => ({ ...e, [roomId]: [...(e[roomId] || []), msg] }));
      } finally {
        setPending((p) => ({ ...p, [roomId]: p[roomId] - 1 }));
      }
    }
  }, []);

  // Files dropped anywhere outside a room go to the last room instead of opening in the tab.
  const lastRoomId = project.rooms[project.rooms.length - 1].id;
  useEffect(() => {
    const over = (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
    };
    const drop = (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      addFiles(lastRoomId, e.dataTransfer.files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles, lastRoomId]);

  const removeImage = (id) => {
    const img = images[id];
    if (img?.previewUrl) URL.revokeObjectURL(img.previewUrl);
    deleteImageBlobs(id).catch(() => {});
    dispatch({ type: 'removeImage', id });
  };

  const removeRoom = (room) => {
    const count = room.imageIds.filter((id) => images[id]).length;
    if (count && !window.confirm(`Remove ${room.name.trim() || 'this room'} and its ${count} ${count === 1 ? 'image' : 'images'}?`)) return;
    room.imageIds.forEach((id) => {
      if (images[id]?.previewUrl) URL.revokeObjectURL(images[id].previewUrl);
      deleteImageBlobs(id).catch(() => {});
    });
    dispatch({ type: 'removeRoom', id: room.id });
  };

  const startOver = async () => {
    if (!window.confirm('Start a new proposal? This clears the client details and all images.')) return;
    Object.values(images).forEach((img) => URL.revokeObjectURL(img.previewUrl));
    await clearAll().catch(() => {});
    setErrors({});
    setShowErrors(false);
    setLastExport(null);
    dispatch({ type: 'reset' });
  };

  const pages = useMemo(
    () => (assets ? planPages({ project, images, logoRatio: assets.logoRatio }) : []),
    [project, images, assets],
  );

  const { views, pairs, lowDpi, estimate } = useMemo(() => {
    const views = {};
    const pairs = {};
    const lowDpi = {};
    let px = 0;
    let n = 0;
    for (const page of pages) {
      if (page.kind !== 'view') continue;
      page.imageIds.forEach((id) => (views[id] = ++n));
      if (page.imageIds.length === 2) {
        pairs[page.imageIds[0]] = 'first';
        pairs[page.imageIds[1]] = 'second';
      }
      for (const it of page.items) {
        if (it.type !== 'image') continue;
        lowDpi[it.ref] = Math.min(lowDpi[it.ref] ?? Infinity, it.dpi);
        px += estimateSlotPixels(images[it.ref], it.crop, it.w, QUALITY[project.quality]);
      }
    }
    return { views, pairs, lowDpi, estimate: n ? FIXED_BYTES + px * BYTES_PER_PX[project.quality] : 0 };
  }, [pages, images, project.quality]);

  const imageCount = Object.keys(views).length;
  const problems = [];
  if (!project.clientName.trim()) problems.push("Add the client's name.");
  if (!imageCount) problems.push('Add at least one image.');
  if (project.rooms.some((r) => !r.name.trim() && r.imageIds.some((id) => images[id]))) {
    problems.push('Name every room that has images.');
  }

  const sharePdf = async (file) => {
    try {
      await navigator.share({ files: [file], title: file.name });
      setToast(null);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (err.name === 'NotAllowedError') {
        // Building took long enough that the browser no longer counts this as a tap.
        setToast({
          kind: 'ok',
          sticky: true,
          text: `${file.name} is ready (${formatBytes(file.size)}).`,
          action: { label: 'Share now', run: () => sharePdf(file) },
        });
        return;
      }
      setToast({ kind: 'error', text: "Sharing didn't work here. Use Download instead." });
    }
  };

  const exportPdf = async (mode) => {
    if (busy) return;
    if (problems.length) {
      setShowErrors(true);
      setToast({ kind: 'error', text: problems.join(' ') });
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      let file = lastExport?.pages === pages ? lastExport.file : null;
      if (!file) {
        const { buildPdf } = await import('./lib/pdf');
        const blob = await buildPdf({
          pages,
          images,
          assets,
          quality: QUALITY[project.quality],
          title: `Proposal for ${[project.salutation, project.clientName.trim()].filter(Boolean).join(' ')}`,
          onProgress: setProgress,
        });
        file = new File([blob], fileNameFor(project), { type: 'application/pdf' });
        setLastExport({ pages, file });
      }
      if (mode === 'share') {
        await sharePdf(file);
      } else {
        download(file);
        setToast({ kind: 'ok', text: `Downloaded ${file.name} · ${formatBytes(file.size)}` });
      }
    } catch (err) {
      console.error('PDF export failed', err);
      setToast({ kind: 'error', text: "The PDF couldn't be built. Try again, or remove the last image you added." });
    } finally {
      setBusy(false);
    }
  };

  const setProject = (patch) => dispatch({ type: 'setProject', patch });
  const saveLabel = { saving: 'Saving…', saved: 'Saved in this browser', error: "Couldn't save. Storage may be full." }[saveState];

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-[1520px] px-4 sm:px-6 h-14 flex items-center gap-3">
          <img src={assets?.logo.light ?? logoWhite} alt="INTARA" className="h-4 object-contain" />
          <span className="hidden sm:block h-4 w-px bg-border" />
          <h1 className="hidden sm:block text-sm text-text-muted font-normal">Proposal generator</h1>
          {saveLabel && (
            <span className={`hidden md:block ml-2 text-xs ${saveState === 'error' ? 'text-danger' : 'text-text-muted/70'}`}>
              {saveLabel}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <QualityToggle value={project.quality} onChange={(quality) => setProject({ quality })} estimate={estimate} />
            </div>
            {canShareFiles && (
              <button type="button" onClick={() => exportPdf('share')} disabled={busy} className="btn-secondary h-9 px-3">
                <Icon name="share" />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
            <button type="button" onClick={() => exportPdf('download')} disabled={busy} className="btn-primary h-9 px-4">
              <Icon name="download" />
              {busy ? `Building ${Math.round(progress * 100)}%` : 'Download PDF'}
            </button>
          </div>
        </div>
        <div className="sm:hidden px-4 pb-2.5 flex items-center justify-between">
          <QualityToggle value={project.quality} onChange={(quality) => setProject({ quality })} estimate={estimate} />
        </div>
        {busy && (
          <div className="h-0.5 bg-surface">
            <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </header>

      {!assets ? (
        <p className="p-8 text-sm text-text-muted">Loading…</p>
      ) : (
        <main className="mx-auto max-w-[1520px] px-4 sm:px-6 py-6 lg:py-8 lg:grid lg:grid-cols-[minmax(380px,460px)_minmax(0,1fr)] lg:gap-10">
          <div className="space-y-9 min-w-0">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="section-title">Client</h2>
                <button type="button" onClick={startOver} className="text-xs text-text-muted hover:text-text cursor-pointer">
                  New proposal
                </button>
              </div>
              <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
                <Field label="Title">
                  <select value={project.salutation} onChange={(e) => setProject({ salutation: e.target.value })} className="field h-10 text-sm">
                    {SALUTATIONS.map((s) => (
                      <option key={s} value={s}>
                        {s || 'None'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Client name">
                  <input
                    type="text"
                    value={project.clientName}
                    onChange={(e) => setProject({ clientName: e.target.value })}
                    placeholder="Rahul Sharma"
                    className={`field h-10 text-sm ${showErrors && !project.clientName.trim() ? 'border-danger' : ''}`}
                  />
                </Field>
              </div>
              <Field label="Site location">
                <input
                  type="text"
                  value={project.siteLocation}
                  onChange={(e) => setProject({ siteLocation: e.target.value })}
                  placeholder="Ahmedabad, Gujarat"
                  className="field h-10 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" value={project.date} onChange={(e) => setProject({ date: e.target.value })} className="field h-10 text-sm" />
                </Field>
                <Field label="Revision">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R</span>
                    <input
                      type="number"
                      min="1"
                      value={project.revision}
                      onChange={(e) => setProject({ revision: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="field h-10 text-sm pl-7"
                    />
                  </div>
                </Field>
              </div>
              <p className="text-xs text-text-muted/70">The revision shows on the title page and in the file name from R2 onwards.</p>
            </section>

            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="section-title">Rooms</h2>
                <span className="text-xs text-text-muted">
                  {imageCount} {imageCount === 1 ? 'view' : 'views'}
                </span>
              </div>
              {project.rooms.map((room, i) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  index={i}
                  roomCount={project.rooms.length}
                  images={images}
                  views={views}
                  pairs={pairs}
                  lowDpi={lowDpi}
                  pending={pending[room.id] || 0}
                  errors={errors[room.id] || []}
                  dispatch={dispatch}
                  onAddFiles={addFiles}
                  onRemoveImage={removeImage}
                  onRemoveRoom={() => removeRoom(room)}
                  onDismissErrors={() => setErrors((e) => ({ ...e, [room.id]: [] }))}
                  showNameError={showErrors}
                />
              ))}
              <button
                type="button"
                onClick={() => dispatch({ type: 'addRoom' })}
                className="w-full h-11 rounded-xl border border-border text-sm text-text-muted hover:text-text hover:border-accent/60 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Icon name="plus" /> Add room
              </button>
              {project.rooms.length > 1 && (
                <p className="text-xs text-text-muted/70">Each room gets its own divider page, and the title page lists every room.</p>
              )}
            </section>
          </div>

          <aside className="mt-12 lg:mt-0 lg:sticky lg:top-[80px] lg:self-start lg:max-h-[calc(100vh-96px)] lg:overflow-y-auto lg:pr-1 lg:-mr-1">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="section-title">
                Pages <span className="text-text-muted font-normal normal-case tracking-normal ml-1">{pages.length}</span>
              </h2>
              <span className="text-xs text-text-muted">Click a page to see it large</span>
            </div>
            <PageGrid pages={pages} images={images} assets={assets} hasImages={imageCount > 0} />
          </aside>
        </main>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
