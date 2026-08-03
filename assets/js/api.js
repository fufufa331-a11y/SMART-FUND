/* ============================================
   SMART FUND - API Helper & Utilities
   ============================================ */

const API_BASE = '/api';

// ============================================
// TOKEN MANAGEMENT
// ============================================
const Token = {
  get() {
    return localStorage.getItem('sf_token') || sessionStorage.getItem('sf_token');
  },
  set(token, remember = false) {
    if (remember) localStorage.setItem('sf_token', token);
    else sessionStorage.setItem('sf_token', token);
  },
  clear() {
    localStorage.removeItem('sf_token');
    sessionStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    sessionStorage.removeItem('sf_user');
    localStorage.removeItem('sf_admin_token');
    sessionStorage.removeItem('sf_admin_token');
    localStorage.removeItem('sf_admin');
    sessionStorage.removeItem('sf_admin');
  },
};

const AdminToken = {
  get() {
    return localStorage.getItem('sf_admin_token') || sessionStorage.getItem('sf_admin_token');
  },
  set(token, remember = false) {
    if (remember) {
      localStorage.setItem('sf_admin_token', token);
    } else {
      sessionStorage.setItem('sf_admin_token', token);
    }
  },
};

// ============================================
// API CALL
// ============================================
async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  // Attach the right token based on the endpoint scope
  const isAdminEndpoint = endpoint.startsWith('/admin');
  const token = isAdminEndpoint ? AdminToken.get() : Token.get();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { ...options, headers };

  // If body is FormData, remove Content-Type (browser sets boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
    config.body = options.body;
  } else if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) {
      // Auto logout on 401
      if (res.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
        Token.clear();
        if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin')) {
          window.location.href = '/login.html';
        }
      }
      return { success: false, message: data.message || 'Terjadi kesalahan', errors: data.errors, data: data.data };
    }
    return data;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' };
  }
}

// ============================================
// FORMATTERS
// ============================================
function formatRupiah(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = {
    pending: { class: 'badge-pending', text: 'Menunggu' },
    approved: { class: 'badge-approved', text: 'Disetujui' },
    disbursed: { class: 'badge-disbursed', text: 'Dana Cair' },
    rejected: { class: 'badge-rejected', text: 'Ditolak' },
    completed: { class: 'badge-completed', text: 'Lunas' },
    active: { class: 'badge-active', text: 'Aktif' },
    frozen: { class: 'badge-frozen', text: 'Dibekukan' },
  };
  const s = map[status] || { class: 'badge-pending', text: status };
  return `<span class="badge ${s.class}">${s.text}</span>`;
}

// ============================================
// TOAST NOTIFICATION
// ============================================
function showToast(message, type = 'success') {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-500',
    info: 'bg-blue-600',
  };
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
  };
  const toast = document.createElement('div');
  toast.className = `sf-toast ${colors[type] || colors.info}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info} mr-2"></i> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// SWEETALERT WRAPPERS
// ============================================
async function alertSuccess(title, text) {
  return Swal.fire({ icon: 'success', title, text, confirmButtonColor: '#2563eb' });
}
async function alertError(title, text) {
  return Swal.fire({ icon: 'error', title, text, confirmButtonColor: '#2563eb' });
}
async function alertConfirm(title, text, confirmText = 'Ya', cancelText = 'Batal') {
  const result = await Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
  });
  return result.isConfirmed;
}

// ============================================
// LOADING BUTTON
// ============================================
function setBtnLoading(btn, loading = true) {
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = `<span class="btn-spinner"><span class="spinner"></span></span><span class="btn-text">${btn.dataset.originalHtml}</span>`;
  } else {
    btn.disabled = false;
    btn.classList.remove('btn-loading');
    if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  }
}

// ============================================
// DARK MODE
// ============================================
const DarkMode = {
  init() {
    const saved = localStorage.getItem('sf_dark');
    if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  },
  toggle() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('sf_dark', isDark);
    return isDark;
  },
  isDark() {
    return document.documentElement.classList.contains('dark');
  },
};

// ============================================
// AUTH GUARDS
// ============================================
async function requireUser() {
  const token = Token.get();
  if (!token) {
    window.location.href = '/login.html';
    return null;
  }
  const res = await api('/auth/me');
  if (!res.success) {
    Token.clear();
    window.location.href = '/login.html';
    return null;
  }
  return res.data;
}

async function requireAdmin() {
  const token = AdminToken.get();
  if (!token) {
    window.location.href = '/admin.html';
    return null;
  }
  const res = await api('/admin/me');
  if (!res.success) {
    Token.clear();
    window.location.href = '/admin.html';
    return null;
  }
  return res.data;
}

// ============================================
// PAGE LOADER
// ============================================
function hidePageLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 300);
  }
}

// Init dark mode on load
DarkMode.init();