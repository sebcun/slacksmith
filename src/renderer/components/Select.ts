export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectOptions {
  id: string;
  label: string;
  options: SelectOption[];
  value?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function createSelect(options: SelectOptions): HTMLElement {
  const {
    id,
    label,
    options: selectOptions,
    value,
    hint,
    error,
    disabled = false,
    placeholder,
    onChange,
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

  const select = document.createElement('select');
  select.className = 'field__control';
  select.id = id;
  select.disabled = disabled;

  if (error) {
    select.setAttribute('aria-invalid', 'true');
    select.setAttribute('aria-describedby', `${id}-error`);
  } else if (hint) {
    select.setAttribute('aria-describedby', `${id}-hint`);
  }

  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = !value;
    select.appendChild(placeholderOption);
  }

  for (const option of selectOptions) {
    const optionEl = document.createElement('option');
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    optionEl.disabled = option.disabled ?? false;

    if (value !== undefined && option.value === value) {
      optionEl.selected = true;
    }

    select.appendChild(optionEl);
  }

  if (onChange) {
    select.addEventListener('change', () => onChange(select.value));
  }

  field.appendChild(select);

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
