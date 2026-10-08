import { PAGE_W as W, PAGE_H as H, PT } from '../lib/constants';
import { FONTS, FONT_FAMILY } from '../lib/text';

// Draws a page spec from layout.js. Units are millimetres, same as the PDF.
export default function PageSvg({ page, images, assets, className = '' }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`block w-full h-auto ${className}`}
      role="img"
      aria-label={page.title}
      style={{ fontKerning: 'none' }}
    >
      {page.bg && <rect width={W} height={H} fill={page.bg} />}
      {page.items.map((it, i) => {
        if (it.type === 'image') {
          const href =
            it.ref === 'cover' ? assets.coverUrl : it.ref === 'thanks' ? assets.thanksUrl : images[it.ref]?.previewUrl;
          if (!href) return null;
          const c = it.crop;
          return (
            <svg key={i} x={it.x} y={it.y} width={it.w} height={it.h} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="none">
              <image href={href} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
            </svg>
          );
        }
        if (it.type === 'rect') {
          return (
            <rect
              key={i}
              x={it.x}
              y={it.y}
              width={it.w}
              height={it.h}
              rx={it.radius || 0}
              fill={it.fill}
              fillOpacity={it.opacity ?? 1}
            />
          );
        }
        if (it.type === 'text') {
          const s = it.style;
          const leading = s.leading || s.size * PT * 1.3;
          return (
            <text
              key={i}
              fontFamily={`"${FONT_FAMILY}", sans-serif`}
              fontWeight={FONTS[s.font].weight}
              fontSize={s.size * PT}
              letterSpacing={s.tracking || 0}
              fill={s.color}
              style={{ whiteSpace: 'pre', fontVariantLigatures: 'none' }}
            >
              {it.lines.map((line, j) => (
                <tspan key={j} x={it.x} y={it.y + j * leading}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        }
        if (it.type === 'logo') {
          return (
            <image
              key={i}
              href={assets.logo[it.tone]}
              x={it.x}
              y={it.y}
              width={it.w}
              height={it.h}
              opacity={it.opacity}
              preserveAspectRatio="none"
            />
          );
        }
        return null;
      })}
    </svg>
  );
}
