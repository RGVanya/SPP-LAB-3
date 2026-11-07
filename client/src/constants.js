export const STATUS_OPTIONS = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'done', label: 'Выполнена' },
];

export function statusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}
