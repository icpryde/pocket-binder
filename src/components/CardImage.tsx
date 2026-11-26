import { useState } from 'react';
import { imageCandidates } from '../data/images';
import type { Card } from '../data/types';

/** Card art with automatic fallback to the next image host. Give it key={card.id}. */
export function CardImage({ card, size, eager = false }: { card: Card; size: 'thumb' | 'large'; eager?: boolean }) {
  const urls = imageCandidates(card, size);
  const [i, setI] = useState(0);
  if (i >= urls.length) {
    return (
      <div className="card-fallback">
        <span>{card.name}</span>
        <small>
          {card.set} #{card.number}
        </small>
      </div>
    );
  }
  return (
    <img
      src={urls[i]}
      alt={card.name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      // Requested with CORS so the same cached file can be drawn into the collage export.
      crossOrigin="anonymous"
      draggable={false}
      onError={() => setI(i + 1)}
    />
  );
}
