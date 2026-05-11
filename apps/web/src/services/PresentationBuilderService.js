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

async function generateFeedbackDecision(deckId, slideId, { buildData, windowSize = 12, model } = {}) {
  return requestJson(
    `/api/presentations/${deckId}/slides/${slideId}/feedback-decision`,
    jsonRequestOptions('POST', { buildData, windowSize, model })
  );
}

export default {
  generateFeedbackDecision,
  getSlideDeckBuild,
  updateSlideBuildData,
};
