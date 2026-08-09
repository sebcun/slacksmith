export interface SidebarNavItem {
  id: string;
  label: string;
}

export interface SidebarOptions {
  title: string;
  items: SidebarNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  content?: HTMLElement;
}

export function createSidebar(options: SidebarOptions): HTMLElement {
  const { title, items, activeId, onSelect, content } = options;

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';

  const header = document.createElement('div');
  header.className = 'sidebar__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'sidebar__title';
  titleEl.textContent = title;
  header.appendChild(titleEl);
  sidebar.appendChild(header);

  const body = document.createElement('div');
  body.className = 'sidebar__content';

  if (content) {
    body.appendChild(content);
  } else if (items.length > 0) {
    const nav = document.createElement('nav');
    nav.className = 'sidebar-nav';
    nav.setAttribute('aria-label', title);

    const list = document.createElement('ul');
    list.className = 'sidebar-nav__list';

    for (const item of items) {
      const listItem = document.createElement('li');
      listItem.className = 'sidebar-nav__item';

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'sidebar-nav__link';
      link.textContent = item.label;
      link.dataset.navId = item.id;

      if (item.id === activeId) {
        link.classList.add('sidebar-nav__link--active');
        link.setAttribute('aria-current', 'true');
      }

      if (onSelect) {
        link.addEventListener('click', () => onSelect(item.id));
      }

      listItem.appendChild(link);
      list.appendChild(listItem);
    }

    nav.appendChild(list);
    body.appendChild(nav);
  }

  sidebar.appendChild(body);
  return sidebar;
}

export function setSidebarActiveItem(
  sidebar: HTMLElement,
  activeId: string,
): void {
  const links = sidebar.querySelectorAll<HTMLButtonElement>('.sidebar-nav__link');

  for (const link of links) {
    const isActive = link.dataset.navId === activeId;
    link.classList.toggle('sidebar-nav__link--active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}
