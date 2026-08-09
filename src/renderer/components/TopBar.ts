export interface TopBarOptions {
  title: string;
  subtitle?: string;
  actions?: HTMLElement[];
}

export function createTopBar(options: TopBarOptions): HTMLElement {
  const { title, subtitle, actions = [] } = options;

  const topbar = document.createElement('header');
  topbar.className = 'topbar';

  const brand = document.createElement('div');
  brand.className = 'topbar__brand';

  const titleEl = document.createElement('h1');
  titleEl.className = 'topbar__title';
  titleEl.textContent = title;
  brand.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'topbar__subtitle';
    subtitleEl.textContent = subtitle;
    brand.appendChild(subtitleEl);
  }

  topbar.appendChild(brand);

  if (actions.length > 0) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'topbar__actions';
    for (const action of actions) {
      actionsEl.appendChild(action);
    }
    topbar.appendChild(actionsEl);
  }

  return topbar;
}
