// ============================================================
// EUROTRIPS — ProgressChecklist
// Ключова нова поведінка з дизайн-системи: блокери виїзду видно
// в шапці, а не лише десь у списку.
// ============================================================

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressChecklist } from './ProgressChecklist';
import type { TourChecklist } from '../../hooks/useTourChecklist';

function makeChecklist(overrides: Partial<TourChecklist> = {}): TourChecklist {
  return {
    id: 'c1',
    tour_id: 't1',
    readiness_percent: 0,
    transport_confirmed: false,
    hotels_all_paid: false,
    guides_all_confirmed: false,
    rooming_finalized_and_sent: false,
    documents_generated: false,
    tourists_notified: false,
    guide_assigned: false,
    emergency_contacts_ready: false,
    final_letter_sent: false,
    ...overrides,
  } as TourChecklist;
}

const ALL_DONE = makeChecklist({
  readiness_percent: 100,
  transport_confirmed: true,
  hotels_all_paid: true,
  guides_all_confirmed: true,
  rooming_finalized_and_sent: true,
  documents_generated: true,
  tourists_notified: true,
  guide_assigned: true,
  emergency_contacts_ready: true,
  final_letter_sent: true,
});

describe('ProgressChecklist · блокери виїзду', () => {
  it('рахує відкриті блокери в шапці', () => {
    render(<ProgressChecklist checklist={makeChecklist()} />);
    // 4 блокери: транспорт, готелі, гіди підтверджені, турлідер
    expect(screen.getByText(/4 блокує виїзд/)).toBeInTheDocument();
  });

  it('позначає кожен відкритий блокер у списку', () => {
    render(<ProgressChecklist checklist={makeChecklist()} />);
    expect(screen.getAllByText('блокер')).toHaveLength(4);
  });

  it('закритий блокер зникає з лічильника', () => {
    render(<ProgressChecklist checklist={makeChecklist({ transport_confirmed: true })} />);
    expect(screen.getByText(/3 блокує виїзд/)).toBeInTheDocument();
    expect(screen.getAllByText('блокер')).toHaveLength(3);
  });

  it('коли блокерів немає — шапка про них мовчить', () => {
    render(<ProgressChecklist checklist={ALL_DONE} />);
    expect(screen.queryByText(/блокує виїзд/)).not.toBeInTheDocument();
    expect(screen.queryByText('блокер')).not.toBeInTheDocument();
  });
});

describe('ProgressChecklist · групування', () => {
  it('розкладає 9 пунктів по трьох фазах підготовки', () => {
    render(<ProgressChecklist checklist={makeChecklist()} />);
    expect(screen.getByText('Логістика та розміщення')).toBeInTheDocument();
    expect(screen.getByText('Персонал')).toBeInTheDocument();
    expect(screen.getByText('Документи та комунікація')).toBeInTheDocument();
  });

  it('жоден пункт не загубився при групуванні', () => {
    render(<ProgressChecklist checklist={makeChecklist()} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });
});

describe('ProgressChecklist · редагування', () => {
  it('canEdit дозволяє перемкнути пункт', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ProgressChecklist checklist={makeChecklist()} canEdit onToggle={onToggle} />);

    await user.click(screen.getByText('Тур підтверджений перевізником'));
    expect(onToggle).toHaveBeenCalledWith('transportConfirmed', true);
  });

  it('без canEdit пункти заблоковані', () => {
    render(<ProgressChecklist checklist={makeChecklist()} onToggle={vi.fn()} />);
    for (const btn of screen.getAllByRole('button')) expect(btn).toBeDisabled();
  });
});

describe('ProgressChecklist · зворотний відлік', () => {
  it('показує кількість днів до виїзду', () => {
    const inFiveDays = new Date(Date.now() + 5 * 86_400_000).toISOString();
    render(<ProgressChecklist checklist={makeChecklist()} departureDate={inFiveDays} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('днів до виїзду')).toBeInTheDocument();
  });
});
