// ============================================================
// EUROTRIPS — AddonBridge
// Головна робота компонента — ловити розходження «продано > замовлено».
// Саме це й перевіряємо, плюс BR-04 (виручка на агентських поверхнях).
// ============================================================

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddonBridge, type AddonBridgeRow } from './AddonBridge';

const ROWS: AddonBridgeRow[] = [
  { id: '1', label: 'Екскурсія Версаль', sold: 12, ordered: 12, supplier: 'Paris Guides', price: 45, status: 'confirmed' },
  { id: '2', label: 'Круїз Сеною',       sold: 20, ordered: 14, supplier: 'Bateaux',      price: 18, status: 'ordered' },
  { id: '3', label: 'Дегустація вин',    sold: 8,  ordered: 0,  supplier: null,           price: 30, status: 'pending' },
];

describe('AddonBridge · розходження продано/замовлено', () => {
  it('сумує незамовлені місця в попередженні згори', () => {
    render(<AddonBridge rows={ROWS} />);
    // 6 (Сена) + 8 (дегустація) = 14. Шукаємо в самому попередженні —
    // число 14 є ще й у колонці «Замовлено»
    const alert = screen.getByText(/Незамовлених місць/);
    expect(alert.textContent).toMatch(/Незамовлених місць:\s*14/);
  });

  it('показує дельту в рядку з розходженням', () => {
    render(<AddonBridge rows={ROWS} />);
    expect(screen.getByText('−6')).toBeInTheDocument();
    expect(screen.getByText('−8')).toBeInTheDocument();
  });

  it('без розходжень попередження не показується', () => {
    render(<AddonBridge rows={[ROWS[0]]} />);
    expect(screen.queryByText(/Незамовлених місць/)).not.toBeInTheDocument();
  });

  it('порожній список пояснює ситуацію, а не мовчить', () => {
    render(<AddonBridge rows={[]} />);
    expect(screen.getByText('На цей виїзд допуслуги не продавалися.')).toBeInTheDocument();
  });
});

describe('AddonBridge · дії замовлення', () => {
  it('кнопка «Замовити» зʼявляється лише для рядків із розходженням і лише при canEdit', async () => {
    const onOrder = vi.fn();
    const user = userEvent.setup();
    render(<AddonBridge rows={ROWS} canEdit onOrder={onOrder} />);

    const buttons = screen.getAllByRole('button', { name: /Замовити/ });
    expect(buttons).toHaveLength(2); // рядок 1 без розходження — без кнопки

    await user.click(buttons[0]);
    expect(onOrder).toHaveBeenCalledWith('2', 6); // саме бракуючу кількість
  });

  it('без canEdit кнопок замовлення немає (перегляд лише для читання)', () => {
    render(<AddonBridge rows={ROWS} onOrder={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Замовити/ })).not.toBeInTheDocument();
  });
});

describe('AddonBridge · BR-04', () => {
  it('showRevenue=false ховає ціни й підсумок виручки', () => {
    render(<AddonBridge rows={ROWS} showRevenue={false} />);
    expect(screen.queryByText(/Разом продано допуслуг/)).not.toBeInTheDocument();
    expect(screen.queryByText(/45 EUR ×/)).not.toBeInTheDocument();
  });

  it('за замовчуванням показує виручку та нагадує про BR-02', () => {
    render(<AddonBridge rows={ROWS} />);
    expect(screen.getByText(/Разом продано допуслуг/)).toBeInTheDocument();
    expect(screen.getByText(/не входить у комісію агента/)).toBeInTheDocument();
  });

  it('рахує виручку як ціна × продано по всіх рядках', () => {
    render(<AddonBridge rows={ROWS} />);
    // 45×12 + 18×20 + 30×8 = 540 + 360 + 240 = 1140
    expect(screen.getByText(/1\s*140 EUR/)).toBeInTheDocument();
  });
});
