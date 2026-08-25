// ============================================================
// EUROTRIPS — регресійний тест форм-примітивів DS.
//
// ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ: примітиви були звичайними FC, тож ref від
// react-hook-form не доїжджав до <input>. RHF читав значення як
// undefined, форма падала на «Required» із заповненими полями —
// увійти в систему було неможливо. build і type-check це пропустили,
// бо помилка рантаймова.
// ============================================================

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Input, Textarea, Select, Checkbox, Field } from './Input';

const FORWARD_REF = Symbol.for('react.forward_ref');

describe('форм-примітиви прокидають ref', () => {
  it.each([
    ['Input', Input],
    ['Textarea', Textarea],
    ['Select', Select],
    ['Checkbox', Checkbox],
  ])('%s є forwardRef-компонентом', (_name, Component) => {
    expect((Component as unknown as { $$typeof: symbol }).$$typeof).toBe(FORWARD_REF);
  });
});

describe('react-hook-form читає значення з примітивів', () => {
  function LoginLikeForm({ onValid }: { onValid: (d: unknown) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; note: string }>();
    return (
      <div>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" {...register('email', { required: 'Email обов\'язковий' })} />
        </Field>
        <Field label="Нотатка" htmlFor="note">
          <Textarea id="note" {...register('note')} />
        </Field>
        <button onClick={handleSubmit(onValid)}>Увійти</button>
      </div>
    );
  }

  it('передає введене значення в submit, а не undefined', async () => {
    const onValid = vi.fn();
    const user = userEvent.setup();
    render(<LoginLikeForm onValid={onValid} />);

    await user.type(screen.getByLabelText('Email'), 'admin@eurotrips.ua');
    await user.type(screen.getByLabelText('Нотатка'), 'тест');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0][0]).toMatchObject({
      email: 'admin@eurotrips.ua',
      note: 'тест',
    });
  });

  it('порожнє обовʼязкове поле все ще дає помилку валідації', async () => {
    const onValid = vi.fn();
    const user = userEvent.setup();
    render(<LoginLikeForm onValid={onValid} />);

    await user.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(onValid).not.toHaveBeenCalled();
    expect(await screen.findByText('Email обов\'язковий')).toBeInTheDocument();
  });
});

describe('Field звʼязує контрол із текстом помилки', () => {
  it('рендерить id `${htmlFor}-error`, на який вказує aria-describedby', () => {
    render(
      <Field label="Пароль" htmlFor="pwd" error="Закоротко">
        <Input id="pwd" aria-describedby="pwd-error" />
      </Field>,
    );

    const error = screen.getByText('Закоротко');
    expect(error).toHaveAttribute('id', 'pwd-error');
    expect(screen.getByLabelText('Пароль')).toHaveAttribute('aria-describedby', 'pwd-error');
  });
});
