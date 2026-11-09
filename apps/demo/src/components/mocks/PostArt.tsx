import wordmarkWhite from '../../assets/brand/pnd-wordmark-white.png';
/** Official scales icon with its white backdrop removed (same shapes and colour), for use on the blue artwork. */
import scales from '../../assets/brand/pnd-scales-transparent.png';

/**
 * Educational PND post artwork built in code from the official assets: brand-blue field, white wordmark,
 * orange accent and the unaltered scales icon. `square` is the Instagram 1:1 post, otherwise a landscape Facebook image.
 */
export function PostArt({ title, square }: { title: string; square: boolean }) {
  return (
    <div className={`postart ${square ? 'square' : 'landscape'}`} role="img" aria-label={title}>
      <div className="pa-glow" aria-hidden="true" />
      <img className="pa-scales" src={scales} alt="" aria-hidden="true" draggable={false} />
      <div className="pa-body">
        <img className="pa-wordmark" src={wordmarkWhite} alt="" aria-hidden="true" draggable={false} />
        <div className="pa-text">
          <i className="pa-accent" aria-hidden="true" />
          <strong>{title}</strong>
        </div>
      </div>
    </div>
  );
}

/** Tiny version of the same artwork for the collapsed post header. */
export function PostThumb() {
  return (
    <div className="thumb" aria-hidden="true">
      <img src={scales} alt="" draggable={false} />
    </div>
  );
}
