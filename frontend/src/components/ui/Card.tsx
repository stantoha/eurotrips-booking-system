// ============================================================
// EUROTRIPS — ui/Card.tsx
// Панель-поверхня дизайн-системи: 12px радіус, 1px рамка,
// БЕЗ тіні в спокої (тінь — лише на hover для клікабельних).
// ============================================================

import React from 'react';

export interface CardProps {
  /** Montserrat 15/600 — заголовок у шапці картки */
  title?: React.ReactNode;
  /** Правий слот шапки — посилання «Всі →», фільтр, меню */
  action?: React.ReactNode;
  padded?: boolean;
  /** Додає lift −1px + тінь на hover (для клікабельних карток) */
  hoverable?: boolean;
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler;
}

export const Card: React.FC<CardProps> = ({
  title, action, padded = true, hoverable = false, as: Tag = 'div', children, className = '', ...rest
}) => {
  const cls = ['et-card', padded ? 'et-card--pad' : '', hoverable ? 'et-card--hover' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={cls} {...rest}>
      {(title || action) && (
        <div className="et-card__header">
          {title && <h3 className="et-card__title">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
};

export default Card;
