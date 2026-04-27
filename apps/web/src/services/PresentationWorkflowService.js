import { jsonRequestOptions, requestJson } from './apiClient';

async function getPresentationTree() {
  return requestJson('/api/presentations/tree');
}

async function createFolder({ parentId, name }) {
  return requestJson(
    '/api/presentations/folders',
    jsonRequestOptions('POST', {
      parent_id: parentId,
      name,
    })
  );
}

async function createFile({ parentId, name, sourceKind = 'manual', googlePresentationId }) {
  return requestJson(
    '/api/presentations/files',
    jsonRequestOptions('POST', {
      parent_id: parentId,
      name,
      source_kind: sourceKind,
      google_presentation_id: googlePresentationId,
    })
  );
}

async function deleteNode(nodeId) {
  return requestJson(`/api/presentations/nodes/${nodeId}`, {
    method: 'DELETE',
  });
}

export default {
  createFile,
  createFolder,
  deleteNode,
  getPresentationTree,
};
