const STORAGE_KEY = 'debtTrackerData';

const TYPE_LABELS = {
    'credit-card': 'Кредитная карта',
    installment: 'Рассрочка',
    loan: 'Кредит',
    other: 'Другое',
};

const TYPE_ICONS = {
    'credit-card': '💳',
    installment: '🛍️',
    loan: '🏦',
    other: '📄',
};

let debts = [];
let editingId = null;

const els = {
    totalDebt: document.getElementById('totalDebt'),
    totalPaid: document.getElementById('totalPaid'),
    debtsCount: document.getElementById('debtsCount'),
    monthlyTotal: document.getElementById('monthlyTotal'),
    progressBar: document.getElementById('progressBar'),
    paidPercent: document.getElementById('paidPercent'),
    debtsList: document.getElementById('debtsList'),
    emptyState: document.getElementById('emptyState'),
    debtModal: document.getElementById('debtModal'),
    settingsModal: document.getElementById('settingsModal'),
    payModal: document.getElementById('payModal'),
    historyModal: document.getElementById('historyModal'),
    appShell: document.getElementById('appShell'),
    debtForm: document.getElementById('debtForm'),
    payForm: document.getElementById('payForm'),
    modalTitle: document.getElementById('modalTitle'),
    modalLabel: document.getElementById('modalLabel'),
    submitBtn: document.getElementById('submitBtn'),
    payDebtName: document.getElementById('payDebtName'),
    payAmount: document.getElementById('payAmount'),
    payHint: document.getElementById('payHint'),
    historyList: document.getElementById('historyList'),
    emptyHistory: document.getElementById('emptyHistory'),
    historyTitle: document.getElementById('historyTitle'),
    historyReset: document.getElementById('historyReset'),
    historyStats: document.getElementById('historyStats'),
    monthlyModal: document.getElementById('monthlyModal'),
    monthlyList: document.getElementById('monthlyList'),
    emptyMonthly: document.getElementById('emptyMonthly'),
    monthlyModalTotal: document.getElementById('monthlyModalTotal'),
    monthlyHint: document.getElementById('monthlyHint'),
};

let historyFilterId = null;

let payingDebtId = null;

function loadDebts() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        debts = raw ? JSON.parse(raw) : [];
        debts.forEach((d) => {
            if (!Array.isArray(d.payments)) d.payments = [];
            if (!Array.isArray(d.paidDueDates)) d.paidDueDates = [];
        });
    } catch {
        debts = [];
    }
}

function parseMoney(value) {
    const digits = String(value).replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (target.getTime() === today.getTime()) return `Сегодня, ${time}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (target.getTime() === yesterday.getTime()) return `Вчера, ${time}`;

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getAllPayments() {
    const all = [];
    debts.forEach((debt) => {
        (debt.payments || []).forEach((p) => {
            all.push({ ...p, debtId: debt.id, debtName: debt.name, debtType: debt.type });
        });
    });
    return all.sort((a, b) => b.timestamp - a.timestamp);
}

function saveDebts() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

function formatMoney(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getMonthlyDebts() {
    return debts
        .filter((d) => d.minimumPayment > 0 && d.amount > 0)
        .slice()
        .sort((a, b) => {
            if (a.paymentDate && b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate);
            if (a.paymentDate) return -1;
            if (b.paymentDate) return 1;
            return 0;
        });
}

function isMonthlyPaidForCurrentDue(debt) {
    if (!debt.paymentDate) return false;
    return (debt.paidDueDates || []).includes(debt.paymentDate);
}

function getMonthlyTotal() {
    return getMonthlyDebts()
        .filter((d) => !isMonthlyPaidForCurrentDue(d))
        .reduce((sum, d) => sum + d.minimumPayment, 0);
}

function advancePaymentDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
}

function addPayment(debt, amount, type = 'manual') {
    if (!debt.payments) debt.payments = [];
    debt.payments.unshift({
        id: generateId(),
        amount,
        timestamp: Date.now(),
        type,
    });
    debt.amount = Math.max(0, debt.amount - amount);
}

function getTotals() {
    let totalDebt = 0;
    let totalOriginal = 0;

    debts.forEach((d) => {
        totalDebt += d.amount;
        totalOriginal += d.originalAmount || d.amount;
    });

    const totalPaid = Math.max(0, totalOriginal - totalDebt);
    const percent = totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0;
    const monthlyPayments = getMonthlyTotal();

    return { totalDebt, totalPaid, totalOriginal, monthlyPayments, percent };
}

function renderSummary() {
    const { totalDebt, totalPaid, monthlyPayments, percent } = getTotals();

    els.totalDebt.textContent = formatMoney(totalDebt);
    els.totalPaid.textContent = formatMoney(totalPaid);
    els.debtsCount.textContent = debts.length;
    if (els.monthlyTotal) els.monthlyTotal.textContent = formatMoney(monthlyPayments);
    if (els.monthlyHint) {
        const count = getMonthlyDebts().filter((d) => !isMonthlyPaidForCurrentDue(d)).length;
        els.monthlyHint.textContent = count > 0
            ? `${count} платеж${count === 1 ? '' : count < 5 ? 'а' : 'ей'} · нажми`
            : 'Нажми — список платежей';
    }
    els.progressBar.style.width = percent + '%';
    els.paidPercent.textContent = percent + '%';
}

function renderDebtCard(debt) {
    const days = daysUntil(debt.paymentDate);
    let dateClass = '';
    let dateNote = '';

    if (days !== null) {
        if (days < 0) {
            dateClass = 'overdue';
            dateNote = `просрочено на ${Math.abs(days)} дн.`;
        } else if (days === 0) {
            dateClass = 'today';
            dateNote = 'сегодня';
        } else if (days <= 3) {
            dateClass = 'soon';
            dateNote = `через ${days} дн.`;
        } else {
            dateNote = `через ${days} дн.`;
        }
    }

    const original = debt.originalAmount || debt.amount;
    const paid = Math.max(0, original - debt.amount);
    const progress = original > 0 ? Math.round((paid / original) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'debt-card';
    card.dataset.id = debt.id;

    card.innerHTML = `
        <div class="debt-top">
            <div class="debt-name">
                <div class="debt-icon">${TYPE_ICONS[debt.type] || '📄'}</div>
                <div>
                    <h3>${escapeHtml(debt.name)}</h3>
                    <p class="debt-type">${TYPE_LABELS[debt.type] || 'Другое'}</p>
                </div>
            </div>
            <div class="debt-amount">
                <span>Остаток</span>
                <strong>${formatMoney(debt.amount)}</strong>
            </div>
        </div>

        <div class="debt-progress-mini">
            <div class="progress">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
            <span class="debt-progress-text">Погашено ${progress}%</span>
        </div>

        <div class="debt-info">
            <div class="info-item">
                <span>${debt.type === 'installment' ? 'Платёж в месяц' : 'Мин. платёж'}</span>
                <strong>${debt.minimumPayment ? formatMoney(debt.minimumPayment) : '—'}</strong>
            </div>
            <div class="info-item ${dateClass}">
                <span>След. платёж</span>
                <strong>${formatDate(debt.paymentDate)}</strong>
                ${dateNote ? `<em class="date-note">${dateNote}</em>` : ''}
            </div>
        </div>

        <div class="debt-actions">
            <button class="pay-btn" data-action="pay" data-id="${debt.id}">Внести платёж</button>
            <button class="edit-btn" data-action="edit" data-id="${debt.id}">✏️</button>
            <button class="delete-btn" data-action="delete" data-id="${debt.id}">🗑</button>
        </div>
    `;

    return card;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderDebts() {
    const existingCards = els.debtsList.querySelectorAll('.debt-card');
    existingCards.forEach((c) => c.remove());

    if (debts.length === 0) {
        els.emptyState.classList.remove('hidden');
        return;
    }

    els.emptyState.classList.add('hidden');

    debts
        .slice()
        .sort((a, b) => {
            if (a.paymentDate && b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate);
            if (a.paymentDate) return -1;
            if (b.paymentDate) return 1;
            return 0;
        })
        .forEach((debt) => {
            els.debtsList.appendChild(renderDebtCard(debt));
        });
}

function renderHistory(filterDebtId = historyFilterId) {
    historyFilterId = filterDebtId;

    const payments = getAllPayments().filter(
        (p) => !filterDebtId || p.debtId === filterDebtId
    );

    if (filterDebtId) {
        const debt = debts.find((d) => d.id === filterDebtId);
        els.historyTitle.textContent = debt ? debt.name : 'Все операции';
        els.historyReset.classList.remove('hidden');
    } else {
        els.historyTitle.textContent = 'Все операции';
        els.historyReset.classList.add('hidden');
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (payments.length > 0) {
        els.historyStats.innerHTML = `
            <div class="history-stat">
                <span>Операций</span>
                <strong>${payments.length}</strong>
            </div>
            <div class="history-stat">
                <span>Внесено</span>
                <strong>${formatMoney(totalPaid)}</strong>
            </div>
        `;
        els.historyStats.classList.remove('hidden');
    } else {
        els.historyStats.innerHTML = '';
        els.historyStats.classList.add('hidden');
    }

    els.historyList.querySelectorAll('.history-item').forEach((el) => el.remove());

    if (payments.length === 0) {
        els.emptyHistory.classList.remove('hidden');
        els.emptyHistory.querySelector('p').textContent = filterDebtId
            ? 'По этому долгу платежей пока нет.'
            : 'Платежей пока нет — они появятся после первого внесения.';
        return;
    }

    els.emptyHistory.classList.add('hidden');

    payments.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-icon">${TYPE_ICONS[p.debtType] || '📄'}</div>
            <div class="history-info">
                <strong>${escapeHtml(p.debtName)}</strong>
                <span>${formatDateTime(p.timestamp)}</span>
            </div>
            <div class="history-amount">−${formatMoney(p.amount)}</div>
        `;
        els.historyList.appendChild(item);
    });
}

function render() {
    renderSummary();
    renderDebts();
}

function renderMonthlyModal() {
    const items = getMonthlyDebts();
    const unpaid = items.filter((d) => !isMonthlyPaidForCurrentDue(d));
    const unpaidTotal = unpaid.reduce((s, d) => s + d.minimumPayment, 0);

    els.monthlyList.querySelectorAll('.monthly-item').forEach((el) => el.remove());

    if (items.length === 0) {
        els.emptyMonthly.classList.remove('hidden');
        els.monthlyModalTotal.innerHTML = '';
        return;
    }

    els.emptyMonthly.classList.add('hidden');
    els.monthlyModalTotal.innerHTML = `
        <span>Осталось оплатить</span>
        <strong>${formatMoney(unpaidTotal)}</strong>
    `;

    items.forEach((debt) => {
        const paid = isMonthlyPaidForCurrentDue(debt);
        const days = daysUntil(debt.paymentDate);
        let statusClass = '';
        let statusText = '';

        if (paid) {
            statusClass = 'paid';
            statusText = 'Оплачено';
        } else if (days !== null && days < 0) {
            statusClass = 'overdue';
            statusText = `Просрочено ${Math.abs(days)} дн.`;
        } else if (days === 0) {
            statusClass = 'today';
            statusText = 'Сегодня';
        } else if (days !== null && days <= 5) {
            statusClass = 'soon';
            statusText = `Через ${days} дн.`;
        }

        const item = document.createElement('div');
        item.className = `monthly-item ${statusClass}${paid ? ' is-paid' : ''}`;

        item.innerHTML = `
            <div class="monthly-item-top">
                <div class="monthly-item-icon">${TYPE_ICONS[debt.type] || '📄'}</div>
                <div class="monthly-item-info">
                    <strong>${escapeHtml(debt.name)}</strong>
                    <span>${TYPE_LABELS[debt.type] || 'Другое'}</span>
                </div>
                <div class="monthly-item-amount">${formatMoney(debt.minimumPayment)}</div>
            </div>
            <div class="monthly-item-bottom">
                <div class="monthly-item-date">
                    <span>Дата оплаты</span>
                    <strong>${formatDate(debt.paymentDate)}</strong>
                    ${statusText && !paid ? `<em>${statusText}</em>` : ''}
                </div>
                ${
                    paid
                        ? '<div class="monthly-paid-badge">✓ Погашено</div>'
                        : `<button type="button" class="monthly-pay-btn" data-action="monthly-paid" data-id="${debt.id}">Погашено</button>`
                }
            </div>
        `;

        els.monthlyList.appendChild(item);
    });
}

function openMonthlyModal() {
    renderMonthlyModal();
    openModal(els.monthlyModal);
}

function markMonthlyPaid(id) {
    const debt = debts.find((d) => d.id === id);
    if (!debt || !debt.minimumPayment || debt.amount <= 0) return;
    if (isMonthlyPaidForCurrentDue(debt)) return;

    const amount = Math.min(debt.minimumPayment, debt.amount);
    const dueDate = debt.paymentDate;

    addPayment(debt, amount, 'monthly');

    if (!debt.paidDueDates) debt.paidDueDates = [];
    if (dueDate) debt.paidDueDates.push(dueDate);

    if (dueDate) {
        debt.paymentDate = advancePaymentDate(dueDate);
    }

    saveDebts();
    render();
    renderMonthlyModal();
}

function openHistoryModal(filterDebtId = null) {
    renderHistory(filterDebtId);
    openModal(els.historyModal);
}

function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeModal(modal) {
    modal.classList.add('hidden');
    if (!document.querySelector('.modal:not(.hidden)')) {
        document.body.classList.remove('modal-open');
    }
}

function openAddModal() {
    editingId = null;
    els.modalLabel.textContent = 'НОВЫЙ ДОЛГ';
    els.modalTitle.textContent = 'Добавить обязательство';
    els.submitBtn.textContent = 'Добавить долг';
    els.debtForm.reset();
    document.getElementById('originalAmount').value = '';
    openModal(els.debtModal);
}

function openEditModal(id) {
    const debt = debts.find((d) => d.id === id);
    if (!debt) return;

    editingId = id;
    els.modalLabel.textContent = 'РЕДАКТИРОВАНИЕ';
    els.modalTitle.textContent = 'Изменить обязательство';
    els.submitBtn.textContent = 'Сохранить';

    document.getElementById('debtName').value = debt.name;
    document.getElementById('debtType').value = debt.type;
    document.getElementById('debtAmount').value = debt.amount ? String(debt.amount) : '';
    document.getElementById('originalAmount').value = (debt.originalAmount || debt.amount) ? String(debt.originalAmount || debt.amount) : '';
    document.getElementById('minimumPayment').value = debt.minimumPayment ? String(debt.minimumPayment) : '';
    document.getElementById('paymentDate').value = debt.paymentDate || '';

    openModal(els.debtModal);
}

function openPayModal(id) {
    const debt = debts.find((d) => d.id === id);
    if (!debt) return;

    payingDebtId = id;
    els.payDebtName.textContent = debt.name;
    els.payAmount.value = debt.minimumPayment ? String(debt.minimumPayment) : '';
    els.payHint.textContent = `Остаток: ${formatMoney(debt.amount)}`;

    openModal(els.payModal);

    setTimeout(() => {
        els.payAmount.focus();
        els.payAmount.select();
    }, 300);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('debtName').value.trim();
    const type = document.getElementById('debtType').value;
    const amount = parseMoney(document.getElementById('debtAmount').value);
    const originalAmount = parseMoney(document.getElementById('originalAmount').value) || amount;
    const minimumPayment = parseMoney(document.getElementById('minimumPayment').value);
    const paymentDate = document.getElementById('paymentDate').value;

    if (!name || amount < 0) return;

    const data = {
        name,
        type,
        amount,
        originalAmount: Math.max(originalAmount, amount),
        minimumPayment,
        paymentDate,
    };

    if (editingId) {
        const idx = debts.findIndex((d) => d.id === editingId);
        if (idx !== -1) {
            debts[idx] = { ...debts[idx], ...data };
        }
    } else {
        debts.push({ id: generateId(), ...data, payments: [], paidDueDates: [], createdAt: Date.now() });
    }

    saveDebts();
    render();
    closeModal(els.debtModal);
}

function handlePaySubmit(e) {
    e.preventDefault();

    const amount = parseMoney(els.payAmount.value);
    if (amount <= 0 || !payingDebtId) return;

    const debt = debts.find((d) => d.id === payingDebtId);
    if (!debt) return;

    if (amount > debt.amount) {
        alert(`Сумма больше остатка (${formatMoney(debt.amount)})`);
        return;
    }

    if (!debt.payments) debt.payments = [];
    addPayment(debt, amount, 'manual');

    saveDebts();
    render();
    closeModal(els.payModal);
    payingDebtId = null;
}

function deleteDebt(id) {
    const debt = debts.find((d) => d.id === id);
    if (!debt) return;

    if (!confirm(`Удалить «${debt.name}»?`)) return;

    debts = debts.filter((d) => d.id !== id);
    saveDebts();
    render();
}

function exportData() {
    const blob = new Blob([JSON.stringify(debts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error('Invalid format');
            if (confirm(`Импортировать ${imported.length} долгов? Текущие данные будут заменены.`)) {
                debts = imported;
                debts.forEach((d) => {
                    if (!Array.isArray(d.payments)) d.payments = [];
                    if (!Array.isArray(d.paidDueDates)) d.paidDueDates = [];
                });
                saveDebts();
                render();
                closeModal(els.settingsModal);
            }
        } catch {
            alert('Не удалось прочитать файл. Проверь формат JSON.');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('Удалить все долги? Это действие нельзя отменить.')) return;
    debts = [];
    saveDebts();
    render();
    closeModal(els.settingsModal);
}

function setupMoneyInputs() {
    document.querySelectorAll('.money-input').forEach((input) => {
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '');
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            input.value = text.replace(/\D/g, '');
        });
    });
}

function setupEventListeners() {
    document.getElementById('addDebtBtn').addEventListener('click', openAddModal);
    document.getElementById('emptyAddBtn').addEventListener('click', openAddModal);
    document.getElementById('historyBtn').addEventListener('click', () => openHistoryModal(null));
    document.getElementById('settingsBtn').addEventListener('click', () => openModal(els.settingsModal));
    document.getElementById('monthlyCardBtn').addEventListener('click', openMonthlyModal);

    document.getElementById('closeModal').addEventListener('click', () => closeModal(els.debtModal));
    document.getElementById('closeSettings').addEventListener('click', () => closeModal(els.settingsModal));
    document.getElementById('closePayModal').addEventListener('click', () => closeModal(els.payModal));
    document.getElementById('closeHistory').addEventListener('click', () => closeModal(els.historyModal));
    document.getElementById('closeMonthly').addEventListener('click', () => closeModal(els.monthlyModal));

    document.getElementById('modalOverlay').addEventListener('click', () => closeModal(els.debtModal));
    document.getElementById('settingsOverlay').addEventListener('click', () => closeModal(els.settingsModal));
    document.getElementById('payOverlay').addEventListener('click', () => closeModal(els.payModal));
    document.getElementById('historyOverlay').addEventListener('click', () => closeModal(els.historyModal));
    document.getElementById('monthlyOverlay').addEventListener('click', () => closeModal(els.monthlyModal));

    els.debtForm.addEventListener('submit', handleFormSubmit);
    els.payForm.addEventListener('submit', handlePaySubmit);

    els.debtsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const { action, id } = btn.dataset;
        if (action === 'pay') openPayModal(id);
        if (action === 'edit') openEditModal(id);
        if (action === 'delete') deleteDebt(id);
    });

    els.monthlyList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="monthly-paid"]');
        if (!btn) return;
        markMonthlyPaid(btn.dataset.id);
    });

    document.getElementById('exportBtn').addEventListener('click', exportData);

    document.getElementById('importInput').addEventListener('change', (e) => {
        if (e.target.files[0]) importData(e.target.files[0]);
        e.target.value = '';
    });

    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

    document.getElementById('payMinBtn').addEventListener('click', () => {
        const debt = debts.find((d) => d.id === payingDebtId);
        if (debt?.minimumPayment) els.payAmount.value = String(Math.min(debt.minimumPayment, debt.amount));
    });

    document.getElementById('payFullBtn').addEventListener('click', () => {
        const debt = debts.find((d) => d.id === payingDebtId);
        if (debt) els.payAmount.value = String(debt.amount);
    });

    document.getElementById('historyReset').addEventListener('click', () => renderHistory(null));

    document.addEventListener('touchmove', (e) => {
        if (document.body.classList.contains('modal-open')) return;
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
}

loadDebts();
setupMoneyInputs();
setupEventListeners();
render();
