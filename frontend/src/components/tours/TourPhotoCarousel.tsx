// ============================================================
// EUROTRIPS — TourPhotoCarousel
// Фон-карусель локацій маршруту: кросфейд, підпис локації й дня,
// точки, пауза під курсором.
//
// Без `src` слот рендериться підписаною заглушкою — екрани
// збираються ще до появи реальних фото (у Tour зараз немає поля
// photos, див. TourCard).
//
// Стилі: .et-carousel* у styles/globals.css.
// ============================================================

import React from 'react';

export interface TourPhoto {
  /** Порожньо → рендериться підписана заглушка замість зображення */
  src?: string;
  /** Назва локації — показується внизу зліва, поки це фото активне */
  caption?: string;
  /** Номер дня маршруту, поруч із підписом */
  day?: number;
}

export interface TourPhotoCarouselProps {
  photos: TourPhoto[];
  /** Період ротації, мс */
  interval?: number;
  autoplay?: boolean;
  /** Фіксована висота; інакше діє співвідношення сторін */
  height?: number | string;
  ratio?: string;
  showCaption?: boolean;
  showDots?: boolean;
  rounded?: boolean;
  /** Рендериться поверх фото, зверху — статус-бейдж, код, цінник */
  overlay?: React.ReactNode;
  placeholderLabel?: string;
  className?: string;
}

export const TourPhotoCarousel: React.FC<TourPhotoCarouselProps> = ({
  photos = [], interval = 4500, autoplay = true, height,
  showCaption = true, showDots = true, ratio = '16/9', rounded = true, overlay,
  placeholderLabel = 'Фото локацій туру', className = '',
}) => {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = photos.length;

  React.useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const timer = setInterval(() => setIndex((v) => (v + 1) % count), interval);
    return () => clearInterval(timer);
  }, [autoplay, paused, count, interval]);

  // Список фото міг скоротитись — не залишаємо індекс за межами
  React.useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  const style: React.CSSProperties = height ? { height } : { aspectRatio: ratio };
  const cls = ['et-carousel', rounded ? 'et-carousel--rounded' : '', className].filter(Boolean).join(' ');

  if (count === 0) {
    return (
      <div className={`${cls} et-carousel--empty`} style={style}>
        <span className="et-carousel__ph">{placeholderLabel}</span>
      </div>
    );
  }

  const current = photos[Math.min(index, count - 1)];

  return (
    <div
      className={cls}
      style={style}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {photos.map((photo, i) => (
        photo.src ? (
          <img
            key={`${photo.src}-${i}`}
            className={`et-carousel__img${i === index ? ' is-on' : ''}`}
            src={photo.src}
            alt={photo.caption ?? ''}
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ) : (
          <span key={`ph-${i}`} className={`et-carousel__slot${i === index ? ' is-on' : ''}`}>
            {photo.caption ?? placeholderLabel}
          </span>
        )
      ))}

      <div className="et-carousel__scrim" />
      {overlay && <div className="et-carousel__overlay">{overlay}</div>}

      {showCaption && current?.caption && (
        <div className="et-carousel__caption">
          {current.caption}
          {current.day != null && <em>день {current.day}</em>}
        </div>
      )}

      {showDots && count > 1 && (
        <div className="et-carousel__dots">
          {photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              aria-label={photo.caption ?? `Фото ${i + 1}`}
              aria-current={i === index || undefined}
              className={`et-carousel__dot${i === index ? ' is-on' : ''}`}
              onClick={(e) => { e.stopPropagation(); setIndex(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TourPhotoCarousel;
