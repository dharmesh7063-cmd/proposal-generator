import { useRef, useState } from 'react';
import ImageCard from './ImageCard';
import { IconButton, Icon } from './ui';

export const DRAG_TYPE = 'application/x-intara-image';
const hasFiles = (e) => Array.from(e.dataTransfer.types).includes('Files');
const hasImage = (e) => Array.from(e.dataTransfer.types).includes(DRAG_TYPE);

export default function RoomCard({
  room,
  index,
  roomCount,
  images,
  views,
  pairs,
  lowDpi,
  pending,
  errors,
  dispatch,
  onAddFiles,
  onRemoveImage,
  onRemoveRoom,
  onDismissErrors,
  showNameError,
}) {
  const inputRef = useRef(null);
  const [fileOver, setFileOver] = useState(false);
  const [hint, setHint] = useState(null); // { id, where: 'before' | 'after' } or { end: true }
  const ids = room.imageIds.filter((id) => images[id]);

  const dropImage = (e, targetIndex) => {
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    const from = ids.indexOf(id);
    // `targetIndex` counts the dragged image; the reducer wants it without.
    const to = from !== -1 && from < targetIndex ? targetIndex - 1 : targetIndex;
    dispatch({ type: 'moveImage', id, roomId: room.id, index: to });
  };

  const zoneProps = {
    onDragOver: (e) => {
      if (hasFiles(e) || hasImage(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (hasFiles(e)) setFileOver(true);
        else if (!hint) setHint({ end: true });
      }
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setFileOver(false);
        setHint(null);
      }
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFileOver(false);
      setHint(null);
      if (hasFiles(e)) onAddFiles(room.id, e.dataTransfer.files);
      else dropImage(e, ids.length);
    },
  };

  return (
    <section
      {...zoneProps}
      className={`rounded-xl border p-3 sm:p-4 space-y-3 transition-colors ${
        fileOver ? 'border-accent bg-accent/5' : 'border-border bg-surface/40'
      }`}
      aria-label={`Room ${index + 1}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-accent tabular-nums w-6">{String(index + 1).padStart(2, '0')}</span>
        <input
          type="text"
          value={room.name}
          onChange={(e) => dispatch({ type: 'updateRoom', id: room.id, patch: { name: e.target.value } })}
          placeholder="Room name, for example: Master bedroom"
          className={`field h-9 text-sm flex-1 ${showNameError && !room.name.trim() && ids.length ? 'border-danger' : ''}`}
          aria-label="Room name"
        />
        {roomCount > 1 && (
          <>
            <IconButton label="Move room up" icon="up" onClick={() => dispatch({ type: 'moveRoom', id: room.id, dir: -1 })} disabled={index === 0} />
            <IconButton label="Move room down" icon="down" onClick={() => dispatch({ type: 'moveRoom', id: room.id, dir: 1 })} disabled={index === roomCount - 1} />
          </>
        )}
        <IconButton label="Remove room" icon="x" tone="danger" onClick={onRemoveRoom} />
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger space-y-1">
          {errors.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
          <button type="button" className="underline cursor-pointer" onClick={onDismissErrors}>
            Dismiss
          </button>
        </div>
      )}

      {ids.length > 0 && (
        <ul className="space-y-2.5">
          {ids.map((id, i) => {
            const img = images[id];
            return (
              <ImageCard
                key={id}
                image={img}
                view={views[id]}
                pairRole={pairs[id]}
                next={images[ids[i + 1]]}
                index={i}
                count={ids.length}
                lowDpi={lowDpi[id]}
                dispatch={dispatch}
                onRemove={() => onRemoveImage(id)}
                onMove={(dir) => dispatch({ type: 'moveImage', id, roomId: room.id, index: i + dir })}
                dropHint={hint?.id === id ? hint.where : null}
                dragProps={{
                  draggable: true,
                  onDragStart: (e) => {
                    if (e.target.closest('input, select, button, textarea')) return e.preventDefault();
                    e.dataTransfer.setData(DRAG_TYPE, id);
                    e.dataTransfer.effectAllowed = 'move';
                  },
                  onDragOver: (e) => {
                    if (!hasImage(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const where = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
                    if (hint?.id !== id || hint.where !== where) setHint({ id, where });
                  },
                  onDrop: (e) => {
                    if (!hasImage(e)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setHint(null);
                    dropImage(e, hint?.where === 'after' ? i + 1 : i);
                  },
                  onDragEnd: () => setHint(null),
                }}
              />
            );
          })}
        </ul>
      )}

      {pending > 0 && (
        <p className="text-xs text-text-muted flex items-center gap-2" role="status">
          <span className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          Adding {pending} {pending === 1 ? 'image' : 'images'}…
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-lg border border-dashed px-4 text-sm text-text-muted hover:text-text hover:border-accent/60 transition cursor-pointer flex items-center justify-center gap-2 ${
          ids.length ? 'py-3' : 'py-8 flex-col'
        } ${hint?.end ? 'border-accent' : 'border-border'}`}
      >
        <Icon name={ids.length ? 'plus' : 'image'} className={ids.length ? 'w-4 h-4' : 'w-6 h-6 opacity-60'} />
        <span>{ids.length ? 'Add images' : 'Drop renders here or click to choose'}</span>
        {!ids.length && <span className="text-xs text-text-muted/70">JPG, PNG, WebP or HEIC. Any shape, nothing gets cropped.</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(room.id, e.target.files);
          e.target.value = '';
        }}
      />
    </section>
  );
}
