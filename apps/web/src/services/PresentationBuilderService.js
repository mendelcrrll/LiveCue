import { jsonRequestOptions, requestJson } from './apiClient';

async function getSlideDeckBuild(deckId) {
  return requestJson(`/api/presentations/${deckId}/builder-schema`);
}

async function updateSlideBuildData(deckId, slideId, buildData) {
  return requestJson(
    `/api/presentations/${deckId}/builder-schema/slides/${slideId}`,
    jsonRequestOptions('PUT', { buildData })
  );
}

export default {
  getSlideDeckBuild,
  updateSlideBuildData,
};
