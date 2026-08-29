export type BlockKitEditorBlockType = 'header' | 'markdown' | 'divider' | 'image' | 'buttons';

export interface BlockKitEditorBlockBase {
  id: string;
  type: BlockKitEditorBlockType;
}

export interface BlockKitHeaderBlock extends BlockKitEditorBlockBase {
  type: 'header';
  text: string;
}

export interface BlockKitMarkdownBlock extends BlockKitEditorBlockBase {
  type: 'markdown';
  text: string;
}

export interface BlockKitDividerBlock extends BlockKitEditorBlockBase {
  type: 'divider';
}

export interface BlockKitImageBlock extends BlockKitEditorBlockBase {
  type: 'image';
  imageUrl: string;
  altText: string;
  title: string;
}

export interface BlockKitButtonDefinition {
  label: string;
  actionId: string;
}

export interface BlockKitButtonsBlock extends BlockKitEditorBlockBase {
  type: 'buttons';
  buttons: BlockKitButtonDefinition[];
}

export type BlockKitEditorBlock =
  | BlockKitHeaderBlock
  | BlockKitMarkdownBlock
  | BlockKitDividerBlock
  | BlockKitImageBlock
  | BlockKitButtonsBlock;

export interface BlockKitMessage {
  blocks: BlockKitEditorBlock[];
}

export interface ParsedBlockKitButton {
  label: string;
  actionId: string;
}

const ACTION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function createBlockKitBlockId(): string {
  return crypto.randomUUID();
}

export function createDefaultBlockKitMessage(): BlockKitMessage {
  return { blocks: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeButtonDefinition(value: unknown): BlockKitButtonDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const actionId = typeof value.actionId === 'string' ? value.actionId.trim() : '';

  if (!label || !actionId) {
    return null;
  }

  return { label, actionId };
}

function normalizeEditorBlock(value: unknown): BlockKitEditorBlock | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  const id =
    typeof value.id === 'string' && value.id.trim().length > 0
      ? value.id
      : createBlockKitBlockId();

  switch (value.type) {
    case 'header': {
      const text = typeof value.text === 'string' ? value.text : '';
      return { id, type: 'header', text };
    }

    case 'markdown': {
      const text = typeof value.text === 'string' ? value.text : '';
      return { id, type: 'markdown', text };
    }

    case 'divider':
      return { id, type: 'divider' };

    case 'image': {
      return {
        id,
        type: 'image',
        imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : '',
        altText: typeof value.altText === 'string' ? value.altText : '',
        title: typeof value.title === 'string' ? value.title : '',
      };
    }

    case 'buttons': {
      const rawButtons = Array.isArray(value.buttons) ? value.buttons : [];
      const buttons = rawButtons
        .map((entry) => normalizeButtonDefinition(entry))
        .filter((entry): entry is BlockKitButtonDefinition => entry !== null);

      return {
        id,
        type: 'buttons',
        buttons: buttons.length > 0 ? buttons : [{ label: 'Continue', actionId: 'continue' }],
      };
    }

    default:
      return null;
  }
}

export function normalizeBlockKitMessage(value: unknown): BlockKitMessage {
  if (!isRecord(value) || !Array.isArray(value.blocks)) {
    return createDefaultBlockKitMessage();
  }

  const blocks = value.blocks
    .map((entry) => normalizeEditorBlock(entry))
    .filter((entry): entry is BlockKitEditorBlock => entry !== null);

  return { blocks };
}

function parseLegacyButtons(entries: unknown): BlockKitButtonDefinition[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  const buttons: BlockKitButtonDefinition[] = [];

  for (const entry of entries) {
    const raw = String(entry ?? '').trim();
    if (!raw) {
      continue;
    }

    const separatorIndex = raw.indexOf('|');
    if (separatorIndex === -1) {
      continue;
    }

    const label = raw.slice(0, separatorIndex).trim();
    const actionId = raw.slice(separatorIndex + 1).trim();

    if (label && actionId) {
      buttons.push({ label, actionId });
    }
  }

  return buttons;
}

/** Migrate legacy message/buttons config or normalize stored builder data. */
export function resolveBlockKitMessageFromConfig(config: Record<string, unknown>): BlockKitMessage {
  if (config.blockKitMessage !== undefined) {
    return normalizeBlockKitMessage(config.blockKitMessage);
  }

  const blocks: BlockKitEditorBlock[] = [];
  const legacyMessage = typeof config.message === 'string' ? config.message.trim() : '';

  if (legacyMessage.length > 0) {
    blocks.push({
      id: createBlockKitBlockId(),
      type: 'markdown',
      text: legacyMessage,
    });
  }

  const legacyButtons = parseLegacyButtons(config.buttons);
  if (legacyButtons.length > 0) {
    blocks.push({
      id: createBlockKitBlockId(),
      type: 'buttons',
      buttons: legacyButtons,
    });
  }

  if (blocks.length === 0) {
    return { blocks: [] };
  }

  return { blocks };
}

export function cloneBlockKitMessage(message: BlockKitMessage): BlockKitMessage {
  return {
    blocks: message.blocks.map((block) => {
      if (block.type === 'buttons') {
        return {
          ...block,
          buttons: block.buttons.map((button) => ({ ...button })),
        };
      }

      return { ...block };
    }),
  };
}

function validateButton(button: BlockKitButtonDefinition, index: number): void {
  if (!button.label.trim()) {
    throw new Error(`Button ${index + 1} needs a label.`);
  }

  if (!button.actionId.trim()) {
    throw new Error(`Button ${index + 1} needs an action ID.`);
  }

  if (!ACTION_ID_PATTERN.test(button.actionId)) {
    throw new Error(
      `Button action ID "${button.actionId}" can only contain letters, numbers, underscores, and hyphens.`,
    );
  }
}

export function validateBlockKitMessage(message: BlockKitMessage): void {
  if (message.blocks.length === 0) {
    throw new Error('Add at least one block to the message.');
  }

  let buttonCount = 0;

  for (const [index, block] of message.blocks.entries()) {
    switch (block.type) {
      case 'header':
        if (!block.text.trim()) {
          throw new Error(`Header block ${index + 1} needs text.`);
        }
        break;

      case 'markdown':
        if (!block.text.trim()) {
          throw new Error(`Markdown block ${index + 1} needs text.`);
        }
        break;

      case 'image':
        if (!block.imageUrl.trim()) {
          throw new Error(`Image block ${index + 1} needs an image URL.`);
        }

        if (!block.altText.trim()) {
          throw new Error(`Image block ${index + 1} needs alt text.`);
        }
        break;

      case 'buttons':
        if (block.buttons.length === 0) {
          throw new Error(`Button block ${index + 1} needs at least one button.`);
        }

        buttonCount += block.buttons.length;
        block.buttons.forEach((button, buttonIndex) => {
          validateButton(button, buttonIndex);
        });
        break;

      case 'divider':
        break;

      default:
        break;
    }
  }

  if (buttonCount > 5) {
    throw new Error('Block Kit messages support at most 5 buttons in total.');
  }
}

export function getBlockKitMessageSummary(message: BlockKitMessage): string {
  if (message.blocks.length === 0) {
    return 'Add an item to get started';
  }

  const counts = {
    header: 0,
    markdown: 0,
    divider: 0,
    image: 0,
    buttons: 0,
  };

  for (const block of message.blocks) {
    counts[block.type] += 1;
  }

  const parts: string[] = [];

  if (counts.header > 0) {
    parts.push(`${counts.header} header${counts.header === 1 ? '' : 's'}`);
  }

  if (counts.markdown > 0) {
    parts.push(`${counts.markdown} text`);
  }

  if (counts.image > 0) {
    parts.push(`${counts.image} image${counts.image === 1 ? '' : 's'}`);
  }

  if (counts.buttons > 0) {
    parts.push(`${counts.buttons} button row${counts.buttons === 1 ? '' : 's'}`);
  }

  if (counts.divider > 0) {
    parts.push(`${counts.divider} divider${counts.divider === 1 ? '' : 's'}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Empty message';
}

export function getBlockKitFallbackText(message: BlockKitMessage): string {
  for (const block of message.blocks) {
    if (block.type === 'header' && block.text.trim()) {
      return block.text.trim();
    }

    if (block.type === 'markdown' && block.text.trim()) {
      return block.text.trim();
    }
  }

  return 'Block Kit message';
}

type SlackBlock = Record<string, unknown>;

function resolveText(value: string, resolve?: (text: string) => string): string {
  return resolve ? resolve(value) : value;
}

export function buildSlackBlocksFromMessage(
  message: BlockKitMessage,
  resolve?: (text: string) => string,
): SlackBlock[] {
  validateBlockKitMessage(message);

  const slackBlocks: SlackBlock[] = [];

  for (const block of message.blocks) {
    switch (block.type) {
      case 'header':
        slackBlocks.push({
          type: 'header',
          text: {
            type: 'plain_text',
            text: resolveText(block.text, resolve).slice(0, 150),
            emoji: true,
          },
        });
        break;

      case 'markdown':
        slackBlocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: resolveText(block.text, resolve),
          },
        });
        break;

      case 'divider':
        slackBlocks.push({ type: 'divider' });
        break;

      case 'image': {
        const imageBlock: SlackBlock = {
          type: 'image',
          image_url: resolveText(block.imageUrl, resolve),
          alt_text: resolveText(block.altText, resolve).slice(0, 2000),
        };

        const title = resolveText(block.title, resolve).trim();
        if (title.length > 0) {
          imageBlock.title = {
            type: 'plain_text',
            text: title.slice(0, 2000),
          };
        }

        slackBlocks.push(imageBlock);
        break;
      }

      case 'buttons':
        slackBlocks.push({
          type: 'actions',
          elements: block.buttons.map((button) => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: resolveText(button.label, resolve).slice(0, 75),
              emoji: true,
            },
            action_id: resolveText(button.actionId, resolve),
          })),
        });
        break;

      default:
        break;
    }
  }

  if (slackBlocks.length === 0) {
    throw new Error('Block Kit message requires at least one block.');
  }

  return slackBlocks;
}

/** @deprecated Use buildSlackBlocksFromMessage instead. */
export function parseBlockKitButtons(entries: unknown): ParsedBlockKitButton[] {
  return parseLegacyButtons(entries);
}

/** @deprecated Use buildSlackBlocksFromMessage instead. */
export function buildBlockKitBlocks(
  messageText: string,
  buttons: ParsedBlockKitButton[],
): SlackBlock[] {
  const blocks: BlockKitEditorBlock[] = [];

  if (messageText.trim()) {
    blocks.push({
      id: createBlockKitBlockId(),
      type: 'markdown',
      text: messageText,
    });
  }

  if (buttons.length > 0) {
    blocks.push({
      id: createBlockKitBlockId(),
      type: 'buttons',
      buttons,
    });
  }

  return buildSlackBlocksFromMessage({ blocks });
}

export function createEmptyBlock(type: BlockKitEditorBlockType): BlockKitEditorBlock {
  switch (type) {
    case 'header':
      return { id: createBlockKitBlockId(), type: 'header', text: 'Section title' };
    case 'markdown':
      return {
        id: createBlockKitBlockId(),
        type: 'markdown',
        text: 'Write your message here. Supports *bold*, _italic_, and `code`.',
      };
    case 'divider':
      return { id: createBlockKitBlockId(), type: 'divider' };
    case 'image':
      return {
        id: createBlockKitBlockId(),
        type: 'image',
        imageUrl: 'https://api.slack.com/img/blocks/bkb_template_images/beagledog.jpg',
        altText: 'Example image',
        title: '',
      };
    case 'buttons':
      return {
        id: createBlockKitBlockId(),
        type: 'buttons',
        buttons: [{ label: 'Continue', actionId: 'continue' }],
      };
    default:
      return createEmptyBlock('markdown');
  }
}

export const BLOCK_KIT_BLOCK_LABELS: Record<BlockKitEditorBlockType, string> = {
  header: 'Header',
  markdown: 'Markdown',
  divider: 'Divider',
  image: 'Image',
  buttons: 'Buttons',
};
