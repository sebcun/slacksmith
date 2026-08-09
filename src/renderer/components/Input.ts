export interface InputOptions {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number';
  onInput?: (value: string) => void;
}

export function createInput(options: InputOptions): HTMLElement {
  const {
    id,
    label,
    value = '',
    placeholder,
    hint,
    error,
    disabled = false,
    type = 'text',
    onInput,
  } = options;

  const field = document.createElement('div');
  field.className = 'field';
  if (error) {
    field.classList.add('field--error');
  }

  const labelEl = document.createElement('label');
  labelEl.className = 'field__label';
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  field.appendChild(labelEl);

  const input = document.createElement('input');
  input.className = 'field__control';
  input.id = id;
  input.type = type;
  input.value = value;
  input.disabled = disabled;

  if (placeholder) {
    input.placeholder = placeholder;
  }

  if (error) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${id}-error`);
  } else if (hint) {
    input.setAttribute('aria-describedby', `${id}-hint`);
  }

  if (onInput) {
    input.addEventListener('input', () => onInput(input.value));
  }

  field.appendChild(input);

  if (hint && !error) {
    const hintEl = document.createElement('span');
    hintEl.className = 'field__hint';
    hintEl.id = `${id}-hint`;
    hintEl.textContent = hint;
    field.appendChild(hintEl);
  }

  if (error) {
    const errorEl = document.createElement('span');
    errorEl.className = 'field__error';
    errorEl.id = `${id}-error`;
    errorEl.textContent = error;
    field.appendChild(errorEl);
  }

  return field;
}
