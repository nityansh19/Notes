import { Node, mergeAttributes } from '@tiptap/core';
export const Toggle = Node.create({
  name: 'details',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { summary: { default: 'Details' } };
  },
  parseHTML() {
    return [{ tag: 'details', contentElement: '.details-content' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes),
      ['summary', String(HTMLAttributes.summary || 'Details')],
      ['div', { class: 'details-content' }, 0],
    ];
  },
});
