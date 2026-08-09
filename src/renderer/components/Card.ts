export interface CardOptions {
  title: string;
  description?: string;
  content?: HTMLElement | HTMLElement[];
  footer?: HTMLElement | HTMLElement[];
}

export function createCard(options: CardOptions): HTMLElement {
  const { title, description, content, footer } = options;

  const card = document.createElement('article');
  card.className = 'card';

  const header = document.createElement('header');
  header.className = 'card__header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'card__title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  if (description) {
    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'card__description';
    descriptionEl.textContent = description;
    header.appendChild(descriptionEl);
  }

  card.appendChild(header);

  if (content) {
    const body = document.createElement('div');
    body.className = 'card__body';
    appendNodes(body, content);
    card.appendChild(body);
  }

  if (footer) {
    const footerEl = document.createElement('footer');
    footerEl.className = 'card__footer';
    appendNodes(footerEl, footer);
    card.appendChild(footerEl);
  }

  return card;
}

function appendNodes(
  parent: HTMLElement,
  nodes: HTMLElement | HTMLElement[],
): void {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  for (const node of list) {
    parent.appendChild(node);
  }
}
