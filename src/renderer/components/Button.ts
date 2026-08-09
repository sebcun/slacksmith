export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: (event: MouseEvent) => void;
}

export function createButton(options: ButtonOptions): HTMLButtonElement {
  const {
    label,
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    onClick,
  } = options;

  const button = document.createElement('button');
  button.type = type;
  button.className = `btn btn--${variant} btn--${size}`;
  button.textContent = label;
  button.disabled = disabled;

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}
