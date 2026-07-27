/**
 * app.js — POS application logic.
 *
 * State:
 *   products   — array of Product objects from the API (current page)
 *   categories — array of Category objects from the API
 *   cart       — Map<productId, { product, quantity }>
 */

// ── State ─────────────────────────────────────────────────────────────────────

let products = [];
let categories = [];
const cart = new Map();
let searchDebounce = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (!authApi.isAuthenticated()) {
    showLoginOverlay();
    return;
  }
  initApp();
});

function initApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  showPage('pos');
  loadCategories();
  loadProducts();

  // Use backend search/filter instead of client-side filtering
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadProducts, 300);
  });
  document.getElementById('category-filter').addEventListener('change', loadProducts);
}

// ── Login ─────────────────────────────────────────────────────────────────────

function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  // Retrieve the value of the password field directly from the DOM
  const pwdField = document.getElementById('login-password');
  const loginPwd = pwdField ? pwdField.value : '';

  errorEl.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  try {
    await authApi.login(username, loginPwd);
    initApp();
  } catch (err) {
    errorEl.textContent = 'Invalid username or password.';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

function logout() {
  authApi.logout();
  cart.clear();
  showLoginOverlay();
}

// ── Page navigation ───────────────────────────────────────────────────────────

function showPage(name) {
  ['pos', 'orders', 'products'].forEach((p) => {
    document.getElementById(`page-${p}`).classList.toggle('hidden', p !== name);
    const btn = document.getElementById(`nav-${p}`);
    btn.classList.toggle('bg-white', p === name);
    btn.classList.toggle('text-indigo-700', p === name);
    btn.classList.toggle('hover:bg-indigo-600', p !== name);
  });

  if (name === 'orders') loadOrders();
  if (name === 'products') loadProductsTable();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `fixed bottom-5 right-5 z-50 text-sm px-5 py-3 rounded-xl shadow-lg transition-opacity duration-300 ${
    type === 'error' ? 'bg-red-600' : 'bg-slate-800'
  } text-white`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Categories ────────────────────────────────────────────────────────────────

async function loadCategories() {
  try {
    const data = await categoriesApi.list();
    categories = data.results || data;

    const filter = document.getElementById('category-filter');
    const formSel = document.getElementById('form-category');
    [filter, formSel].forEach((sel) => {
      while (sel.options.length > 1) sel.remove(1);
      categories.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    });
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

// ── Products (Cashier) ────────────────────────────────────────────────────────
// Search and category filtering are delegated to the backend via query params.

async function loadProducts() {
  const params = { is_active: 'true' };
  const search = document.getElementById('search-input').value.trim();
  const catId = document.getElementById('category-filter').value;
  if (search) params.search = search;
  if (catId) params.category = catId;

  try {
    const data = await productsApi.list(params);
    products = data.results || data;
    renderProductGrid();
  } catch (e) {
    showToast('Could not load products. Is the backend running?', 'error');
  }
}

function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  const empty = document.getElementById('products-empty');

  grid.innerHTML = '';
  if (products.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  products.forEach((product) => {
    const card = document.createElement('button');
    card.className =
      'bg-white rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4 text-left flex flex-col gap-2 border border-transparent hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400';
    card.onclick = () => addToCart(product);

    const cartItem = cart.get(product.id);
    const inCart = cartItem ? cartItem.quantity : 0;

    card.innerHTML = `
      <div class="flex items-start justify-between gap-1">
        <span class="font-medium text-slate-800 text-sm leading-tight">${escHtml(product.name)}</span>
        ${inCart > 0 ? `<span class="flex-shrink-0 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">${inCart}</span>` : ''}
      </div>
      ${product.category_name ? `<span class="text-xs text-slate-400">${escHtml(product.category_name)}</span>` : ''}
      <div class="mt-auto flex items-center justify-between">
        <span class="text-indigo-600 font-bold text-sm">$${Number(product.price).toFixed(2)}</span>
        <span class="text-xs text-slate-400">Stock: ${product.stock}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── Cart ──────────────────────────────────────────────────────────────────────

function addToCart(product) {
  if (product.stock <= 0) {
    showToast('This product is out of stock.', 'error');
    return;
  }
  const existing = cart.get(product.id);
  if (existing) {
    if (existing.quantity >= product.stock) {
      showToast('Cannot add more than available stock.', 'error');
      return;
    }
    existing.quantity += 1;
  } else {
    cart.set(product.id, { product, quantity: 1 });
  }
  renderCart();
  renderProductGrid();
}

function removeFromCart(productId) {
  cart.delete(productId);
  renderCart();
  renderProductGrid();
}

function changeQty(productId, delta) {
  const item = cart.get(productId);
  if (!item) return;
  item.quantity = Math.max(1, item.quantity + delta);
  if (delta > 0 && item.quantity > item.product.stock) {
    item.quantity = item.product.stock;
    showToast('Cannot exceed available stock.', 'error');
  }
  renderCart();
  renderProductGrid();
}

function clearCart() {
  cart.clear();
  document.getElementById('order-note').value = '';
  renderCart();
  renderProductGrid();
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const emptyMsg = document.getElementById('cart-empty');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  const btn = document.getElementById('checkout-btn');

  if (cart.size === 0) {
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    emptyMsg.classList.remove('hidden');
    countEl.textContent = '0';
    totalEl.textContent = '$0.00';
    btn.disabled = true;
    return;
  }

  emptyMsg.classList.add('hidden');
  btn.disabled = false;

  let totalQty = 0;
  let totalPrice = 0;
  const fragment = document.createDocumentFragment();

  cart.forEach((item, id) => {
    const subtotal = item.quantity * Number(item.product.price);
    totalQty += item.quantity;
    totalPrice += subtotal;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-700 truncate">${escHtml(item.product.name)}</p>
        <p class="text-xs text-slate-400">$${Number(item.product.price).toFixed(2)} each</p>
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
    `;
    fragment.appendChild(row);
  });

  container.innerHTML = '';
  container.appendChild(emptyMsg);
  container.appendChild(fragment);

  countEl.textContent = totalQty;
  totalEl.textContent = `$${totalPrice.toFixed(2)}`;
}

// ── Checkout ──────────────────────────────────────────────────────────────────

async function checkout() {
  if (cart.size === 0) return;

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Placing order…';

  const items = [];
  cart.forEach((item) => {
    items.push({ product: item.product.id, quantity: item.quantity });
  });

  const payload = {
    items,
    note: document.getElementById('order-note').value.trim(),
  };

  try {
    const order = await ordersApi.create(payload);
    showToast(`Order #${order.id} placed — $${Number(order.total).toFixed(2)}`);
    clearCart();
    // Reload products so stock counts reflect the order
    loadProducts();
  } catch (e) {
    showToast(`Order failed: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
}

// ── Orders page ───────────────────────────────────────────────────────────────

async function loadOrders() {
  const tbody = document.getElementById('orders-table-body');
  const empty = document.getElementById('orders-empty');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading…</td></tr>';
  empty.classList.add('hidden');

  try {
    const data = await ordersApi.list();
    const orders = data.results || data;

    tbody.innerHTML = '';
    if (orders.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    orders.forEach((order) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      const statusColor = {
        pending: 'bg-yellow-100 text-yellow-700',
        completed: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-600',
      }[order.status] || 'bg-slate-100 text-slate-600';

      const itemsSummary = order.items
        .slice(0, 2)
        .map((i) => `${i.quantity}× ${escHtml(i.product_name)}`)
        .join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2} more` : '');

      tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-700">#${order.id}</td>
        <td class="px-4 py-3 text-slate-500">${new Date(order.created_at).toLocaleString()}</td>
        <td class="px-4 py-3 text-slate-600 max-w-xs truncate">${itemsSummary || '—'}</td>
        <td class="px-4 py-3 text-right font-semibold text-slate-700">$${Number(order.total).toFixed(2)}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}">
            ${order.status}
          </span>
        </td>
        <td class="px-4 py-3 text-center space-x-2">
          ${order.status === 'pending' ? `
            <button onclick="completeOrder(${order.id})"
              class="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded transition">Complete</button>
            <button onclick="cancelOrder(${order.id})"
              class="text-xs bg-red-400 hover:bg-red-500 text-white px-2 py-1 rounded transition">Cancel</button>
          ` : '—'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${e.message}</td></tr>`;
  }
}

async function completeOrder(id) {
  try {
    await ordersApi.complete(id);
    showToast(`Order #${id} marked as completed.`);
    loadOrders();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function cancelOrder(id) {
  if (!confirm(`Cancel order #${id}?`)) return;
  try {
    await ordersApi.cancel(id);
    showToast(`Order #${id} cancelled.`);
    loadOrders();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ── Products management page ──────────────────────────────────────────────────

async function loadProductsTable() {
  const tbody = document.getElementById('products-table-body');
  const empty = document.getElementById('products-table-empty');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading…</td></tr>';

  try {
    // Fetch all products (active and inactive) for the management view
    const data = await productsApi.list();
    const prods = data.results || data;

    tbody.innerHTML = '';
    if (prods.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    prods.forEach((p) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50';
      tr.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-700">${escHtml(p.name)}</td>
        <td class="px-4 py-3 text-slate-500">${p.category_name ? escHtml(p.category_name) : '—'}</td>
        <td class="px-4 py-3 text-right font-semibold">$${Number(p.price).toFixed(2)}</td>
        <td class="px-4 py-3 text-right">${p.stock}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-block w-3 h-3 rounded-full ${p.is_active ? 'bg-green-400' : 'bg-slate-300'}"></span>
        </td>
        <td class="px-4 py-3 text-center space-x-2">
          <button onclick="openProductModal(${p.id})"
            class="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded transition">Edit</button>
          <button onclick="deleteProduct(${p.id})"
            class="text-xs bg-red-400 hover:bg-red-500 text-white px-2 py-1 rounded transition">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-red-500">${e.message}</td></tr>`;
  }
}

async function openProductModal(productId) {
  document.getElementById('product-modal').classList.remove('hidden');
  document.getElementById('modal-title').textContent = productId ? 'Edit Product' : 'New Product';
  document.getElementById('product-id').value = productId || '';

  if (productId) {
    try {
      // Fetch from API to get the latest data including inactive products
      const p = await productsApi.get(productId);
      document.getElementById('form-name').value = p.name;
      document.getElementById('form-category').value = p.category || '';
      document.getElementById('form-price').value = p.price;
      document.getElementById('form-stock').value = p.stock;
      document.getElementById('form-description').value = p.description || '';
      document.getElementById('form-active').checked = p.is_active;
    } catch (e) {
      showToast('Could not load product details.', 'error');
      closeProductModal();
    }
  } else {
    document.getElementById('product-form').reset();
  }
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

async function submitProductForm(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const payload = {
    name: document.getElementById('form-name').value.trim(),
    category: document.getElementById('form-category').value || null,
    price: document.getElementById('form-price').value,
    stock: document.getElementById('form-stock').value,
    description: document.getElementById('form-description').value.trim(),
    is_active: document.getElementById('form-active').checked,
  };

  try {
    if (id) {
      await productsApi.update(id, payload);
      showToast('Product updated.');
    } else {
      await productsApi.create(payload);
      showToast('Product created.');
    }
    closeProductModal();
    await loadProducts();
    loadProductsTable();
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await productsApi.destroy(id);
    showToast('Product deleted.');
    await loadProducts();
    loadProductsTable();
  } catch (e) {
    showToast(`Error: ${e.message}`, 'error');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
