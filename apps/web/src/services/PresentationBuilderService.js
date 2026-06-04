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

async function updateSlideNotes(deckId, slideId, speakerNotes) {
  return requestJson(
    `/api/presentations/${deckId}/builder-schema/slides/${slideId}/notes`,
    jsonRequestOptions('PUT', { speakerNotes })
  );
}

async function updateSlideDemoTranscript(deckId, slideId, demoTranscript, { source = 'manual' } = {}) {
  return requestJson(
    `/api/presentations/${deckId}/builder-schema/slides/${slideId}/demo-transcript`,
    jsonRequestOptions('PUT', { demoTranscript, source })
  );
}

async function generateFeedbackDecision(deckId, slideId, { buildData, windowSize = 12, model } = {}) {
  return requestJson(
    `/api/presentations/${deckId}/slides/${slideId}/feedback-decision`,
    jsonRequestOptions('POST', { buildData, windowSize, model })
  );
}

async function resetGoalProgress(deckId) {
  return requestJson(
    `/api/presentations/${deckId}/reset-goal-progress`,
    jsonRequestOptions('POST', {})
  );
}

async function generateSlideBuildData(deckId, slideId, { speakerNotes, demoTranscript, model } = {}) {
  return requestJson(
    `/api/presentations/${deckId}/builder-schema/slides/${slideId}/generate`,
    jsonRequestOptions('POST', { speakerNotes, demoTranscript, model })
  );
}

async function refreshGoogleContext(deckId) {
  return requestJson(
    `/api/presentations/${deckId}/refresh-google-context`,
    jsonRequestOptions('POST', {})
  );
}

export default {
  generateFeedbackDecision,
  generateSlideBuildData,
  getSlideDeckBuild,
  refreshGoogleContext,
  resetGoalProgress,
  updateSlideBuildData,
  updateSlideDemoTranscript,
  updateSlideNotes,
};
