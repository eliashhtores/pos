/**
 * api.js — thin fetch wrapper for the POS REST API.
 *
 * Authentication: DRF Token auth.  The token is stored in localStorage under
 * the key "pos_token" and sent as an "Authorization: Token <token>" header on
 * every request.  Call authApi.login() to obtain a token; authApi.logout() to
 * clear it.
 *
 * Base URL auto-detection:
 *   - port 3000 (nginx proxy) → relative /api
 *   - other localhost port    → http://localhost:8000/api
 *   - any other origin        → relative /api
 */

const API_BASE =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? window.location.port === "3000"
            ? "/api"
            : "http://localhost:8000/api"
        : "/api"

const TOKEN_KEY = "pos_token"

function getToken() {
    return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token)
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY)
}

/**
 * Low-level fetch wrapper. Returns parsed JSON or throws an Error with the
 * server message included.  Automatically attaches the auth token when present.
 */
async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`
    const headers = { "Content-Type": "application/json", Accept: "application/json" }
    const token = getToken()
    if (token) headers["Authorization"] = `Token ${token}`

    const config = { ...options, headers: { ...headers, ...(options.headers || {}) } }
    if (config.body && typeof config.body === "object") {
        config.body = JSON.stringify(config.body)
    }

    const response = await fetch(url, config)

    if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
            const err = await response.json()
            message = JSON.stringify(err)
        } catch (_) {}
        throw new Error(message)
    }

    if (response.status === 204) return null
    return response.json()
}

// ── Authentication ────────────────────────────────────────────────────────────

const authApi = {
    login: async (username, password) => {
        const response = await fetch(`${API_BASE}/auth/login/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        })
        if (!response.ok) {
            let msg = "Invalid credentials"
            try {
                const err = await response.json()
                msg = JSON.stringify(err)
            } catch (_) {}
            throw new Error(msg)
        }
        const data = await response.json()
        setToken(data.token)
        return data
    },
    logout: () => {
        clearToken()
    },
    isAuthenticated: () => Boolean(getToken()),
}

// ── Categories ────────────────────────────────────────────────────────────────

const categoriesApi = {
    list: () => apiFetch("/categories/"),
}

// ── Products ──────────────────────────────────────────────────────────────────

const productsApi = {
    list: (params = {}) => {
        const qs = new URLSearchParams(params).toString()
        return apiFetch(`/products/${qs ? "?" + qs : ""}`)
    },
    // Fetches every page of results and returns a single flat array. Used by
    // the cashier screen, which needs the full catalog in memory to filter by
    // name/barcode as the user types.
    listAll: async (params = {}) => {
        let results = []
        let page = 1
        for (;;) {
            const data = await productsApi.list({ ...params, page })
            if (Array.isArray(data)) return results.concat(data)
            results = results.concat(data.results || [])
            if (!data.next) break
            page += 1
        }
        return results
    },
    get: (id) => apiFetch(`/products/${id}/`),
    create: (data) => apiFetch("/products/", { method: "POST", body: data }),
    update: (id, data) => apiFetch(`/products/${id}/`, { method: "PUT", body: data }),
    patch: (id, data) => apiFetch(`/products/${id}/`, { method: "PATCH", body: data }),
    destroy: (id) => apiFetch(`/products/${id}/`, { method: "DELETE" }),
}

// ── Orders ────────────────────────────────────────────────────────────────────

const ordersApi = {
    list: () => apiFetch("/orders/"),
    create: (data) => apiFetch("/orders/", { method: "POST", body: data }),
    complete: (id) => apiFetch(`/orders/${id}/complete/`, { method: "POST" }),
    cancel: (id) => apiFetch(`/orders/${id}/cancel/`, { method: "POST" }),
}

// ── Accounts Payable ──────────────────────────────────────────────────────────

const payablesApi = {
    list: () => apiFetch("/payables/"),
    get: (id) => apiFetch(`/payables/${id}/`),
    create: (data) => apiFetch("/payables/", { method: "POST", body: data }),
    update: (id, data) => apiFetch(`/payables/${id}/`, { method: "PUT", body: data }),
    destroy: (id) => apiFetch(`/payables/${id}/`, { method: "DELETE" }),
}
