/**
 * api.js — thin XHR/fetch wrapper for the POS REST API.
 *
 * The base URL is auto-detected: if the frontend is served from the same
 * origin as the backend (via the nginx proxy) we use a relative path;
 * otherwise we fall back to localhost:8000 for local-file development.
 */

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? (window.location.port === '3000' ? '/api' : 'http://localhost:8000/api')
    : '/api';

/**
 * Low-level fetch wrapper. Returns parsed JSON or throws an Error with
 * the server message included.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  };
  const config = { ...defaults, ...options };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = JSON.stringify(err);
    } catch (_) {}
    throw new Error(message);
  }

  // 204 No Content
  if (response.status === 204) return null;
  return response.json();
}

// ── Categories ────────────────────────────────────────────────────────────────

const categoriesApi = {
  list: () => apiFetch('/categories/'),
};

// ── Products ──────────────────────────────────────────────────────────────────

const productsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products/${qs ? '?' + qs : ''}`);
  },
  create: (data) => apiFetch('/products/', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/products/${id}/`, { method: 'PUT', body: data }),
  patch: (id, data) => apiFetch(`/products/${id}/`, { method: 'PATCH', body: data }),
  destroy: (id) => apiFetch(`/products/${id}/`, { method: 'DELETE' }),
};

// ── Orders ────────────────────────────────────────────────────────────────────

const ordersApi = {
  list: () => apiFetch('/orders/'),
  create: (data) => apiFetch('/orders/', { method: 'POST', body: data }),
  complete: (id) => apiFetch(`/orders/${id}/complete/`, { method: 'POST' }),
  cancel: (id) => apiFetch(`/orders/${id}/cancel/`, { method: 'POST' }),
};
