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
