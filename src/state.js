const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const newId = () => crypto.randomUUID();

export function newRoom(name = '') {
  return { id: newId(), name, imageIds: [] };
}

export function emptyState() {
  return {
    project: {
      salutation: 'Mr.',
      clientName: '',
      siteLocation: '',
      date: today(),
      revision: 1,
      quality: 'share',
      rooms: [newRoom()],
    },
    images: {},
  };
}

// The parts of an image record that are saved as the draft (blobs are stored separately).
export function imageMeta(img) {
  const { blob: _b, previewBlob: _p, previewUrl: _u, ...meta } = img;
  return meta;
}

const mapRooms = (state, fn) => ({ ...state, project: { ...state.project, rooms: state.project.rooms.map(fn) } });

export function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'reset':
      return emptyState();
    case 'setProject':
      return { ...state, project: { ...state.project, ...action.patch } };
    case 'addRoom':
      return { ...state, project: { ...state.project, rooms: [...state.project.rooms, newRoom()] } };
    case 'updateRoom':
      return mapRooms(state, (r) => (r.id === action.id ? { ...r, ...action.patch } : r));
    case 'moveRoom': {
      const rooms = [...state.project.rooms];
      const i = rooms.findIndex((r) => r.id === action.id);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= rooms.length) return state;
      [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
      return { ...state, project: { ...state.project, rooms } };
    }
    case 'removeRoom': {
      const room = state.project.rooms.find((r) => r.id === action.id);
      if (!room) return state;
      const images = { ...state.images };
      room.imageIds.forEach((id) => delete images[id]);
      let rooms = state.project.rooms.filter((r) => r.id !== action.id);
      if (!rooms.length) rooms = [newRoom()];
      return { project: { ...state.project, rooms }, images };
    }
    case 'addImage': {
      if (!state.project.rooms.some((r) => r.id === action.roomId)) return state; // room removed mid-import
      const images = { ...state.images, [action.image.id]: action.image };
      const next = mapRooms(state, (r) =>
        r.id === action.roomId ? { ...r, imageIds: [...r.imageIds, action.image.id] } : r,
      );
      return { ...next, images };
    }
    case 'updateImage':
      if (!state.images[action.id]) return state;
      return { ...state, images: { ...state.images, [action.id]: { ...state.images[action.id], ...action.patch } } };
    case 'removeImage': {
      const images = { ...state.images };
      delete images[action.id];
      const next = mapRooms(state, (r) => ({ ...r, imageIds: r.imageIds.filter((id) => id !== action.id) }));
      return { ...next, images };
    }
    case 'moveImage': {
      // Moves an image to `index` within `roomId` (index counted without the moved image).
      const stripped = state.project.rooms.map((r) => ({ ...r, imageIds: r.imageIds.filter((id) => id !== action.id) }));
      const rooms = stripped.map((r) => {
        if (r.id !== action.roomId) return r;
        const ids = [...r.imageIds];
        ids.splice(Math.max(0, Math.min(action.index, ids.length)), 0, action.id);
        return { ...r, imageIds: ids };
      });
      return { ...state, project: { ...state.project, rooms } };
    }
    default:
      return state;
  }
}
