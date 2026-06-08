const API_BASE_URL = import.meta.env.DEV ? import.meta.env.VITE_API_BASE_URL ?? '' : '';

async function requestJson(path, options = {}) {
  const response = await fetch(resolveApiUrl(path), {
    credentials: 'include',
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;

    try {
      const payload = await response.json();
      const raw = payload.detail;
      if (raw != null) {
        detail = typeof raw === 'string' ? raw : JSON.stringify(raw);
      }
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

export { API_BASE_URL, jsonRequestOptions, requestJson, resolveApiUrl };
