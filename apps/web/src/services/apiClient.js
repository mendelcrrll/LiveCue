const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function requestJson(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      detail = payload.detail ?? detail;
    } catch {
      // Some endpoints return no JSON body on error.
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function resolveApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return path.startsWith('/api') ? `${API_BASE_URL}${path}` : path;
}

function jsonRequestOptions(method, body) {
  return {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

export { API_BASE_URL, jsonRequestOptions, requestJson };
