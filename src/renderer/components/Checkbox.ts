export interface CheckboxOptions {
  id: string;
  label: string;
  checked?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

export function createCheckbox(options: CheckboxOptions): HTMLElement {
  const {
    id,
    label,
    checked = false,
    hint,
    error,
    disabled = false,
    onChange,
  } = options;

  const field = document.createElement('div');
  field.className = 'field field--checkbox';
  if (error) {
    field.classList.add('field--error');
  }

  const row = document.createElement('div');
  row.className = 'field__checkbox-row';

  const input = document.createElement('input');
  input.className = 'field__control field__control--checkbox';
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.disabled = disabled;

  if (error) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${id}-error`);
  } else if (hint) {
    input.setAttribute('aria-describedby', `${id}-hint`);
  }

  const labelEl = document.createElement('label');
  labelEl.className = 'field__checkbox-label';
  labelEl.htmlFor = id;
  labelEl.textContent = label;

  if (onChange) {
    input.addEventListener('change', () => onChange(input.checked));
  }

  row.append(input, labelEl);
  field.appendChild(row);

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
