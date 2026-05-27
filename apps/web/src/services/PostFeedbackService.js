import { jsonRequestOptions, requestJson } from './apiClient';

async function getPostFeedback(deckId) {
  return requestJson(`/api/presentations/${deckId}/post-feedback`);
}

async function createVignette(deckId, { title = '', prompt = '' }) {
  return requestJson(
    `/api/presentations/${deckId}/audience-vignettes`,
    jsonRequestOptions('POST', { title, prompt })
  );
}

async function updateVignette(deckId, vignetteId, { title = '', prompt = '' }) {
  return requestJson(
    `/api/presentations/${deckId}/audience-vignettes/${vignetteId}`,
    jsonRequestOptions('PUT', { title, prompt })
  );
}

async function deleteVignette(deckId, vignetteId) {
  return requestJson(`/api/presentations/${deckId}/audience-vignettes/${vignetteId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

async function generatePostFeedback(deckId, { model } = {}) {
  return requestJson(
    `/api/presentations/${deckId}/post-feedback/generate`,
    jsonRequestOptions('POST', { model })
  );
}

export default {
  createVignette,
  deleteVignette,
  generatePostFeedback,
  getPostFeedback,
  updateVignette,
};
