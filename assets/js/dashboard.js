/* ============================================
   SMART FUND - User Dashboard Logic
   ============================================ */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  currentUser = await requireUser();
  if (!currentUser) return;
  hidePageLoader();

  // ============================================
  // INIT UI
  // ============================================
  const darkToggle = document.getElementById('darkToggle');
  const updateIcon = () => { darkToggle.innerHTML = DarkMode.isDark() ? '<i class="fas fa-sun text-amber-500"></i>' : '<i class="fas fa-moon text-slate-600"></i>'; };
  updateIcon();
  darkToggle.addEventListener('click', () => { DarkMode.toggle(); updateIcon(); });

  // User info
  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userEmail').textContent = currentUser.email;
  document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();
  document.getElementById('welcomeName').textContent = currentUser.full_name.split(' ')[0];

  // Mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  document.getElementById('menuToggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });
  overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });

  // Sidebar navigation
  const pageTitles = {
    dashboard: 'Dashboard', apply: 'Ajukan Pinjaman', history: 'Riwayat Pengajuan',
    balance: 'Saldo Pinjaman', limit: 'Limit Pinjaman',
  };
  document.querySelectorAll('.sidebar-link[data-page]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      document.querySelectorAll('.page-content').forEach((p) => p.classList.add('hidden'));
      document.getElementById(`page-${page}`).classList.remove('hidden');
      document.querySelectorAll('.sidebar-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('pageTitle').textContent = pageTitles[page] || 'Dashboard';
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      loadPageData(page);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const ok = await alertConfirm('Logout?', 'Anda akan keluar dari akun ini.');
    if (ok) { Token.clear(); window.location.href = `${BASE_PATH}/login.html`; }
  });

  // Notifications
  document.getElementById('notifBtn').addEventListener('click', openNotifModal);
  document.getElementById('closeNotifBtn').addEventListener('click', closeNotifModal);

  // Withdrawal modal
  document.getElementById('openWithdrawBtn').addEventListener('click', openWithdrawModal);
  document.getElementById('closeWithdrawBtn').addEventListener('click', closeWithdrawModal);
  document.getElementById('withdrawForm').addEventListener('submit', submitWithdrawal);

  // ============================================
  // LOAD INITIAL DATA
  // ============================================
  await loadDashboard();
  await loadNotifications();

  // ============================================
  // APPLY LOAN
  // ============================================
  document.getElementById('applyFullName').value = currentUser.full_name;
  document.getElementById('applyPhone').value = currentUser.phone;
  document.getElementById('applyLimitInfo').textContent = formatRupiah(currentUser.loan_limit);

  document.getElementById('applyNextBtn').addEventListener('click', () => {
    document.getElementById('applyStep1').classList.add('hidden');
    document.getElementById('applyStep2').classList.remove('hidden');
  });
  document.getElementById('applyBackBtn').addEventListener('click', () => {
    document.getElementById('applyStep2').classList.add('hidden');
    document.getElementById('applyStep1').classList.remove('hidden');
  });

  // Estimasi real-time
  function updateEstimasi() {
    const amount = parseFloat(document.getElementById('applyAmount').value) || 0;
    const tenor = parseInt(document.getElementById('applyTenor').value, 10);
    if (amount > 0 && tenor > 0) {
      const rate = 5 / 100 / 12;
      const monthly = amount * (rate * Math.pow(1 + rate, tenor)) / (Math.pow(1 + rate, tenor) - 1);
      const total = monthly * tenor;
      const interest = total - amount;
      document.getElementById('applyEstMonthly').textContent = formatRupiah(monthly);
      document.getElementById('applyEstInterest').textContent = formatRupiah(interest);
      document.getElementById('applyEstTotal').textContent = formatRupiah(total);
    }
  }
  document.getElementById('applyAmount').addEventListener('input', updateEstimasi);
  document.getElementById('applyTenor').addEventListener('change', updateEstimasi);

  document.getElementById('applySubmitBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('applyAmount').value);
    const tenor = parseInt(document.getElementById('applyTenor').value, 10);
    const purpose = document.getElementById('applyPurpose').value;

    if (!amount || amount < 1000000 || amount > 500000000) return showToast('Jumlah Rp1.000.000 - Rp500.000.000', 'error');
    if (amount > currentUser.loan_limit) return showToast(`Jumlah melebihi limit (${formatRupiah(currentUser.loan_limit)})`, 'error');
    if (!purpose) return showToast('Tujuan wajib dipilih', 'error');

    const btn = document.getElementById('applySubmitBtn');
    setBtnLoading(btn, true);
    const res = await api('/loans/apply', { method: 'POST', body: { amount, tenor, purpose } });
    setBtnLoading(btn, false);

    if (res.success) {
      await alertSuccess('Pengajuan Berhasil!', `Pengajuan #${res.data.applicationId} terkirim. Status: Menunggu Persetujuan. Notifikasi telah dikirim ke admin via Telegram.`);
      document.getElementById('applyStep2').classList.add('hidden');
      document.getElementById('applyStep1').classList.remove('hidden');
      document.getElementById('applyAmount').value = '';
      document.getElementById('applyPurpose').value = '';
      await loadDashboard();
      // Navigate to dashboard
      document.querySelector('.sidebar-link[data-page="dashboard"]').click();
    } else {
      showToast(res.message || 'Gagal mengajukan', 'error');
    }
  });

});

// ============================================
// LOAD FUNCTIONS
// ============================================
async function loadDashboard() {
  const res = await api('/user/dashboard');
  if (!res.success) return;
  const d = res.data;
  const availableBalance = Number(d.saldoPinjaman || 0);
  document.getElementById('statBalance').textContent = formatRupiah(d.saldoPinjaman);
  document.getElementById('statLimit').textContent = formatRupiah(d.limitPinjaman);
  document.getElementById('statTagihan').textContent = formatRupiah(availableBalance);
  document.getElementById('balanceAmount').textContent = formatRupiah(d.saldoPinjaman);
  document.getElementById('balanceLimit').textContent = formatRupiah(d.limitPinjaman);
  document.getElementById('limitAmount').textContent = formatRupiah(d.limitPinjaman);
  document.getElementById('accountStatus').textContent = d.statusAkun === 'active' ? 'Aktif' : d.statusAkun === 'frozen' ? 'Dibekukan' : d.statusAkun;
  document.getElementById('balanceStatus').textContent = d.statusAkun === 'active' ? 'Aktif' : 'Dibekukan';
  const badge = document.getElementById('accountStatusBadge');
  badge.className = `badge ${d.statusAkun === 'active' ? 'badge-active' : 'badge-frozen'}`;
  badge.textContent = d.statusAkun === 'active' ? 'Aktif' : 'Dibekukan';

  const withdrawAmountInput = document.getElementById('withdrawAmount');
  withdrawAmountInput.max = String(Math.max(availableBalance, 0));
  withdrawAmountInput.value = Math.max(availableBalance, 0);

  // Last application
  const lastAppEl = document.getElementById('lastApplication');
  if (d.statusPengajuan) {
    lastAppEl.innerHTML = `
      <div class="text-left">
        <div class="flex justify-between mb-2"><span class="text-slate-500">ID</span><span class="font-bold">#${d.statusPengajuan.id}</span></div>
        <div class="flex justify-between mb-2"><span class="text-slate-500">Jumlah</span><span class="font-bold">${formatRupiah(d.statusPengajuan.amount)}</span></div>
        <div class="flex justify-between mb-2"><span class="text-slate-500">Tanggal</span><span>${formatDate(d.statusPengajuan.created_at)}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Status</span>${statusBadge(d.statusPengajuan.status)}</div>
      </div>`;
  }

  // Recent transactions
  const txEl = document.getElementById('recentTransactions');
  const balTxEl = document.getElementById('balanceTransactions');
  if (d.riwayatTransaksi && d.riwayatTransaksi.length) {
    const html = d.riwayatTransaksi.map((t) => `
      <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 ${t.type === 'disbursement' ? 'bg-green-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center">
            <i class="fas ${t.type === 'disbursement' ? 'fa-arrow-down' : 'fa-arrow-up'} ${t.type === 'disbursement' ? 'text-green-600' : 'text-blue-600'}"></i>
          </div>
          <div><p class="text-sm font-semibold text-slate-800">${t.description || t.type}</p><p class="text-xs text-slate-400">${formatDate(t.created_at)}</p></div>
        </div>
        <span class="font-bold ${t.type === 'disbursement' ? 'text-green-600' : 'text-slate-700'}">${formatRupiah(t.amount)}</span>
      </div>`).join('');
    txEl.innerHTML = html;
    balTxEl.innerHTML = html;
  }
}

async function loadPageData(page) {
  if (page === 'history') {
    const res = await api('/loans/my');
    const tbody = document.getElementById('historyTable');
    if (res.success && res.data.length) {
      tbody.innerHTML = res.data.map((l) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
          <td class="px-4 py-3 font-semibold text-slate-700">#${l.id}</td>
          <td class="px-4 py-3 text-slate-700">${formatRupiah(l.amount)}</td>
          <td class="px-4 py-3 text-slate-700">${l.tenor} bln</td>
          <td class="px-4 py-3 text-slate-700">${formatRupiah(l.monthly_payment)}</td>
          <td class="px-4 py-3">${statusBadge(l.status)}</td>
          <td class="px-4 py-3 text-slate-500 text-sm">${formatDate(l.created_at)}</td>
        </tr>`).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Belum ada pengajuan</td></tr>';
    }
  }
}

async function loadNotifications() {
  const res = await api('/user/notifications');
  if (!res.success) return;
  const badge = document.getElementById('notifBadge');
  const unread = res.data.filter((n) => !n.is_read).length;
  if (unread > 0) {
    badge.classList.remove('hidden');
    badge.textContent = unread > 9 ? '9+' : unread;
  } else {
    badge.classList.add('hidden');
  }
  window._notifications = res.data;
}

function openNotifModal() {
  const modal = document.getElementById('notifModal');
  const list = document.getElementById('notifList');
  const notifs = window._notifications || [];
  if (notifs.length === 0) {
    list.innerHTML = '<div class="text-center py-8 text-slate-400"><i class="fas fa-bell-slash text-4xl mb-3"></i><p>Belum ada notifikasi</p></div>';
  } else {
    list.innerHTML = notifs.map((n) => `
      <div class="p-4 rounded-xl ${n.is_read ? 'bg-slate-50' : 'bg-blue-50 border border-blue-100'} cursor-pointer" onclick="markNotifRead(${n.id})">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 ${n.type === 'success' ? 'bg-green-100' : n.type === 'error' ? 'bg-red-100' : n.type === 'warning' ? 'bg-amber-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center flex-shrink-0">
            <i class="fas ${n.type === 'success' ? 'fa-circle-check text-green-600' : n.type === 'error' ? 'fa-circle-xmark text-red-600' : n.type === 'warning' ? 'fa-triangle-exclamation text-amber-600' : 'fa-circle-info text-blue-600'}"></i>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-slate-800 text-sm">${n.title}</p>
            <p class="text-sm text-slate-600 mt-1">${n.message}</p>
            <p class="text-xs text-slate-400 mt-1">${formatDateTime(n.created_at)}</p>
          </div>
        </div>
      </div>`).join('');
  }
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeNotifModal() {
  const modal = document.getElementById('notifModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function openWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeWithdrawModal() {
  const modal = document.getElementById('withdrawModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function submitWithdrawal(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const bankName = document.getElementById('withdrawBank').value.trim();
  const accountHolder = document.getElementById('withdrawAccountName').value.trim();
  const accountNumber = document.getElementById('withdrawAccountNumber').value.trim();

  if (!amount || amount < 100000) return showToast('Nominal penarikan minimal Rp 100.000', 'error');
  if (!bankName || !accountHolder || !accountNumber) return showToast('Semua data rekening wajib diisi', 'error');

  const btn = document.getElementById('withdrawSubmitBtn');
  setBtnLoading(btn, true);
  const res = await api('/user/withdrawals', {
    method: 'POST',
    body: { amount, bankName, accountHolder, accountNumber },
  });
  setBtnLoading(btn, false);

  if (!res.success) {
    showToast(res.message || 'Gagal mengajukan penarikan', 'error');
    return;
  }

  closeWithdrawModal();
  await loadDashboard();
  await Swal.fire({
    icon: 'warning',
    title: 'Segera Verifikasi Penarikan',
    html: `
      <p class="text-slate-600 mb-4">Penarikan Anda telah dikirim ke admin. <b>Segera lakukan verifikasi</b> untuk memproses penarikan Anda.</p>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800 mb-4">
        <p class="font-semibold mb-1"><i class="fas fa-circle-info mr-1"></i> Langkah Verifikasi:</p>
        <p>1. Hubungi admin melalui Telegram</p>
        <p>2. Kirim data verifikasi / KYC Anda</p>
        <p>3. Admin akan memproses penarikan Anda</p>
      </div>
    `,
    confirmButtonText: '💬 Chat Admin via Telegram',
    showDenyButton: true,
    denyButtonText: 'WhatsApp Admin',
    allowOutsideClick: false,
  }).then((result) => {
    if (result.isConfirmed) {
      const chatMessage = 'Halo Admin, saya baru saja mengajukan penarikan. Mohon bantu verifikasi untuk melanjutkan penarikan saya.';
      const telegramUrl = `https://t.me/smartfundonline_bot?text=${encodeURIComponent(chatMessage)}`;
      window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    } else if (result.isDenied) {
      const whatsappMessage = 'Verifikasi / KYC belum aktif lakukan verifikasi\n\nUntuk melanjutkan penarikan';
      const whatsappUrl = `https://wa.me/6281234567890?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  });
  showToast(res.message || 'Permintaan penarikan telah dikirim', 'success');
}

async function markNotifRead(id) {
  await api(`/user/notifications/${id}/read`, { method: 'PUT' });
  await loadNotifications();
  openNotifModal();
}