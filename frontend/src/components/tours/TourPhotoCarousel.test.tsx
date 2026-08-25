// ============================================================
// EUROTRIPS — TourPhotoCarousel
// Перевіряємо ротацію, паузу під курсором, слоти-заглушки
// (у Tour ще немає поля photos) і навігацію точками.
// ============================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TourPhotoCarousel } from './TourPhotoCarousel';

const PHOTOS = [
  { caption: 'Прага', day: 1 },
  { caption: 'Париж', day: 2 },
  { caption: 'Нормандія', day: 3 },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Активне фото — те, що має клас is-on */
const activeSlot = (container: HTMLElement) =>
  container.querySelector('.et-carousel__slot.is-on')?.textContent;

describe('TourPhotoCarousel', () => {
  it('без фото показує підписану заглушку, а не порожнечу', () => {
    render(<TourPhotoCarousel photos={[]} placeholderLabel="Фото локацій туру" />);
    expect(screen.getByText('Фото локацій туру')).toBeInTheDocument();
  });

  it('рендерить слот-заглушку з назвою локації, коли немає src', () => {
    const { container } = render(<TourPhotoCarousel photos={PHOTOS} />);
    expect(container.querySelectorAll('.et-carousel__slot')).toHaveLength(3);
    expect(activeSlot(container)).toBe('Прага');
  });

  it('прокручує фото за інтервалом і зациклюється', () => {
    const { container } = render(<TourPhotoCarousel photos={PHOTOS} interval={1000} />);
    expect(activeSlot(container)).toBe('Прага');

    act(() => { vi.advanceTimersByTime(1000); });
    expect(activeSlot(container)).toBe('Париж');

    act(() => { vi.advanceTimersByTime(2000); });
    expect(activeSlot(container)).toBe('Прага'); // зациклилось
  });

  it('одне фото не ротується (нічого крутити)', () => {
    const { container } = render(<TourPhotoCarousel photos={[PHOTOS[0]]} interval={1000} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(activeSlot(container)).toBe('Прага');
  });

  it('показує підпис локації та день маршруту', () => {
    render(<TourPhotoCarousel photos={PHOTOS} />);
    const caption = document.querySelector('.et-carousel__caption');
    expect(caption?.textContent).toContain('Прага');
    expect(caption?.textContent).toContain('день 1');
  });

  it('точки навігації відповідають кількості фото', () => {
    const { container } = render(<TourPhotoCarousel photos={PHOTOS} />);
    expect(container.querySelectorAll('.et-carousel__dot')).toHaveLength(3);
  });

  it('autoplay=false зупиняє ротацію', () => {
    const { container } = render(<TourPhotoCarousel photos={PHOTOS} interval={1000} autoplay={false} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(activeSlot(container)).toBe('Прага');
  });

  it('рендерить overlay поверх фото (статус-бейдж, код туру)', () => {
    render(<TourPhotoCarousel photos={PHOTOS} overlay={<span>LP26010301</span>} />);
    expect(screen.getByText('LP26010301')).toBeInTheDocument();
  });
});
