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

async function previewGoogleSlidesDeck(googlePresentationId) {
  return requestJson(
    '/api/presentations/google-slides-preview',
    jsonRequestOptions('POST', {
      presentation_id: googlePresentationId,
    })
  );
}

async function deleteNode(nodeId) {
  return requestJson(`/api/presentations/nodes/${nodeId}`, {
    method: 'DELETE',
  });
}

async function refreshSlideThumbnail(presentationId, slideId) {
  return requestJson(`/api/presentations/${presentationId}/slides/${slideId}/thumbnail`);
}

export default {
  createFile,
  createFolder,
  deleteNode,
  getPresentationTree,
  previewGoogleSlidesDeck,
  refreshSlideThumbnail,
};
