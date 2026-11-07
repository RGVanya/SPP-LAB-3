import { useEffect, useState } from 'react';
import { STATUS_OPTIONS } from '../constants';

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'new',
  dueDate: '',
};

const TITLE_MAX = 200;
const DESC_MAX  = 2000;

export function TaskForm({ initial, pending, error, onSubmit, submitLabel }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const fields = error?.fields || {};

  useEffect(() => {
    setForm({ ...EMPTY_FORM, ...initial });
  }, [initial]);

  function update(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  const titleLeft = TITLE_MAX - (form.title?.length || 0);
  const descLeft  = DESC_MAX  - (form.description?.length || 0);

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>

      <label className="field">
        <div className="field-header">
          <span>Название</span>
          <span className={`char-count${titleLeft <= 30 ? ' char-count--warn' : ''}`}>
            {titleLeft}
          </span>
        </div>
        <input
          name="title"
          value={form.title}
          onChange={update}
          maxLength={TITLE_MAX}
          placeholder="Введите название задачи"
          aria-invalid={Boolean(fields.title)}
          autoFocus
        />
        {fields.title && <span className="field-error">⚠ {fields.title}</span>}
      </label>

      <label className="field">
        <div className="field-header">
          <span>Описание</span>
          <span className={`char-count${descLeft <= 200 ? ' char-count--warn' : ''}`}>
            {descLeft}
          </span>
        </div>
        <textarea
          name="description"
          value={form.description}
          onChange={update}
          rows={5}
          maxLength={DESC_MAX}
          placeholder="Опишите задачу подробнее (необязательно)"
          aria-invalid={Boolean(fields.description)}
        />
        {fields.description && <span className="field-error">⚠ {fields.description}</span>}
      </label>

      <div className="form-row">
        <label className="field">
          <span>Статус</span>
          <select
            name="status"
            value={form.status}
            onChange={update}
            aria-invalid={Boolean(fields.status)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {fields.status && <span className="field-error">⚠ {fields.status}</span>}
        </label>

        <label className="field">
          <span>Срок выполнения</span>
          <input
            type="date"
            name="dueDate"
            value={form.dueDate || ''}
            onChange={update}
            aria-invalid={Boolean(fields.dueDate)}
          />
          {fields.dueDate && <span className="field-error">⚠ {fields.dueDate}</span>}
        </label>
      </div>

      {error && !error.fields && (
        <div className="banner banner-error" style={{ margin: 0 }}>
          <span className="banner-icon">⚠</span>
          {error.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
