export const presentationTree = [
  {
    id: 'lectures',
    type: 'folder',
    name: 'Lectures',
    children: [
      {
        id: 'lecture-week-1',
        type: 'folder',
        name: 'Week 1',
        children: [
          { id: 'lecture-week-1-slides', type: 'file', name: 'intro-slides.pptx' },
          { id: 'lecture-week-1-feedback', type: 'file', name: 'intro-feedback.md' },
          { id: 'lecture-week-1-rubric', type: 'file', name: 'delivery-rubric.pdf' },
        ],
      },
      {
        id: 'lecture-week-2',
        type: 'folder',
        name: 'Week 2',
        children: [
          { id: 'lecture-week-2-slides', type: 'file', name: 'storytelling-deck.pptx' },
          { id: 'lecture-week-2-notes', type: 'file', name: 'speaker-notes.txt' },
        ],
      },
    ],
  },
  {
    id: 'sections',
    type: 'folder',
    name: 'Sections',
    children: [
      {
        id: 'section-a',
        type: 'folder',
        name: 'Section A',
        children: [
          { id: 'section-a-outline', type: 'file', name: 'discussion-outline.docx' },
          { id: 'section-a-checklist', type: 'file', name: 'section-checklist.md' },
        ],
      },
      {
        id: 'section-b',
        type: 'folder',
        name: 'Section B',
        children: [
          { id: 'section-b-slides', type: 'file', name: 'practice-slides.pptx' },
        ],
      },
    ],
  },
];

export function findNodeById(nodes, id, parent = null, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];

    if (node.id === id) {
      return {
        node,
        parent,
        path: nextPath,
      };
    }

    if (node.children) {
      const result = findNodeById(node.children, id, node, nextPath);

      if (result) {
        return result;
      }
    }
  }

  return null;
}

export function countFiles(node) {
  if (!node.children) {
    return 1;
  }

  return node.children.reduce((total, child) => total + countFiles(child), 0);
}
