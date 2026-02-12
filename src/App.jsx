import { useState, useRef, useCallback } from 'react';
import { generatePdf } from './generatePdf';

const DEFAULT_BRANDING = {
  companyName: 'INTARA DESIGNS',
  tagline: 'INTERIOR | ARCHITECTURAL | PLANNING',
  website: 'www.intaradesigns.com',
  instagram: '@intara_designs',
  accentColor: '#C0623A',
  bgColor: '#0e0e0e',
};

// --- PDF Preview Components ---

function PreviewCover({ branding, logoUrl }) {
  return (
    <div
      className="w-full aspect-[297/210] rounded-lg overflow-hidden flex flex-col items-center justify-center gap-2 p-6"
      style={{ backgroundColor: branding.bgColor }}
    >
      {logoUrl && <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />}
      <div className="w-12 h-px" style={{ backgroundColor: branding.accentColor }} />
      <p className="text-white text-[10px] sm:text-xs font-bold tracking-wider text-center">{branding.companyName}</p>
      <p className="text-[7px] sm:text-[8px] text-gray-400 tracking-wider text-center">{branding.tagline}</p>
      <div className="w-12 h-px" style={{ backgroundColor: branding.accentColor }} />
      <div className="mt-2 text-center">
        <p className="text-[6px] sm:text-[7px] text-gray-500">{branding.website}</p>
        <p className="text-[6px] sm:text-[7px] text-gray-500">{branding.instagram}</p>
      </div>
    </div>
  );
}

function PreviewTitle({ clientName, roomName, branding, logoUrl }) {
  return (
    <div
      className="w-full aspect-[297/210] rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1 p-6"
      style={{ backgroundColor: branding.bgColor }}
    >
      {logoUrl && <img src={logoUrl} alt="Logo" className="h-6 w-6 object-contain mb-1" />}
      <p className="text-[7px] sm:text-[8px] text-gray-400 tracking-widest">PROPOSAL 3D FOR</p>
      <p className="text-white text-[10px] sm:text-sm font-bold tracking-wider text-center">
        MR. {(clientName || '________').toUpperCase()}
      </p>
      <p className="text-[8px] sm:text-[10px] tracking-wider text-center" style={{ color: branding.accentColor }}>
        {(roomName || '________').toUpperCase()}
      </p>
      <div className="w-10 h-px mt-1" style={{ backgroundColor: branding.accentColor }} />
    </div>
  );
}

function PreviewImage({ imageUrl, index, branding, logoUrl }) {
  return (
    <div className="w-full aspect-[297/210] rounded-lg overflow-hidden relative">
      <img src={imageUrl} alt={`View ${index + 1}`} className="w-full h-full object-cover" />
      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
      {/* View badge */}
      <span
        className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[6px] sm:text-[7px] font-bold text-white"
        style={{ backgroundColor: branding.accentColor }}
      >
        VIEW {String(index + 1).padStart(2, '0')}
      </span>
      {/* Watermark */}
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="absolute bottom-2 right-2 h-4 w-4 object-contain opacity-50" />
      ) : (
        <span className="absolute bottom-2 right-2 text-[5px] text-white/50">{branding.companyName}</span>
      )}
    </div>
  );
}

function PreviewThankYou({ branding, logoUrl }) {
  return (
    <div
      className="w-full aspect-[297/210] rounded-lg overflow-hidden flex flex-col items-center justify-center gap-2 p-6"
      style={{ backgroundColor: branding.bgColor }}
    >
      {logoUrl && <img src={logoUrl} alt="Logo" className="h-7 w-7 object-contain" />}
      <div className="w-12 h-px" style={{ backgroundColor: branding.accentColor }} />
      <p className="text-white text-[10px] sm:text-xs font-bold tracking-wider">THANK YOU</p>
      <div className="w-12 h-px" style={{ backgroundColor: branding.accentColor }} />
      <div className="mt-2 text-center">
        <p className="text-[6px] sm:text-[7px] text-gray-400">{branding.website}</p>
        <p className="text-[6px] sm:text-[7px] text-gray-500">{branding.instagram}</p>
      </div>
    </div>
  );
}

// --- Main App ---

function App() {
  const [clientName, setClientName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [images, setImages] = useState([]);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [logo, setLogo] = useState(null); // { file, url }
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const idCounter = useRef(0);

  const addFiles = useCallback((files) => {
    const newImages = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({
        id: ++idCounter.current,
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
      }));
    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = (id) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const moveImage = (index, dir) => {
    setImages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    if (logo) URL.revokeObjectURL(logo.url);
    setLogo({ file, url: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const removeLogo = () => {
    if (logo) URL.revokeObjectURL(logo.url);
    setLogo(null);
  };

  const canGenerate = clientName.trim() && roomName.trim() && images.length >= 1;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setProgress(0);
    try {
      await generatePdf({
        clientName: clientName.trim(),
        roomName: roomName.trim(),
        imageSrcs: images.map((i) => i.url),
        branding,
        logoSrc: logo?.url || null,
        onProgress: setProgress,
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  const updateBranding = (key, value) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
  };

  const totalPages = 2 + images.length + 1;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Proposal Generator
          </h1>
          <p className="text-xs text-text-muted">by {branding.companyName}</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: canGenerate && !generating ? branding.accentColor : '#555' }}
        >
          {generating ? 'Generating...' : 'Download PDF'}
        </button>
      </header>

      {/* Progress Bar */}
      {generating && (
        <div className="w-full h-1 bg-surface">
          <div
            className="h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: branding.accentColor }}
          />
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Client Details */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">Client Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Master Bedroom"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </section>

        {/* Image Upload */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
              Images ({images.length})
            </h2>
            {images.length > 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text hover:border-accent transition cursor-pointer"
              >
                + Add More
              </button>
            )}
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => images.length === 0 && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver
                ? 'border-accent bg-accent/5'
                : images.length === 0
                  ? 'border-border hover:border-accent/50 cursor-pointer'
                  : 'border-border'
            }`}
          >
            {images.length === 0 ? (
              <div className="space-y-2">
                <div className="text-4xl opacity-30">+</div>
                <p className="text-sm text-text-muted">Drag & drop images here or click to browse</p>
                <p className="text-xs text-text-muted/50">PNG, JPG, WebP accepted</p>
              </div>
            ) : (
              <div className="space-y-3">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className="flex items-center gap-3 bg-surface rounded-lg p-2 border border-border"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-16 h-12 object-cover rounded-md flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{img.name}</p>
                      <p className="text-xs text-text-muted">View {String(index + 1).padStart(2, '0')}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => moveImage(index, -1)}
                        disabled={index === 0}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-border/50 disabled:opacity-20 transition cursor-pointer disabled:cursor-default"
                        title="Move up"
                      >
                        &#9650;
                      </button>
                      <button
                        onClick={() => moveImage(index, 1)}
                        disabled={index === images.length - 1}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text hover:bg-border/50 disabled:opacity-20 transition cursor-pointer disabled:cursor-default"
                        title="Move down"
                      >
                        &#9660;
                      </button>
                      <button
                        onClick={() => removeImage(img.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-red-400 hover:text-red-300 hover:bg-red-400/10 transition cursor-pointer"
                        title="Remove"
                      >
                        &#10005;
                      </button>
                    </div>
                  </div>
                ))}
                <p
                  className="text-xs text-text-muted/50 pt-1 cursor-pointer hover:text-text-muted transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Drop more images here or click to add
                </p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
        </section>

        {/* Company Branding (Expandable) */}
        <section className="space-y-3">
          <button
            onClick={() => setBrandingOpen(!brandingOpen)}
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-text-muted hover:text-text transition cursor-pointer w-full"
          >
            <span className="transition-transform inline-block" style={{ transform: brandingOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              &#9654;
            </span>
            Company Branding
          </button>

          {brandingOpen && (
            <div className="space-y-4 bg-surface border border-border rounded-xl p-5">
              {/* Logo Upload */}
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Company Logo</label>
                <div className="flex items-center gap-3">
                  {logo ? (
                    <div className="flex items-center gap-3">
                      <img src={logo.url} alt="Logo" className="h-12 w-12 object-contain bg-bg rounded-lg border border-border p-1" />
                      <button
                        onClick={removeLogo}
                        className="text-xs text-red-400 hover:text-red-300 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs px-3 py-2 rounded-lg border border-dashed border-border text-text-muted hover:text-text hover:border-accent transition cursor-pointer"
                    >
                      Upload Logo (PNG/SVG)
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] text-text-muted/50 mt-1">Appears on cover, title, thank-you pages and as watermark on images</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Company Name</label>
                  <input
                    type="text"
                    value={branding.companyName}
                    onChange={(e) => updateBranding('companyName', e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Tagline</label>
                  <input
                    type="text"
                    value={branding.tagline}
                    onChange={(e) => updateBranding('tagline', e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Website</label>
                  <input
                    type="text"
                    value={branding.website}
                    onChange={(e) => updateBranding('website', e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Instagram</label>
                  <input
                    type="text"
                    value={branding.instagram}
                    onChange={(e) => updateBranding('instagram', e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={branding.accentColor}
                      onChange={(e) => updateBranding('accentColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-text-muted font-mono">{branding.accentColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">PDF Background Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={branding.bgColor}
                      onChange={(e) => updateBranding('bgColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-text-muted font-mono">{branding.bgColor}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setBranding(DEFAULT_BRANDING); removeLogo(); }}
                className="text-xs text-text-muted hover:text-accent transition cursor-pointer"
              >
                Reset to defaults
              </button>
            </div>
          )}
        </section>

        {/* Live PDF Preview */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-text-muted">
            PDF Preview ({totalPages} pages)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Cover */}
            <div className="space-y-1.5">
              <PreviewCover branding={branding} logoUrl={logo?.url} />
              <p className="text-[10px] text-text-muted text-center">1 — Cover</p>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <PreviewTitle clientName={clientName} roomName={roomName} branding={branding} logoUrl={logo?.url} />
              <p className="text-[10px] text-text-muted text-center">2 — Title</p>
            </div>

            {/* Image pages */}
            {images.map((img, i) => (
              <div key={img.id} className="space-y-1.5">
                <PreviewImage imageUrl={img.url} index={i} branding={branding} logoUrl={logo?.url} />
                <p className="text-[10px] text-text-muted text-center">
                  {i + 3} — View {String(i + 1).padStart(2, '0')}
                </p>
              </div>
            ))}

            {/* Thank You */}
            <div className="space-y-1.5">
              <PreviewThankYou branding={branding} logoUrl={logo?.url} />
              <p className="text-[10px] text-text-muted text-center">{totalPages} — Thank You</p>
            </div>
          </div>
        </section>

        {/* Validation Hints */}
        {!canGenerate && (
          <div className="text-xs text-text-muted/60 space-y-1">
            {!clientName.trim() && <p>Enter a client name to continue</p>}
            {!roomName.trim() && <p>Enter a room name to continue</p>}
            {images.length === 0 && <p>Upload at least one image to generate a PDF</p>}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <p className="text-center text-xs text-text-muted/40">
          {branding.companyName} Proposal Generator
        </p>
      </footer>
    </div>
  );
}

export default App;
