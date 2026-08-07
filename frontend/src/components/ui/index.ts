// ============================================================
// EUROTRIPS — ui/index.ts
// Примітиви дизайн-системи. Для нового коду беріть їх звідси,
// а не стилізуйте інлайн: єдиний контракт + автоматична підтримка
// світлої/темної теми через токени (styles/globals.css).
// ============================================================

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export {
  Field, Input, Textarea, Select, Checkbox, Radio,
  type FieldProps, type InputProps, type TextareaProps, type SelectProps, type CheckProps,
} from './Input';
export {
  IconButton, EmptyState, Skeleton, SkeletonRows,
  type IconButtonProps, type EmptyStateProps, type SkeletonProps, type SkeletonRowsProps,
} from './Feedback';

// Наявні доменні компоненти (лишаються на своїх місцях)
export { StatusBadge } from './StatusBadge';
export { HotelStatusBadge } from './HotelStatusBadge';
export { DeadlineIndicator } from './DeadlineIndicator';
export { OccupancyBar } from './OccupancyBar';
export { CommissionBadge } from './CommissionBadge';
