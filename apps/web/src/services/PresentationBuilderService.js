import { requestJson } from './apiClient';

async function getSlideDeckBuild(deckId) {
  return requestJson(`/api/presentations/${deckId}/builder-schema`);
}

export default {
  getSlideDeckBuild,
};
