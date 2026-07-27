/**
 * app.js — POS application logic.
 *
 * State:
 *   products   — array of Product objects from the API (current page)
 *   categories — array of Category objects from the API
 *   cart       — Map<productId, { product, quantity }>
 */

// ── State ─────────────────────────────────────────────────────────────────────

let products = []
let categories = []
const cart = new Map()

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    if (!authApi.isAuthenticated()) {
        showLoginOverlay()
        return
    }
    initApp()
})

function initApp() {
    const btn = document.getElementById("checkout-btn")
    btn.disabled = true
    document.getElementById("login-overlay").classList.add("hidden")
    document.getElementById("app").classList.remove("hidden")
    showPage("pos")
    loadCategories()
    loadProducts()

    const searchInput = document.getElementById("search-input")
    const paymentInput = document.getElementById("cart-payment")
    // Products are fetched once on load; filter/display client-side as the
    // cashier types a product name or scans/types a barcode.
    searchInput.addEventListener("input", renderProductGrid)
    searchInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return
        e.preventDefault()
        addFirstMatchToCart()
    })
    document.getElementById("category-filter").addEventListener("change", renderProductGrid)

    if (paymentInput) {
        paymentInput.addEventListener("input", renderCart)
    }
}

// ── Login ─────────────────────────────────────────────────────────────────────

function showLoginOverlay() {
    document.getElementById("login-overlay").classList.remove("hidden")
    document.getElementById("app").classList.add("hidden")
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const username = document.getElementById("login-username").value.trim()
    const loginBtn = document.getElementById("login-btn")
    const errorEl = document.getElementById("login-error")

    // Retrieve the value of the password field directly from the DOM
    const pwdField = document.getElementById("login-password")
    const loginPwd = pwdField ? pwdField.value : ""

    errorEl.textContent = ""
    loginBtn.disabled = true
    loginBtn.textContent = "Iniciando sesión…"

    try {
        await authApi.login(username, loginPwd)
        initApp()
    } catch (err) {
        errorEl.textContent = "Usuario o contraseña inválidos."
    } finally {
        loginBtn.disabled = false
        loginBtn.textContent = "Iniciar Sesión"
    }
})

function logout() {
    authApi.logout()
    cart.clear()
    showLoginOverlay()
}

// ── Page navigation ───────────────────────────────────────────────────────────

function showPage(name) {
    ;["pos", "orders", "products", "payables"].forEach((p) => {
        document.getElementById(`page-${p}`).classList.toggle("hidden", p !== name)
        const btn = document.getElementById(`nav-${p}`)
        btn.classList.toggle("bg-white", p === name)
        btn.classList.toggle("text-indigo-700", p === name)
        btn.classList.toggle("hover:bg-indigo-600", p !== name)
    })

    if (name === "orders") loadOrders()
    if (name === "products") loadProductsTable()
    if (name === "payables") loadPayablesTable()
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null
function showToast(msg, type = "success") {
    const el = document.getElementById("toast")
    el.textContent = msg
    el.className = `fixed bottom-5 right-5 z-50 text-sm px-5 py-3 rounded-xl shadow-lg transition-opacity duration-300 ${
        type === "error" ? "bg-red-600" : "bg-slate-800"
    } text-white`
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3000)
}

// ── Categories ────────────────────────────────────────────────────────────────

async function loadCategories() {
    try {
        const data = await categoriesApi.list()
        categories = data.results || data

        const filter = document.getElementById("category-filter")
        const formSel = document.getElementById("form-category")
        ;[filter, formSel].forEach((sel) => {
            while (sel.options.length > 1) sel.remove(1)
            categories.forEach((c) => {
                const opt = document.createElement("option")
                opt.value = c.id
                opt.textContent = c.name
                sel.appendChild(opt)
            })
        })
    } catch (e) {
        console.error("Failed to load categories", e)
    }
}

// ── Products (Cashier) ────────────────────────────────────────────────────────
// All active products are fetched once on load. The cashier then looks products
// up by typing a name or scanning/typing a barcode; nothing is shown until a
// search term or category is provided.

async function loadProducts() {
    try {
        products = await productsApi.listAll({ is_active: "true" })
        renderProductGrid()
    } catch (e) {
        showToast("No se pudieron cargar los productos. ¿Está el backend en ejecución?", "error")
    }
}

function getFilteredProducts() {
    const search = document.getElementById("search-input").value.trim().toLowerCase()
    const catId = document.getElementById("category-filter").value

    if (!search && !catId) return null // nothing entered yet — show the hint instead

    return products.filter((product) => {
        const matchesSearch =
            !search || product.name.toLowerCase().includes(search) || (product.barcode && product.barcode.toLowerCase().includes(search))
        const matchesCategory = !catId || String(product.category) === catId
        return matchesSearch && matchesCategory
    })
}

// If the search box holds an exact barcode match, or the current filter
// narrows results down to a single product, add it straight to the cart.
// Lets a cashier scan a barcode + Enter to add an item without clicking.
function addFirstMatchToCart() {
    const search = document.getElementById("search-input").value.trim().toLowerCase()
    if (!search) return

    const exactBarcodeMatch = products.find((p) => p.barcode && p.barcode.toLowerCase() === search)
    const filtered = getFilteredProducts() || []
    const match = exactBarcodeMatch || (filtered.length === 1 ? filtered[0] : null)

    if (!match) {
        showToast("Ningún producto coincide.", "error")
        return
    }

    addToCart(match)
    const searchInput = document.getElementById("search-input")
    searchInput.value = ""
    searchInput.focus()
    renderProductGrid()
}

function renderProductGrid() {
    const grid = document.getElementById("product-grid")
    const empty = document.getElementById("products-empty")
    const hint = document.getElementById("products-hint")

    const filtered = getFilteredProducts()

    if (filtered === null) {
        grid.innerHTML = ""
        empty.classList.add("hidden")
        hint.classList.remove("hidden")
        return
    }
    hint.classList.add("hidden")

    grid.innerHTML = ""
    if (filtered.length === 0) {
        empty.classList.remove("hidden")
        return
    }
    empty.classList.add("hidden")

    filtered.forEach((product) => {
        const card = document.createElement("button")
        card.className =
            "bg-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 text-left flex flex-col gap-2 border border-transparent hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        card.onclick = () => addToCart(product)

        const cartItem = cart.get(product.id)
        const inCart = cartItem ? cartItem.quantity : 0

        card.innerHTML = `
      <div class="flex items-start justify-between gap-1">
        <span class="font-medium text-slate-800 text-sm leading-tight">${escHtml(product.name)}</span>
        ${inCart > 0 ? `<span class="flex-shrink-0 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${inCart}</span>` : ""}
      </div>
      ${product.category_name ? `<span class="text-xs text-slate-400">${escHtml(product.category_name)}</span>` : ""}
      <div class="mt-auto flex items-center justify-between">
        <span class="text-indigo-600 font-bold text-sm">$${Number(product.price).toFixed(2)}</span>
        <span class="text-xs text-slate-400">Stock: ${product.stock}</span>
      </div>
    `
        grid.appendChild(card)
    })
}

// ── Cart ──────────────────────────────────────────────────────────────────────

function addToCart(product) {
    if (product.stock <= 0) {
        showToast("Este producto está agotado.", "error")
        return
    }
    const existing = cart.get(product.id)
    if (existing) {
        if (existing.quantity >= product.stock) {
            showToast("No se puede agregar más del stock disponible.", "error")
            return
        }
        existing.quantity += 1
    } else {
        cart.set(product.id, { product, quantity: 1 })
    }
    renderCart()
    renderProductGrid()
}

function removeFromCart(productId) {
    cart.delete(productId)
    renderCart()
    renderProductGrid()
}

function changeQty(productId, delta) {
    const item = cart.get(productId)
    if (!item) return
    item.quantity = Math.max(1, item.quantity + delta)
    if (delta > 0 && item.quantity > item.product.stock) {
        item.quantity = item.product.stock
        showToast("No se puede exceder el stock disponible.", "error")
    }
    renderCart()
    renderProductGrid()
}

function clearCart() {
    cart.clear()
    document.getElementById("order-note").value = ""
    document.getElementById("cart-payment").value = ""
    renderCart()
    renderProductGrid()
}

function getCartTotalPrice() {
    let totalPrice = 0
    cart.forEach((item) => {
        totalPrice += item.quantity * Number(item.product.price)
    })
    return totalPrice
}

function getPaymentAndChange(totalPrice) {
    const paymentInput = document.getElementById("cart-payment")
    const paid = Number(paymentInput.value)

    if (paymentInput.value === "" || Number.isNaN(paid) || paid < totalPrice) return { paid: 0, change: 0, hasValidPayment: false }

    return {
        paid,
        change: paid - totalPrice,
        hasValidPayment: true,
    }
}

function renderCart() {
    const container = document.getElementById("cart-items")
    const emptyMsg = document.getElementById("cart-empty")
    const countEl = document.getElementById("cart-count")
    const totalEl = document.getElementById("cart-total")
    const changeEl = document.getElementById("cart-change")
    const btn = document.getElementById("checkout-btn")

    if (cart.size === 0) {
        container.innerHTML = ""
        container.appendChild(emptyMsg)
        emptyMsg.classList.remove("hidden")
        countEl.textContent = "0"
        totalEl.textContent = "$0.00"
        changeEl.textContent = "Cambio: $0.00"
        changeEl.classList.remove("text-red-600")
        changeEl.classList.add("text-slate-500")
        btn.disabled = true
        return
    }

    emptyMsg.classList.add("hidden")
    btn.disabled = false

    let totalQty = 0
    const fragment = document.createDocumentFragment()

    cart.forEach((item, id) => {
        const subtotal = item.quantity * Number(item.product.price)
        totalQty += item.quantity

        const row = document.createElement("div")
        row.className = "flex items-center gap-2"
        row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-700 truncate">${escHtml(item.product.name)}</p>
        <p class="text-xs text-slate-400">$${Number(item.product.price).toFixed(2)} por unidad</p>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="changeQty(${id}, -1)"
          class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-base leading-none">−</button>
        <span class="w-6 text-center text-sm font-semibold">${item.quantity}</span>
        <button onclick="changeQty(${id}, 1)"
          class="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-base leading-none">+</button>
      </div>
      <span class="w-16 text-right text-sm font-semibold text-slate-700">$${subtotal.toFixed(2)}</span>
      <button onclick="removeFromCart(${id})" class="text-red-400 hover:text-red-600 ml-1" title="Remove">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `
        fragment.appendChild(row)
    })

    container.innerHTML = ""
    container.appendChild(emptyMsg)
    container.appendChild(fragment)

    const totalPrice = getCartTotalPrice()
    const { change, hasValidPayment } = getPaymentAndChange(totalPrice)

    countEl.textContent = totalQty
    totalEl.textContent = `$${totalPrice.toFixed(2)}`

    changeEl.textContent = `Cambio: $${change.toFixed(2)}`
    if (change < 0 || !hasValidPayment) {
        changeEl.classList.remove("text-slate-500")
        changeEl.classList.add("text-red-600")
    } else {
        changeEl.classList.remove("text-red-600")
        changeEl.classList.add("text-slate-500")
    }

    btn.disabled = !hasValidPayment || change < 0
}

// ── Checkout ──────────────────────────────────────────────────────────────────

async function checkout() {
    if (cart.size === 0) return

    const totalPrice = getCartTotalPrice()
    const { paid, change, hasValidPayment } = getPaymentAndChange(totalPrice)
    if (!hasValidPayment || change < 0) {
        showToast("El pago ingresado no cubre el total de la venta.", "error")
        return
    }

    const btn = document.getElementById("checkout-btn")
    btn.disabled = true
    btn.textContent = "Realizando cobro…"

    const items = []
    cart.forEach((item) => {
        items.push({ product: item.product.id, quantity: item.quantity })
    })

    const payload = {
        items,
        note: document.getElementById("order-note").value.trim(),
    }

    try {
        const order = await ordersApi.create(payload)
        showToast(`Venta #${order.id} realizada — Cambio: $${change.toFixed(2)}`)
        clearCart()
        // Reload products so stock counts reflect the order
        loadProducts()
    } catch (e) {
        showToast(`Error al realizar la venta: ${e.message}`, "error")
    } finally {
        btn.textContent = "Cobrar"
        const searchInput = document.getElementById("search-input")
        searchInput.value = ""
    }
}

// ── Orders page ───────────────────────────────────────────────────────────────

async function loadOrders() {
    const tbody = document.getElementById("orders-table-body")
    const empty = document.getElementById("orders-empty")
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Cargando…</td></tr>'
    empty.classList.add("hidden")

    try {
        const data = await ordersApi.list()
        const orders = data.results || data

        tbody.innerHTML = ""
        if (orders.length === 0) {
            empty.classList.remove("hidden")
            return
        }

        orders.forEach((order) => {
            const tr = document.createElement("tr")
            tr.className = "hover:bg-slate-50"
            const statusColor =
                {
                    pending: "bg-yellow-100 text-yellow-700",
                    completed: "bg-green-100 text-green-700",
                    cancelled: "bg-red-100 text-red-600",
                }[order.status] || "bg-slate-100 text-slate-600"

            // Display label only — order.status itself stays in English for backend logic
            const statusLabel =
                {
                    pending: "Pendiente",
                    completed: "Completado",
                    cancelled: "Cancelado",
                }[order.status] || order.status

            const itemsSummary = order.items.map((i) => `${i.quantity}× ${escHtml(i.product_name)}`).join("<br>")

            tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-700">#${order.id}</td>
        <td class="px-4 py-3 text-slate-500">${new Date(order.created_at).toLocaleString()}</td>
        <td class="px-4 py-3 text-slate-600 max-w-xs truncate">${itemsSummary || "—"}</td>
        <td class="px-4 py-3 text-right font-semibold text-slate-700">$${Number(order.total).toFixed(2)}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}">
            ${statusLabel}
          </span>
        </td>
        <td class="px-4 py-3 text-center space-x-2">
          ${
              order.status === "pending"
                  ? `
            <button onclick="completeOrder(${order.id})"
              class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition">Completar</button>
            <button onclick="cancelOrder(${order.id})"
              class="text-xs bg-red-400 hover:bg-red-500 text-white px-2 py-1 rounded transition">Cancelar</button>
          `
                  : "—"
          }
        </td>
      `
            tbody.appendChild(tr)
        })
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${e.message}</td></tr>`
    }
}

async function completeOrder(id) {
    try {
        await ordersApi.complete(id)
        showToast(`Venta #${id} marcada como completada.`)
        loadOrders()
    } catch (e) {
        showToast(e.message, "error")
    }
}

async function cancelOrder(id) {
    if (!confirm(`¿Cancelar la venta #${id}?`)) return
    try {
        await ordersApi.cancel(id)
        showToast(`Venta #${id} cancelada.`)
        loadOrders()
    } catch (e) {
        showToast(e.message, "error")
    }
}

// ── Products management page ──────────────────────────────────────────────────

async function loadProductsTable() {
    const tbody = document.getElementById("products-table-body")
    const empty = document.getElementById("products-table-empty")
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Cargando…</td></tr>'

    try {
        // Fetch all products (active and inactive) for the management view
        const prods = await productsApi.listAll()

        tbody.innerHTML = ""
        if (prods.length === 0) {
            empty.classList.remove("hidden")
            return
        }
        empty.classList.add("hidden")

        prods.forEach((p) => {
            const tr = document.createElement("tr")
            tr.className = "hover:bg-slate-50"
            tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-700">${escHtml(p.name)}</td>
        <td class="px-4 py-3 text-slate-500">${p.barcode ? escHtml(p.barcode) : "—"}</td>
        <td class="px-4 py-3 text-slate-500">${p.category_name ? escHtml(p.category_name) : "—"}</td>
        <td class="px-4 py-3 text-right font-semibold">$${Number(p.price).toFixed(2)}</td>
        <td class="px-4 py-3 text-right">${p.stock}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block w-3 h-3 rounded-full ${p.is_active ? "bg-green-400" : "bg-slate-300"}"></span>
        </td>
        <td class="px-4 py-3 text-center space-x-2">
          <button onclick="openProductModal(${p.id})"
            class="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded transition">Editar</button>
          <button onclick="deleteProduct(${p.id})"
            class="text-xs bg-red-400 hover:bg-red-500 text-white px-2 py-1 rounded transition">Eliminar</button>
        </td>
      `
            tbody.appendChild(tr)
        })
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${e.message}</td></tr>`
    }
}

async function openProductModal(productId) {
    document.getElementById("product-modal").classList.remove("hidden")
    document.getElementById("modal-title").textContent = productId ? "Editar Producto" : "Nuevo Producto"
    document.getElementById("product-id").value = productId || ""

    if (productId) {
        try {
            // Fetch from API to get the latest data including inactive products
            const p = await productsApi.get(productId)
            document.getElementById("form-name").value = p.name
            document.getElementById("form-barcode").value = p.barcode || ""
            document.getElementById("form-category").value = p.category || ""
            document.getElementById("form-price").value = p.price
            document.getElementById("form-stock").value = p.stock
            document.getElementById("form-description").value = p.description || ""
            document.getElementById("form-active").checked = p.is_active
        } catch (e) {
            showToast("No se pudieron cargar los detalles del producto.", "error")
            closeProductModal()
        }
    } else {
        document.getElementById("product-form").reset()
    }
}

function closeProductModal() {
    document.getElementById("product-modal").classList.add("hidden")
}

async function submitProductForm(e) {
    e.preventDefault()
    const id = document.getElementById("product-id").value
    const payload = {
        name: document.getElementById("form-name").value.trim(),
        barcode: document.getElementById("form-barcode").value.trim() || null,
        category: document.getElementById("form-category").value || null,
        price: document.getElementById("form-price").value,
        stock: document.getElementById("form-stock").value,
        description: document.getElementById("form-description").value.trim(),
        is_active: document.getElementById("form-active").checked,
    }

    try {
        if (id) {
            await productsApi.update(id, payload)
            showToast("Producto actualizado.")
        } else {
            await productsApi.create(payload)
            showToast("Producto creado.")
        }
        closeProductModal()
        await loadProducts()
        loadProductsTable()
    } catch (e) {
        showToast(`Error: ${e.message}`, "error")
    }
}

async function deleteProduct(id) {
    if (!confirm("¿Eliminar este producto?")) return
    try {
        await productsApi.destroy(id)
        showToast("Producto eliminado.")
        await loadProducts()
        loadProductsTable()
    } catch (e) {
        showToast(`Error: ${e.message}`, "error")
    }
}

// ── Accounts payable page ─────────────────────────────────────────────────────

async function loadPayablesTable() {
    const tbody = document.getElementById("payables-table-body")
    const empty = document.getElementById("payables-table-empty")
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400">Cargando…</td></tr>'
    empty.classList.add("hidden")

    try {
        const data = await payablesApi.list()
        const payables = data.results || data

        tbody.innerHTML = ""
        if (payables.length === 0) {
            empty.classList.remove("hidden")
            return
        }

        payables.forEach((payable) => {
            const tr = document.createElement("tr")
            tr.className = "hover:bg-slate-50"
            tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-700">${escHtml(payable.name)}</td>
        <td class="px-4 py-3 text-right font-semibold">$${Number(payable.amount).toFixed(2)}</td>
        <td class="px-4 py-3 text-slate-500">${payable.due_date}</td>
        <td class="px-4 py-3 text-center space-x-2">
          <button onclick="openPayableModal(${payable.id})"
            class="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded transition">Editar</button>
          <button onclick="deletePayable(${payable.id})"
            class="text-xs bg-red-400 hover:bg-red-500 text-white px-2 py-1 rounded transition">Eliminar</button>
        </td>
      `
            tbody.appendChild(tr)
        })
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">${e.message}</td></tr>`
    }
}

async function openPayableModal(payableId) {
    document.getElementById("payable-modal").classList.remove("hidden")
    document.getElementById("payable-modal-title").textContent = payableId ? "Editar Cuenta por Pagar" : "Nueva Cuenta por Pagar"
    document.getElementById("payable-id").value = payableId || ""

    if (payableId) {
        try {
            const p = await payablesApi.get(payableId)
            document.getElementById("payable-name").value = p.name
            document.getElementById("payable-amount").value = p.amount
            document.getElementById("payable-due-date").value = p.due_date
        } catch (e) {
            showToast("No se pudieron cargar los detalles de la cuenta.", "error")
            closePayableModal()
        }
    } else {
        document.getElementById("payable-form").reset()
    }
}

function closePayableModal() {
    document.getElementById("payable-modal").classList.add("hidden")
}

async function submitPayableForm(e) {
    e.preventDefault()
    const id = document.getElementById("payable-id").value
    const payload = {
        name: document.getElementById("payable-name").value.trim(),
        amount: document.getElementById("payable-amount").value,
        due_date: document.getElementById("payable-due-date").value,
    }

    try {
        if (id) {
            await payablesApi.update(id, payload)
            showToast("Cuenta por pagar actualizada.")
        } else {
            await payablesApi.create(payload)
            showToast("Cuenta por pagar creada.")
        }
        closePayableModal()
        loadPayablesTable()
    } catch (e) {
        showToast(`Error: ${e.message}`, "error")
    }
}

async function deletePayable(id) {
    if (!confirm("¿Eliminar esta cuenta por pagar?")) return
    try {
        await payablesApi.destroy(id)
        showToast("Cuenta por pagar eliminada.")
        loadPayablesTable()
    } catch (e) {
        showToast(`Error: ${e.message}`, "error")
    }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
