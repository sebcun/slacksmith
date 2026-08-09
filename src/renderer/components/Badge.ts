export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeOptions {
  label: string;
  variant?: BadgeVariant;
}

export function createBadge(options: BadgeOptions): HTMLElement {
  const { label, variant = 'default' } = options;

  const badge = document.createElement('span');
  badge.className = `badge badge--${variant}`;
  badge.textContent = label;

  return badge;
}
