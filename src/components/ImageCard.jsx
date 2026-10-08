import { useRef } from 'react';
import {
  LAYOUT_NAMES,
  autoLayout,
  canPair,
  coverCrop,
  cropLoss,
  describeShape,
  layoutOptions,
  ratioOf,
  resolveLayout,
} from '../lib/layout';
import { LOW_DPI } from '../lib/constants';
import { IconButton, Icon } from './ui';

function FocalPicker({ image, onChange }) {
  const ref = useRef(null);
  const crop = coverCrop(ratioOf(image), image.focal);
  const set = (e) => {
    const r = ref.current.getBoundingClientRect();
    onChange({
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    });
  };
  return (
    <div className="space-y-1.5">
      <div
        ref={ref}
        className="relative w-full overflow-hidden rounded-md cursor-crosshair touch-none select-none"
        style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: 260 }}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Synthetic or already-released pointers can't be captured; dragging still works.
          }
          set(e);
        }}
        onPointerMove={(e) => e.buttons && set(e)}
      >
        <img src={image.previewUrl} alt="" className="absolute inset-0 w-full h-full object-fill" draggable={false} />
        <div
          className="absolute border border-cream/90 rounded-[2px]"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.w * 100}%`,
            height: `${crop.h * 100}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          }}
        />
      </div>
      <p className="text-xs text-text-muted">
        Drag on the image to choose what stays on the page. {Math.round(cropLoss(crop) * 100)}% is cut off.
      </p>
    </div>
  );
}

export default function ImageCard({
  image,
  view,
  pairRole,
  next,
  index,
  count,
  lowDpi,
  dispatch,
  onRemove,
  onMove,
  dragProps,
  dropHint,
}) {
  const resolved = resolveLayout(image);
  const options = layoutOptions(image);
  const pairable = canPair(image, next);
  const crop = resolved === 'bleed' ? coverCrop(ratioOf(image), image.focal) : null;
  const update = (patch) => dispatch({ type: 'updateImage', id: image.id, patch });

  return (
    <li
      {...dragProps}
      className={`relative rounded-lg border bg-surface p-3 transition-colors ${
        dropHint ? 'border-accent' : 'border-border'
      }`}
    >
      {dropHint === 'before' && <span className="absolute -top-[5px] left-2 right-2 h-0.5 rounded bg-accent" />}
      {dropHint === 'after' && <span className="absolute -bottom-[5px] left-2 right-2 h-0.5 rounded bg-accent" />}
      <div className="flex gap-3">
        <div className="w-20 h-16 flex-shrink-0 rounded-md bg-black flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
          <img src={image.previewUrl} alt="" className="max-w-full max-h-full object-contain" draggable={false} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" title={image.name}>
            <span className="text-accent font-medium mr-1.5">{String(view).padStart(2, '0')}</span>
            {image.name}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {describeShape(image)} · {image.width}×{image.height}
          </p>
          {lowDpi != null && lowDpi < LOW_DPI && (
            <p className="text-xs text-warn mt-1 flex items-center gap-1">
              <Icon name="alert" className="w-3.5 h-3.5" />
              Low resolution ({Math.round(lowDpi)} dpi on the page). It may look soft when zoomed or printed.
            </p>
          )}
        </div>
        <div className="flex items-start gap-0.5 flex-shrink-0 -mr-1 -mt-1">
          <IconButton label="Move up" icon="up" onClick={() => onMove(-1)} disabled={index === 0} />
          <IconButton label="Move down" icon="down" onClick={() => onMove(1)} disabled={index === count - 1} />
          <IconButton label="Remove image" icon="x" onClick={onRemove} tone="danger" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`layout-${image.id}`}>
          Page layout
        </label>
        <select
          id={`layout-${image.id}`}
          value={options.includes(image.layout) ? image.layout : 'auto'}
          onChange={(e) => update({ layout: e.target.value })}
          className="field h-8 py-0 text-xs w-auto"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o === 'auto'
                ? `Auto: ${LAYOUT_NAMES[autoLayout(ratioOf(image))].toLowerCase()}`
                : o === 'bleed'
                  ? 'Full page (crops)'
                  : LAYOUT_NAMES[o]}
            </option>
          ))}
        </select>
        {resolved === 'side' && !pairRole && (
          <button type="button" className="chip" onClick={() => update({ flip: !image.flip })}>
            Panel on {image.flip ? 'left' : 'right'}
          </button>
        )}
        {pairRole === 'second' && (
          <span className="text-xs text-text-muted">Shares a page with view {String(view - 1).padStart(2, '0')}</span>
        )}
        {pairable && pairRole !== 'second' && (
          <label className="chip cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent"
              checked={Boolean(image.pairNext)}
              onChange={(e) => update({ pairNext: e.target.checked })}
            />
            Same page as next
          </label>
        )}
      </div>

      <input
        type="text"
        value={image.caption}
        onChange={(e) => update({ caption: e.target.value })}
        placeholder="Caption, for example: Wardrobe in oak veneer"
        className="field mt-2 h-9 text-sm"
        aria-label={`Caption for ${image.name}`}
      />

      {crop && cropLoss(crop) > 0.005 && (
        <div className="mt-3">
          <FocalPicker image={image} onChange={(focal) => update({ focal })} />
        </div>
      )}
    </li>
  );
}
