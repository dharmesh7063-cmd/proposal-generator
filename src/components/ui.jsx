const PATHS = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 14l2-2 4 4M15 9h.01',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  share: 'M12 3v12M12 3l-4 4M12 3l4 4M6 11H5a1 1 0 00-1 1v7a1 1 0 001 1h14a1 1 0 001-1v-7a1 1 0 00-1-1h-1',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  refresh: 'M4 4v6h6M20 20v-6h-6M5.6 15A8 8 0 0018.4 17M18.4 9A8 8 0 005.6 7',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};

export function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'grip' ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconButton({ label, icon, onClick, disabled, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition cursor-pointer disabled:opacity-25 disabled:cursor-default ${
        tone === 'danger'
          ? 'text-text-muted hover:text-danger hover:bg-danger/10'
          : 'text-text-muted hover:text-text hover:bg-white/5'
      }`}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
