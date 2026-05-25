import { API_BASE_URL } from './apiClient';

async function transcribeAudio(audioBlob, filename = 'recording.webm') {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);

  const response = await fetch(`${API_BASE_URL}/api/transcription/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // The transcription endpoint should return JSON errors, but keep a safe fallback.
    }

    throw new Error(detail);
  }

  return response.json();
}

async function transcribeAudioChunk({
  audioBlob,
  filename = 'recording.webm',
  presentationId,
  slideId,
  chunkStartedAtMs,
  chunkEndedAtMs,
}) {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('presentation_id', presentationId);
  formData.append('slide_id', slideId);
  formData.append('chunk_started_at_ms', String(chunkStartedAtMs));
  formData.append('chunk_ended_at_ms', String(chunkEndedAtMs));

  const response = await fetch(`${API_BASE_URL}/api/transcription/chunks`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // The transcription endpoint should return JSON errors, but keep a safe fallback.
    }

    throw new Error(detail);
  }

  return response.json();
}

async function deletePresentationTranscriptChunks(presentationId, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/transcription/presentations/${presentationId}/chunks`,
    {
      method: 'DELETE',
      keepalive: Boolean(options.keepalive),
    }
  );

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // The transcription endpoint should return JSON errors, but keep a safe fallback.
    }

    throw new Error(detail);
  }

  return response.json();
}

async function getPresentationCadence(presentationId) {
  const response = await fetch(
    `${API_BASE_URL}/api/transcription/presentations/${presentationId}/cadence`
  );

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // The transcription endpoint should return JSON errors, but keep a safe fallback.
    }

    throw new Error(detail);
  }

  return response.json();
}

async function getPresentationTiming(presentationId) {
  const response = await fetch(
    `${API_BASE_URL}/api/transcription/presentations/${presentationId}/timing`
  );

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // The transcription endpoint should return JSON errors, but keep a safe fallback.
    }

    throw new Error(detail);
  }

  return response.json();
}

export default {
  deletePresentationTranscriptChunks,
  getPresentationCadence,
  getPresentationTiming,
  transcribeAudio,
  transcribeAudioChunk,
};
