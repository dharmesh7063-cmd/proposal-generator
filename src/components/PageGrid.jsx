import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PageSvg from './PageSvg';
import { LAYOUT_NAMES } from '../lib/layout';
import { Icon, IconButton } from './ui';

function pageCaption(page) {
  if (page.kind !== 'view') return page.title;
  return `${page.title} · ${LAYOUT_NAMES[page.layout]}`;
}

function Viewer({ pages, index, images, assets, onClose, onIndex }) {
  const page = pages[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(Math.min(pages.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, pages.length, onClose, onIndex]);

  // Portalled to <body>: the sticky preview column would otherwise trap it under the header.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/92 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Page preview"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-text-muted">
          <span className="text-text">Page {index + 1}</span> of {pages.length} · {pageCaption(page)}
          {page.roomName ? ` · ${page.roomName}` : ''}
        </p>
        <IconButton label="Close preview" icon="x" onClick={onClose} />
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center gap-2 px-2 sm:px-4 pb-6">
        <IconButton label="Previous page" icon="left" disabled={index === 0} onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }} />
        <div
          className="w-full max-w-[min(100%,calc((100vh-110px)*297/210))]"
          onClick={(e) => e.stopPropagation()}
        >
          <PageSvg page={page} images={images} assets={assets} className="rounded-sm shadow-2xl" />
        </div>
        <IconButton label="Next page" icon="right" disabled={index === pages.length - 1} onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }} />
      </div>
    </div>,
    document.body,
  );
}

export default function PageGrid({ pages, images, assets, hasImages }) {
  const [open, setOpen] = useState(null);
  const viewing = open != null && open < pages.length ? open : null;

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-4">
        {pages.map((page, i) => (
          <figure key={page.key} className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="group relative block w-full rounded-md overflow-hidden ring-1 ring-white/10 hover:ring-accent/70 transition cursor-zoom-in"
              aria-label={`Open page ${i + 1}: ${pageCaption(page)}`}
            >
              <PageSvg page={page} images={images} assets={assets} />
              {page.lowRes?.length > 0 && (
                <span className="absolute top-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-warn flex items-center gap-1">
                  <Icon name="alert" className="w-3 h-3" /> Low res
                </span>
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition">
                <Icon name="expand" className="w-3.5 h-3.5" />
              </span>
            </button>
            <figcaption className="mt-1.5 text-[11px] text-text-muted truncate">
              <span className="tabular-nums text-text/80 mr-1.5">{i + 1}</span>
              {pageCaption(page)}
            </figcaption>
          </figure>
        ))}
      </div>
      {!hasImages && (
        <p className="mt-4 text-sm text-text-muted">
          Add renders to a room and their pages appear here, laid out to suit each image's shape.
        </p>
      )}
      {viewing != null && (
        <Viewer
          pages={pages}
          index={viewing}
          images={images}
          assets={assets}
          onClose={() => setOpen(null)}
          onIndex={setOpen}
        />
      )}
    </>
  );
}
