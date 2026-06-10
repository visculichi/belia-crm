/* ==========================================================================
   BELIA CRM - CONTROLADOR CENTRAL Y ROUTER SPA (app.js)
   ========================================================================== */

// Estado global de la aplicación en memoria
let products = [];
let inventory = [];
let customers = [];
let sales = [];
let appointments = [];

// ==========================================================================
// SISTEMA DE NOTIFICACIONES TOAST PREMIUM
// ==========================================================================
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    else if (type === 'danger') iconClass = 'fa-exclamation-circle';
    else if (type === 'warning') iconClass = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <i class="fas ${iconClass} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Remover automáticamente tras 4 segundos
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================================================
// SISTEMA DE MODALES REUTILIZABLES (Premium Sheets)
// ==========================================================================
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

function openModal(title, contentHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;
    modalOverlay.classList.add('active');
}

function closeModal() {
    modalOverlay.classList.remove('active');
    modalBody.innerHTML = '';
}

function openConfirmModal(title, message, onConfirm) {
    const confirmHtml = `
        <div style="display:flex; flex-direction:column; gap:16px; text-align:center; padding: 10px 0;">
            <p style="font-size:0.95rem; line-height:1.5; color:var(--color-text-secondary);">${message}</p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:8px;">
                <button type="button" class="btn btn-secondary" id="confirm-modal-cancel" style="min-width: 100px;">Cancelar</button>
                <button type="button" class="btn btn-primary" id="confirm-modal-ok" style="min-width: 100px; background-color: var(--color-danger); border-color: var(--color-danger);">Confirmar</button>
            </div>
        </div>
    `;
    
    openModal(title, confirmHtml);
    
    document.getElementById('confirm-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('confirm-modal-ok').addEventListener('click', () => {
        closeModal();
        onConfirm();
    });
}


if (modalClose) {
    modalClose.addEventListener('click', closeModal);
}
if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
}

// ==========================================================================
// SPA ROUTER (Enrutador de una sola página)
// ==========================================================================
function initRouter() {
    const menuItems = document.querySelectorAll('.menu-item');
    const pageViews = document.querySelectorAll('.page-view');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = item.dataset.page;

            // Cambiar menú activo
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');

            // Cambiar vista activa
            pageViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === `${targetPage}-view`) {
                    view.classList.add('active');
                }
            });

            // Recargar datos y renderizar la vista correspondiente
            loadAndRefreshViews(targetPage);
        });
    });

    // Cargar Dashboard por defecto
    loadAndRefreshViews('dashboard');
}

// ==========================================================================
// CARGA Y SINCRONIZACIÓN CENTRALIZADA
// ==========================================================================
async function loadAndRefreshViews(page = 'dashboard') {
    // Controlar visibilidad del botón flotante de Caja (no mostrar si ya estamos en ventas/POS)
    const floatingPosBtn = document.getElementById('floating-pos-btn');
    if (floatingPosBtn) {
        floatingPosBtn.style.display = (page === 'sales') ? 'none' : 'flex';
    }

    try {
        updateConnectionBadge();
        
        // Cargar datos desde la base de datos (o LocalStorage)
        products = await getProducts();
        inventory = await getInventory();
        customers = await getCustomers();
        sales = await getSales();
        appointments = await getAppointments();
        
        // Cargar fotos personalizadas
        if (typeof getCustomPhotos === 'function') {
            await getCustomPhotos();
        }

        // Actualizar vistas según la página actual
        if (page === 'dashboard') {
            initDashboardFilters();
            renderDashboardAppointmentsWidget();
            checkDashboardAppointmentsNovelty();
        } else if (page === 'inventory') {
            const isMasterActive = document.getElementById('tab-master-products')?.classList.contains('active');
            if (isMasterActive) {
                renderMasterProductsTable();
            } else {
                renderInventoryGrid();
            }
            populateCategoryFilter();
            populateMasterCategoryFilter();
        } else if (page === 'sales') {
            await reloadPOSData(); // Sincronizar datos del POS
            const selectedId = document.getElementById('pos-select-customer')?.value || null;
            populateCustomersSelect(selectedId);
        } else if (page === 'crm') {
            renderCRMTable();
        } else if (page === 'appointments') {
            initAppointmentsModule();
        } else if (page === 'photos') {
            await renderPhotosView();
        } else if (page === 'calculator') {
            initCalculatorModule();
        } else if (page === 'settings') {
            renderSettingsPanel();
            initSettingsNotificationsForm();
        } else if (page === 'shifts') {
            await renderShiftsView();
        } else if (page === 'labels') {
            renderLabelsView();
            populateLabelsCategoryFilter();
        }
    } catch (error) {
        console.error("Error al cargar vistas:", error);
        showToast('Error de Sincronización', `No se pudieron recuperar los datos actualizados. Detalle: ${error.message || error}`, 'danger');
    }
}

// Actualizar el indicador de estado de Supabase en el Sidebar
function updateConnectionBadge() {
    const badge = document.getElementById('db-connection-badge');
    if (!badge) return;
    const dot = badge.querySelector('.connection-dot');
    const text = badge.querySelector('.connection-text');

    const userName = localStorage.getItem('BELIA_USER_NAME') || '';
    const userSuffix = userName ? ` (${userName})` : '';

    if (isDemoMode()) {
        badge.className = 'connection-badge demo';
        text.textContent = `Modo Demo${userSuffix}`;
    } else {
        badge.className = 'connection-badge connected';
        text.textContent = `Supabase${userSuffix}`;
    }
}

// ==========================================================================
// RENDERIZADOR: DASHBOARD (Métricas y Gráficos) — CON FILTROS
// ==========================================================================

// Estado global del filtro activo del dashboard
let dashboardFilteredSales = [];

function renderDashboard(filteredSales) {
    // Si no se pasa filtro, usar todas las ventas
    const salesData = filteredSales !== undefined ? filteredSales : sales;
    dashboardFilteredSales = salesData;

    // 1. Calcular KPIs sobre las ventas filtradas
    const totalSalesRevenue = salesData.reduce((sum, s) => sum + s.total_amount, 0);
    const totalSalesCount = salesData.length;
    
    let itemsSold = 0;
    salesData.forEach(s => s.items && s.items.forEach(i => itemsSold += i.quantity));

    // Valorización de Stock (siempre total, no filtrada por fecha)
    let stockTotalValue = 0;
    inventory.forEach(inv => {
        const prod = products.find(p => p.id === inv.product_id);
        if (prod) stockTotalValue += (inv.stock * prod.selling_price);
    });

    // Inyectar en el DOM
    document.getElementById('kpi-sales-revenue').textContent = `$${totalSalesRevenue.toLocaleString('es-AR', {maximumFractionDigits:0})}`;
    document.getElementById('kpi-sales-count').textContent = totalSalesCount;
    document.getElementById('kpi-items-sold').textContent = itemsSold;
    document.getElementById('kpi-stock-value').textContent = `$${stockTotalValue.toLocaleString('es-AR', {maximumFractionDigits:0})}`;

    // 2. Gráfico adaptado al rango filtrado
    renderSalesChart(salesData);

    // 3. Ventas Recientes (del conjunto filtrado)
    const recentSalesList = document.getElementById('recent-sales-list');
    recentSalesList.innerHTML = '';
    const recent = [...salesData].sort((a,b) => new Date(b.sale_date) - new Date(a.sale_date));
    // Actualizar contador
    const recentCountEl = document.getElementById('recent-sales-count');
    if (recentCountEl) recentCountEl.textContent = recent.length > 0 ? `${recent.length} venta${recent.length !== 1 ? 's' : ''}` : '';
    if (recent.length === 0) {
        recentSalesList.innerHTML = `<div style="text-align:center; color:var(--color-text-muted); padding:20px;">No hay ventas en el período seleccionado.</div>`;
    } else {
        recent.forEach(s => {
            const customer = customers.find(c => c.id === s.customer_id);
            const clientName = customer ? `${customer.first_name} ${customer.last_name || ''}`.trim() : "Consumidor Final";
            const dateFormatted = new Date(s.sale_date).toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
            const div = document.createElement('div');
            div.className = 'sale-item-card';
            div.innerHTML = `
                <div class="sale-item-info">
                    <span class="sale-item-client">${clientName}</span>
                    <span class="sale-item-date">${dateFormatted} • ${s.payment_method}</span>
                </div>
                <span class="sale-item-amount">$${s.total_amount.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            `;
            recentSalesList.appendChild(div);
        });
    }

    // 4. Alertas de Stock Bajo (siempre total, independiente del filtro)
    const stockAlertsList = document.getElementById('stock-alerts-list');
    stockAlertsList.innerHTML = '';
    // Mostrar todos los ítems con stock bajo (sin límite), ordenados: agotados primero
    const lowStockItems = inventory
        .filter(inv => inv.stock < 3)
        .sort((a, b) => a.stock - b.stock);
    // Actualizar contador
    const stockCountEl = document.getElementById('stock-alerts-count');
    if (stockCountEl) stockCountEl.textContent = lowStockItems.length > 0 ? `${lowStockItems.length} variante${lowStockItems.length !== 1 ? 's' : ''}` : '';
    if (lowStockItems.length === 0) {
        stockAlertsList.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; color:var(--color-success); padding:30px; text-align:center;">
                <i class="fas fa-check-circle" style="font-size:2rem; margin-bottom:8px;"></i>
                <span style="font-size:0.9rem; font-weight:600;">¡Inventario Óptimo!</span>
                <span style="font-size:0.75rem; color:var(--color-text-muted);">No hay variantes con bajo stock.</span>
            </div>
        `;
    } else {
        lowStockItems.forEach(inv => {
            const prod = products.find(p => p.id === inv.product_id);
            if (!prod) return;
            const div = document.createElement('div');
            div.style = 'display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-radius:var(--radius-md); background-color:var(--color-bg-darker); border:1px solid var(--color-border); margin-bottom:8px;';
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.9rem; font-weight:600;">${prod.name}</span>
                    <span style="font-size:0.75rem; color:var(--color-text-muted)">Talle: ${inv.size} | Color: ${inv.color}</span>
                </div>
                <span class="badge ${inv.stock === 0 ? 'badge-stock-out' : 'badge-stock-low'}">${inv.stock === 0 ? 'Agotado' : `${inv.stock} u.`}</span>
            `;
            stockAlertsList.appendChild(div);
        });
    }
}

// Gráfico de Barras adaptado al set de ventas filtrado
function renderSalesChart(salesData) {
    const chartContainer = document.getElementById('dashboard-chart-container');
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const src = salesData || sales;

    // Determinar rango: si hay datos, mostrar los últimos 7 días del rango
    const dailySales = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        dailySales[key] = 0;
    }

    src.forEach(s => {
        const key = new Date(s.sale_date).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
        if (Object.prototype.hasOwnProperty.call(dailySales, key)) {
            dailySales[key] += s.total_amount;
        }
    });

    const keys = Object.keys(dailySales);
    const maxVal = Math.max(...Object.values(dailySales), 1000);

    const chartWrapper = document.createElement('div');
    chartWrapper.style = 'display:flex; justify-content:space-around; align-items:flex-end; height:200px; padding-top:20px; width:100%; position:relative;';

    keys.forEach(k => {
        const val = dailySales[k];
        const pct = (val / maxVal) * 100;
        const col = document.createElement('div');
        col.style = 'display:flex; flex-direction:column; align-items:center; flex:1; height:100%; justify-content:flex-end;';
        col.innerHTML = `
            <div style="font-size:0.75rem; font-weight:700; color:var(--color-gold-light); margin-bottom:8px; opacity:${val > 0 ? 1 : 0}">
                $${(val/1000).toFixed(1)}k
            </div>
            <div class="chart-bar" style="width:28px; height:${Math.max(pct,0)}%; background:linear-gradient(to top, var(--color-gold-dark), var(--color-gold-light)); border-radius:6px 6px 0 0; transition:height 0.6s ease; box-shadow:var(--shadow-gold);" title="$${val.toLocaleString()}"></div>
            <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:12px; font-weight:600; text-transform:uppercase;">${k}</div>
        `;
        chartWrapper.appendChild(col);
    });

    chartContainer.appendChild(chartWrapper);
}

// ==========================================================================
// FILTROS DEL DASHBOARD
// ==========================================================================
function initDashboardFilters() {
    // Toggle mostrar/ocultar barra de filtros
    const toggleBtn = document.getElementById('btn-toggle-dash-filters');
    const filterBar = document.getElementById('dashboard-filter-bar');
    const chevron = document.getElementById('dash-filter-chevron');
    if (toggleBtn && filterBar) {
        toggleBtn.addEventListener('click', () => {
            const isOpen = filterBar.style.maxHeight !== '0px';
            if (isOpen) {
                filterBar.style.maxHeight = '0px';
                filterBar.style.opacity = '0';
                filterBar.style.marginBottom = '0px';
                chevron.style.transform = 'rotate(180deg)';
            } else {
                filterBar.style.maxHeight = '400px';
                filterBar.style.opacity = '1';
                filterBar.style.marginBottom = '24px';
                chevron.style.transform = 'rotate(0deg)';
            }
        });
    }

    (async () => {
        try {
            const allShifts = await getCashShifts();
            const select = document.getElementById('df-shift-select');
            if (!select) return;
            select.innerHTML = '<option value="">Por Turno...</option>';
            // Numerar cronológicamente
            const chrono = [...allShifts].sort((a,b) => new Date(a.opened_at) - new Date(b.opened_at));
            chrono.forEach((sh, idx) => {
                const num = idx + 1;
                const dateLabel = new Date(sh.opened_at).toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'2-digit'});
                const opt = document.createElement('option');
                opt.value = sh.id;
                opt.textContent = `Turno #${num} — ${dateLabel}`;
                select.appendChild(opt);
            });
        } catch(e) { /* silencioso */ }
    })();

    // Botones de filtro rápido
    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Reset shift select
            const shiftSel = document.getElementById('df-shift-select');
            if (shiftSel) shiftSel.value = '';
            // Reset fechas
            const dfFrom = document.getElementById('df-date-from');
            const dfTo = document.getElementById('df-date-to');
            if (dfFrom) dfFrom.value = '';
            if (dfTo) dfTo.value = '';
            applyDashboardFilter(btn.dataset.filter);
        });
    });

    // Filtro por turno
    const shiftSelect = document.getElementById('df-shift-select');
    if (shiftSelect) {
        shiftSelect.addEventListener('change', () => {
            if (!shiftSelect.value) return;
            // Des-activar quick filters
            document.querySelectorAll('.dash-filter-btn').forEach(b => setFilterBtnInactive(b));
            applyDashboardFilter('shift', { shiftId: shiftSelect.value });
        });
    }

    // Botón Aplicar rango de fechas
    const applyBtn = document.getElementById('df-range-apply');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const from = document.getElementById('df-date-from').value;
            const to   = document.getElementById('df-date-to').value;
            if (!from && !to) return;
            // Des-activar quick filters
            document.querySelectorAll('.dash-filter-btn').forEach(b => setFilterBtnInactive(b));
            const shiftSel = document.getElementById('df-shift-select');
            if (shiftSel) shiftSel.value = '';
            applyDashboardFilter('range', { from, to });
        });
    }

    // Aplicar filtro "Hoy" por defecto al cargar
    applyDashboardFilter('today');
}

function setFilterBtnActive(btn) {
    btn.style.borderColor = 'var(--color-border-gold)';
    btn.style.color = 'var(--color-gold-light)';
    btn.style.background = 'rgba(212,175,55,0.08)';
}
function setFilterBtnInactive(btn) {
    btn.style.borderColor = 'var(--color-border)';
    btn.style.color = 'var(--color-text-muted)';
    btn.style.background = 'none';
}

function applyDashboardFilter(type, opts = {}) {
    const now = new Date();
    let filtered = [];
    let label = '';

    // Actualizar estado visual de botones
    document.querySelectorAll('.dash-filter-btn').forEach(b => {
        if (b.dataset.filter === type) setFilterBtnActive(b);
        else setFilterBtnInactive(b);
    });

    if (type === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        filtered = sales.filter(s => new Date(s.sale_date) >= startOfDay);
        label = `Hoy — ${now.toLocaleDateString('es-AR', {day:'2-digit', month:'long', year:'numeric'})}`;
    } else if (type === 'yesterday') {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        const endOfYesterday   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        filtered = sales.filter(s => { const d = new Date(s.sale_date); return d >= startOfYesterday && d <= endOfYesterday; });
        const yLabel = new Date(startOfYesterday).toLocaleDateString('es-AR', {day:'2-digit', month:'long', year:'numeric'});
        label = `Ayer — ${yLabel}`;
    } else if (type === '15days') {
        const since = new Date(now); since.setDate(since.getDate() - 15);
        filtered = sales.filter(s => new Date(s.sale_date) >= since);
        label = 'Últimos 15 días';
    } else if (type === '30days') {
        const since = new Date(now); since.setDate(since.getDate() - 30);
        filtered = sales.filter(s => new Date(s.sale_date) >= since);
        label = 'Últimos 30 días';
    } else if (type === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = sales.filter(s => new Date(s.sale_date) >= startOfMonth);
        label = `Este mes — ${now.toLocaleDateString('es-AR', {month:'long', year:'numeric'})}`;
    } else if (type === 'all') {
        filtered = [...sales];
        label = 'Todos los registros';
    } else if (type === 'shift') {
        filtered = sales.filter(s => s.shift_id === opts.shiftId);
        // Obtener número del turno
        (async () => {
            const allShifts = await getCashShifts();
            const chrono = [...allShifts].sort((a,b) => new Date(a.opened_at) - new Date(b.opened_at));
            const idx = chrono.findIndex(s => s.id === opts.shiftId);
            const num = idx !== -1 ? idx + 1 : '?';
            const lbl = document.getElementById('dashboard-filter-label');
            if (lbl) lbl.textContent = `Filtrando por Turno #${num} — ${filtered.length} ventas`;
        })();
        renderDashboard(filtered);
        return; // La label se actualiza asíncronamente arriba
    } else if (type === 'range') {
        const from = opts.from ? new Date(opts.from + 'T00:00:00') : null;
        const to   = opts.to   ? new Date(opts.to   + 'T23:59:59') : null;
        filtered = sales.filter(s => {
            const d = new Date(s.sale_date);
            if (from && d < from) return false;
            if (to   && d > to)   return false;
            return true;
        });
        const fromStr = opts.from ? new Date(opts.from + 'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'numeric'}) : '...';
        const toStr   = opts.to   ? new Date(opts.to   + 'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit', year:'numeric'}) : 'hoy';
        label = `Del ${fromStr} al ${toStr}`;
    }

    const lbl = document.getElementById('dashboard-filter-label');
    if (lbl) lbl.textContent = `${label} — ${filtered.length} venta${filtered.length !== 1 ? 's' : ''}`;

    renderDashboard(filtered);
}


// ==========================================================================
// RENDERIZADOR: CATÁLOGO DE INVENTARIO (Listado y Gestión)
// ==========================================================================
function renderInventoryGrid() {
    const container = document.getElementById('inventory-product-grid');
    const searchVal = document.getElementById('inventory-search').value.toLowerCase().trim();
    const filterCat = document.getElementById('inventory-filter-category').value;

    container.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.description.toLowerCase().includes(searchVal);
        const matchesCat = filterCat === 'all' || p.category === filterCat;
        
        // Calcular el stock total de este producto
        const prodInv = inventory.filter(inv => inv.product_id === p.id);
        const totalStock = prodInv.reduce((sum, item) => sum + item.stock, 0);

        // SOLO MOSTRAR PRENDAS CON STOCK ACTIVO EN ESTA PESTAÑA
        return matchesSearch && matchesCat && totalStock > 0;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: span 4; text-align: center; padding: 60px; color: var(--color-text-muted);">
                <i class="fas fa-boxes-packing" style="font-size: 3.5rem; margin-bottom: 16px; color: var(--color-gold-light); display:block; opacity:0.8;"></i>
                <h3 style="font-family:var(--font-display); font-size:1.5rem; color:var(--color-text-primary)">Sin Stock Disponible</h3>
                <p style="margin-top:6px; color:var(--color-text-secondary);">Todos tus modelos están registrados en la base de datos pero no poseen existencias físicas.</p>
                <p style="font-size:0.85rem; color:var(--color-text-muted); margin-top:8px;">Dirígete a la pestaña <strong>Base de Datos (Fichas)</strong> para registrar un ingreso de mercadería de forma manual o arrastrando un remito PDF.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        // Encontrar variantes asociadas a este producto
        const prodInv = inventory.filter(inv => inv.product_id === p.id);
        const totalStock = prodInv.reduce((sum, item) => sum + item.stock, 0);

        // Resolver foto inteligente con soporte multivariante de color
        const firstVariantColor = prodInv.length > 0 ? prodInv[0].color : "Negro";
        const displayImage = resolveProductImage(p, firstVariantColor);

        const card = document.createElement('div');
        card.className = 'card product-card';
        card.innerHTML = `
            <div class="product-image-container">
                <img src="${displayImage}" alt="${p.name}" class="product-image">
                <span class="product-category-tag">${p.category}</span>
                <span class="product-stock-tag badge ${totalStock > 3 ? 'badge-stock-in' : totalStock > 0 ? 'badge-stock-low' : 'badge-stock-out'}">
                    ${totalStock > 0 ? `Stock: ${totalStock} u.` : 'Sin Stock'}
                </span>
            </div>
            <div class="product-details">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                    <span style="font-size:0.68rem; color:var(--color-gold-light); font-weight:700; font-family:var(--font-display);">COD: ${p.supplier_code || '-'}</span>
                </div>
                <h4 class="product-name" style="margin-top:0;">${p.name}</h4>
                <div class="product-variants-preview">
                    ${prodInv.length > 0 
                        ? `Variantes: ${prodInv.map(v => `${v.size}(${v.color} ${v.piel || 'Vaca'})`).join(', ')}`
                        : '<span style="color:var(--color-danger)">Sin variantes definidas</span>'
                    }
                </div>
                <div class="product-price-row">
                    <div>
                        <div style="font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">Costo: $${p.cost_price}</div>
                        <div class="product-price">$${p.selling_price.toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                    </div>
                    <div class="admin-only-block" style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-edit-prod" data-id="${p.id}" style="padding: 8px 12px;" title="Editar Ficha / Stock"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-clear-stock" data-id="${p.id}" style="padding: 8px 12px;" title="Vaciar Stock de este modelo"><i class="fas fa-eraser"></i></button>
                    </div>
                </div>
            </div>
        `;

        // Vinculación de eventos de edición/eliminación
        const btnEdit = card.querySelector('.btn-edit-prod');
        const btnClear = card.querySelector('.btn-clear-stock');
        if (btnEdit) btnEdit.addEventListener('click', () => openProductFormModal(p.id));
        if (btnClear) btnClear.addEventListener('click', () => confirmClearStock(p.id, p.name));

        container.appendChild(card);
    });
}

// Poblar filtro dinámicamente según categorías reales
function populateCategoryFilter() {
    const filter = document.getElementById('inventory-filter-category');
    const posFilter = document.getElementById('pos-filter-category');
    const masterFilter = document.getElementById('master-filter-category');

    const categories = [...new Set(products.map(p => p.category))];

    // Preservar valor seleccionado
    const prevVal = filter.value;
    const prevPosVal = posFilter ? posFilter.value : 'all';
    const prevMasterVal = masterFilter ? masterFilter.value : 'all';

    const optsHtml = '<option value="all">Todas las Categorías</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');

    filter.innerHTML = optsHtml;
    filter.value = prevVal || 'all';

    if (posFilter) {
        posFilter.innerHTML = optsHtml;
        posFilter.value = prevPosVal || 'all';
    }

    if (masterFilter) {
        masterFilter.innerHTML = optsHtml;
        masterFilter.value = prevMasterVal || 'all';
    }
}

// ==========================================================================
// RENDERIZADOR: TABLA DE PRODUCTOS BASE (FICHAS TÉCNICAS)
// ==========================================================================
function renderMasterProductsTable() {
    const tableBody = document.getElementById('inventory-master-table-body');
    if (!tableBody) return;

    const searchInput = document.getElementById('master-search');
    const filterSelect = document.getElementById('master-filter-category');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const filterCat = filterSelect ? filterSelect.value : 'all';

    tableBody.innerHTML = '';

    const filtered = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || 
                              (p.supplier_code || '').toLowerCase().includes(searchVal) || 
                              (p.supplier_name || '').toLowerCase().includes(searchVal) ||
                              p.category.toLowerCase().includes(searchVal);
        const matchesCat = filterCat === 'all' || p.category === filterCat;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: 40px;">
                    <i class="fas fa-database" style="font-size: 2.5rem; margin-bottom: 12px; display:block; color:rgba(212,175,55,0.4);"></i>
                    <p>No se encontraron fichas de productos base registrados.</p>
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700; color:var(--color-gold-light); text-align:center;">${p.supplier_code || '<span style="color:var(--color-text-muted)">-</span>'}</td>
            <td style="font-weight:600; color:var(--color-text-secondary);">${p.supplier_name || 'BELIA Propia'}</td>
            <td style="font-weight:700; color:var(--color-text-primary);">${p.name}</td>
            <td><span class="product-category-tag" style="position:static; display:inline-block; border-color:var(--color-border); background-color:var(--color-bg-darker);">${p.category}</span></td>
            <td class="price-cell admin-only-cell" data-field="cost_price" data-id="${p.id}" title="Doble clic para editar" style="text-align:right; font-weight:600; color:var(--color-text-secondary); cursor:pointer; user-select:none; position:relative;">
                <span class="price-display">$${p.cost_price.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                <i class="fas fa-pen" style="font-size:0.6rem; margin-left:5px; opacity:0.35; vertical-align:middle;"></i>
            </td>
            <td class="price-cell admin-only-cell" data-field="selling_price" data-id="${p.id}" title="Doble clic para editar" style="text-align:right; font-weight:700; color:var(--color-text-primary); cursor:pointer; user-select:none; position:relative;">
                <span class="price-display">$${p.selling_price.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                <i class="fas fa-pen" style="font-size:0.6rem; margin-left:5px; opacity:0.35; vertical-align:middle;"></i>
            </td>
            <td class="admin-only-cell" style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn btn-success btn-load-stock-row" data-id="${p.id}" style="padding: 6px 12px; font-size:0.75rem;" title="Cargar Stock / Variantes"><i class="fas fa-plus"></i> Stock</button>
                    <button class="btn btn-secondary btn-edit-base-row" data-id="${p.id}" style="padding: 6px 10px;" title="Editar Ficha"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-secondary btn-duplicate-base-row" data-id="${p.id}" style="padding: 6px 10px; border-color:rgba(212,175,55,0.5); color:var(--color-gold-light);" title="Duplicar Ficha"><i class="fas fa-copy"></i></button>
                    <button class="btn btn-danger btn-delete-base-row" data-id="${p.id}" style="padding: 6px 10px;" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;

        // Eventos de acciones
        const btnLoadStockRow = tr.querySelector('.btn-load-stock-row');
        const btnEditBaseRow = tr.querySelector('.btn-edit-base-row');
        const btnDuplicateBaseRow = tr.querySelector('.btn-duplicate-base-row');
        const btnDeleteBaseRow = tr.querySelector('.btn-delete-base-row');
        if (btnLoadStockRow) btnLoadStockRow.addEventListener('click', () => openLoadStockModal(p.id));
        if (btnEditBaseRow) btnEditBaseRow.addEventListener('click', () => openBaseProductModal(p.id));
        if (btnDuplicateBaseRow) btnDuplicateBaseRow.addEventListener('click', () => duplicateBaseProduct(p.id));
        if (btnDeleteBaseRow) btnDeleteBaseRow.addEventListener('click', () => confirmDeleteProduct(p.id, p.name));

        // Edición inline de precios con doble clic
        tr.querySelectorAll('.price-cell').forEach(cell => {
            cell.addEventListener('dblclick', () => {
                if (cell.querySelector('input')) return; // ya está editando
                const field = cell.dataset.field;
                const currentVal = field === 'cost_price' ? p.cost_price : p.selling_price;
                const label = field === 'cost_price' ? 'Costo' : 'Precio Venta';

                // Reemplazar contenido con un input
                cell.innerHTML = `
                    <input type="number" step="0.01" min="0"
                        value="${currentVal}"
                        style="width:110px; background:var(--color-bg-darker); border:1.5px solid var(--color-gold-light);
                               color:var(--color-text-primary); border-radius:6px; padding:4px 8px;
                               font-size:0.85rem; font-weight:700; text-align:right; outline:none;"
                        title="Enter para guardar, Escape para cancelar">
                `;
                const input = cell.querySelector('input');
                input.focus();
                input.select();

                const cancelEdit = () => {
                    const displayVal = field === 'cost_price' ? p.cost_price : p.selling_price;
                    cell.innerHTML = `
                        <span class="price-display">$${displayVal.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                        <i class="fas fa-pen" style="font-size:0.6rem; margin-left:5px; opacity:0.35; vertical-align:middle;"></i>
                    `;
                };

                const saveEdit = async () => {
                    const newVal = parseFloat(input.value);
                    if (isNaN(newVal) || newVal < 0) {
                        showToast('Valor inválido', 'Ingresá un número mayor o igual a 0.', 'warning');
                        cancelEdit();
                        return;
                    }
                    if (newVal === currentVal) { cancelEdit(); return; }

                    // Actualizar el objeto en memoria
                    p[field] = newVal;

                    // Mostrar valor actualizado inmediatamente (optimistic UI)
                    cell.innerHTML = `
                        <span class="price-display" style="color:var(--color-gold-light);">$${newVal.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                        <i class="fas fa-pen" style="font-size:0.6rem; margin-left:5px; opacity:0.35; vertical-align:middle;"></i>
                    `;

                    try {
                        // Guardar en BD sin tocar variantes (null = no modificar variantes)
                        await saveProduct({ ...p }, null);
                        showToast('✓ Precio Actualizado', `${label} de "${p.name}" actualizado a $${newVal.toLocaleString('es-AR', {minimumFractionDigits:2})}`, 'success');
                        // Restaurar color normal
                        cell.querySelector('.price-display').style.color = '';
                    } catch (err) {
                        console.error(err);
                        showToast('Error', 'No se pudo guardar el precio.', 'danger');
                        p[field] = currentVal; // revertir
                        cancelEdit();
                    }
                };

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') { cancelEdit(); }
                });
                input.addEventListener('blur', saveEdit);
            });

            // Hover effect para indicar que es editable
            cell.addEventListener('mouseenter', () => {
                cell.style.background = 'rgba(212,175,55,0.06)';
                cell.style.borderRadius = '4px';
            });
            cell.addEventListener('mouseleave', () => {
                cell.style.background = '';
            });
        });

        tableBody.appendChild(tr);
    });
}

function populateMasterCategoryFilter() {
    const filter = document.getElementById('master-filter-category');
    if (!filter) return;

    const categories = [...new Set(products.map(p => p.category))];
    const prevVal = filter.value;

    filter.innerHTML = '<option value="all">Todas las Categorías</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    filter.value = prevVal || 'all';
}

// ==========================================================================
// DUPLICAR FICHA DE PRODUCTO
// ==========================================================================
async function duplicateBaseProduct(productId) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }

    const original = products.find(p => p.id === productId);
    if (!original) {
        showToast('Error', 'No se encontró el producto original.', 'danger');
        return;
    }

    // Obtener variantes del original (con stock 0 en la copia)
    const originalVariants = inventory.filter(v => v.product_id === productId);
    const copiedVariants = originalVariants.map(v => ({
        size: v.size,
        color: v.color,
        piel: v.piel || 'Vaca',
        stock: 0   // La copia siempre arranca con stock 0
    }));

    // Si no tiene variantes, agregar una por defecto
    if (copiedVariants.length === 0) {
        copiedVariants.push({ size: 'M', color: 'Negro', piel: 'Vaca', stock: 0 });
    }

    // Crear copia sin ID (para que se cree como nuevo)
    const copyProduct = {
        name: original.name + ' (COPIA)',
        category: original.category,
        description: original.description || '',
        cost_price: original.cost_price,
        selling_price: original.selling_price,
        image_url: original.image_url || '',
        supplier_code: original.supplier_code || '',
        supplier_name: original.supplier_name || 'BELIA Propia'
    };

    try {
        showToast('Duplicando...', `Creando copia de "${original.name}"`, 'info');
        const saved = await saveProduct(copyProduct, copiedVariants);
        showToast('¡Ficha Duplicada!', `Se creó una copia de "${original.name}" con stock 0. Podés editarla ahora.`, 'success');

        // Recargar datos y abrir el editor de la copia para que el usuario la ajuste
        await loadAndRefreshViews('inventory');
        const panelMaster = document.getElementById('panel-master-products');
        if (panelMaster && panelMaster.style.display !== 'none') {
            renderMasterProductsTable();
        }

        // Abrir el modal de edición de la copia automáticamente
        if (saved && saved.id) {
            setTimeout(() => openBaseProductModal(saved.id), 400);
        }
    } catch (err) {
        console.error(err);
        showToast('Error', 'No se pudo duplicar la ficha.', 'danger');
    }
}

// ==========================================================================
// FORMULARIO DE PRODUCTO BASE: REGISTRAR FICHA SIN VARIANTES OBLIGATORIAS
// ==========================================================================
function openBaseProductModal(productId = null) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const isEdit = !!productId;
    const prod = isEdit ? products.find(p => p.id === productId) : null;
    const modalTitleText = isEdit ? "Editar Ficha de Prenda Base" : "Registrar Ficha de Prenda Base";

    // Obtener variantes actuales si estamos editando
    const prodInv = isEdit ? inventory.filter(inv => inv.product_id === productId) : [];

    const modalHtml = `
        <form id="product-base-form" style="display:flex; flex-direction:column; gap:16px;">
            <input type="hidden" id="form-base-id" value="${escapeHtmlAttr(prod?.id)}">
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Código del Proveedor / Artículo</label>
                    <input type="text" id="form-base-code" class="form-input" placeholder="Ej: 105 o BL-VNZ" value="${escapeHtmlAttr(prod?.supplier_code)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Marca / Proveedor</label>
                    <input type="text" id="form-base-supplier" class="form-input" placeholder="Ej: SKULL Custom Leather" value="${escapeHtmlAttr(prod?.supplier_name || 'BELIA Propia')}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Nombre del Producto / Modelo *</label>
                <input type="text" id="form-base-name" class="form-input" required placeholder="Ej: Campera de Cuero 'DINAMITA 1'" value="${escapeHtmlAttr(prod?.name)}">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Categoría *</label>
                    <input type="text" id="form-base-category" class="form-input" required placeholder="Ej: Chaquetas, Gorras, Calzado" value="${escapeHtmlAttr(prod?.category)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Imagen URL (Opcional)</label>
                    <input type="url" id="form-base-image" class="form-input" placeholder="Dejar vacío para auto-vincular" value="${escapeHtmlAttr(prod?.image_url)}">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Precio de Costo ($) *</label>
                    <input type="number" step="0.01" id="form-base-cost" class="form-input" required placeholder="0.00" value="${escapeHtmlAttr(prod?.cost_price)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Precio de Venta ($) *</label>
                    <input type="number" step="0.01" id="form-base-selling" class="form-input" required placeholder="0.00" value="${escapeHtmlAttr(prod?.selling_price)}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Descripción de Estilo</label>
                <textarea id="form-base-desc" class="form-input" placeholder="Detalles del corte, tipo de cuero, forrería..." style="height:80px; resize:none;">${escapeHtmlAttr(prod?.description)}</textarea>
            </div>

            <!-- Variantes del Catálogo (Base de Datos) -->
            <div class="form-group" style="border-top:1px solid rgba(212, 175, 55, 0.15); padding-top:16px;">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:var(--color-gold-light); font-weight:700;"><i class="fas fa-tags"></i> Variantes del Modelo (Talles y Colores)</span>
                    <button type="button" class="btn btn-success" id="form-base-btn-add-variant" style="padding: 6px 12px; font-size:0.75rem;"><i class="fas fa-plus"></i> Agregar Variante</button>
                </label>
                <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:12px;">
                    Define los talles y colores en los que se fabrica este modelo (puedes dejarlos en stock 0).
                </div>
                <div class="variants-editor-container" id="form-base-variants-container" style="max-height: 200px; overflow-y: auto; padding-right: 4px;">
                    <!-- Se cargan dinámicamente -->
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" id="form-base-cancel">Cancelar</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Ficha' : 'Registrar Ficha Base'}</button>
            </div>
        </form>
    `;

    openModal(modalTitleText, modalHtml);

    const baseVariantsContainer = document.getElementById('form-base-variants-container');

    // Función para crear inputs de variantes en la ficha base
    function appendBaseVariantRow(size = 'M', color = 'Negro', stock = 0, piel = 'Vaca') {
        const div = document.createElement('div');
        div.className = 'variant-row-input';
        div.innerHTML = `
            <input type="text" class="form-input base-var-size" required placeholder="Talle (S, 39, etc.)" value="${escapeHtmlAttr(size)}" style="text-transform:uppercase;">
            <input type="text" class="form-input base-var-color" required placeholder="Color (Negro, Marrón)" value="${escapeHtmlAttr(color)}">
            <select class="form-input base-var-piel" style="width:100px;">
                <option value="Vaca" ${piel === 'Vaca' ? 'selected' : ''}>Vaca</option>
                <option value="Oveja" ${piel === 'Oveja' ? 'selected' : ''}>Oveja</option>
            </select>
            <input type="number" class="form-input base-var-stock" required min="0" placeholder="Stock Inicial" value="${escapeHtmlAttr(stock)}">
            <button type="button" class="btn btn-danger btn-remove-base-var" style="padding:10px;" title="Remover Variante"><i class="fas fa-trash"></i></button>
        `;

        div.querySelector('.btn-remove-base-var').addEventListener('click', () => {
            if (baseVariantsContainer.children.length > 1) {
                div.remove();
            } else {
                showToast('Aviso', 'Es recomendable tener al menos una variante de talle/color para el catálogo.', 'info');
                div.remove();
            }
        });

        baseVariantsContainer.appendChild(div);
    }

    // Botón agregar variante
    document.getElementById('form-base-btn-add-variant').addEventListener('click', () => {
        appendBaseVariantRow('M', 'Negro', 0, 'Vaca');
    });

    // Inyectar variantes actuales o pre-cargar talles clásicos con stock 0
    if (isEdit && prodInv.length > 0) {
        prodInv.forEach(v => appendBaseVariantRow(v.size, v.color, v.stock, v.piel || 'Vaca'));
    } else {
        appendBaseVariantRow('S', 'Negro', 0, 'Vaca');
        appendBaseVariantRow('M', 'Negro', 0, 'Vaca');
        appendBaseVariantRow('L', 'Negro', 0, 'Vaca');
    }

    document.getElementById('form-base-cancel').addEventListener('click', closeModal);
    document.getElementById('product-base-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('form-base-id').value;
        const name = document.getElementById('form-base-name').value.trim();
        const category = document.getElementById('form-base-category').value.trim();
        const image_url = document.getElementById('form-base-image').value.trim();
        const cost_price = parseFloat(document.getElementById('form-base-cost').value);
        const selling_price = parseFloat(document.getElementById('form-base-selling').value);
        const description = document.getElementById('form-base-desc').value.trim();
        const supplier_code = document.getElementById('form-base-code').value.trim();
        const supplier_name = document.getElementById('form-base-supplier').value.trim();

        // Agrupar variantes de la ficha base
        const variantRows = baseVariantsContainer.querySelectorAll('.variant-row-input');
        const variantsList = [];
        let hasValidationError = false;

        variantRows.forEach(row => {
            const sizeVal = row.querySelector('.base-var-size').value.trim().toUpperCase();
            const colorVal = row.querySelector('.base-var-color').value.trim();
            const pielVal = row.querySelector('.base-var-piel').value;
            const stockVal = parseInt(row.querySelector('.base-var-stock').value);

            if (!sizeVal || !colorVal || isNaN(stockVal) || stockVal < 0) {
                hasValidationError = true;
                return;
            }

            variantsList.push({ size: sizeVal, color: colorVal, piel: pielVal, stock: stockVal });
        });

        if (hasValidationError) {
            showToast('Formulario Incompleto', 'Completa todas las variantes con valores correctos.', 'warning');
            return;
        }

        try {
            const saveBtn = e.target.querySelector('button[type="submit"]');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            await saveProduct(
                { id, name, category, image_url, cost_price, selling_price, description, supplier_code, supplier_name },
                variantsList.length > 0 ? variantsList : null
            );
            
            showToast('¡Ficha Guardada!', `Se registró la ficha base de "${name}" y sus variantes con éxito.`, 'success');
            closeModal();
            
            // Recargar vistas generales
            await loadAndRefreshViews('inventory');
            
            // Si está activo el panel de fichas, asegurar su refresco
            const panelMaster = document.getElementById('panel-master-products');
            if (panelMaster && panelMaster.style.display !== 'none') {
                renderMasterProductsTable();
            }
        } catch (err) {
            console.error(err);
            showToast('Error al Guardar', 'No se pudo guardar la ficha técnica.', 'danger');
        }
    });
}

// ==========================================================================
// FORMULARIO DE CARGA DE STOCK: VINCULACIÓN DE VARIANTES A PRODUCTOS EXISTENTES
// ==========================================================================
function openLoadStockModal(productId = null) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const modalTitleText = "Registrar Ingreso de Stock (Mercadería)";

    let selectOptionsHtml = products.map(p => `
        <option value="${p.id}" ${p.id === productId ? 'selected' : ''}>
            [${p.supplier_code || '-'}] ${p.supplier_name || 'BELIA'} - ${p.name}
        </option>
    `).join('');

    const modalHtml = `
        <form id="product-stock-form" style="display:flex; flex-direction:column; gap:16px;">
            <div class="form-group">
                <label class="form-label">Seleccionar Prenda de la Base de Datos *</label>
                <select id="form-stock-product-id" class="form-input" required ${productId ? 'disabled' : ''} style="cursor:pointer;">
                    <option value="">-- Elige una prenda base para ingresar stock --</option>
                    ${selectOptionsHtml}
                </select>
                <div style="font-size:0.65rem; color:var(--color-text-muted); margin-top:4px;">
                    Elige el modelo que deseas cargar. Sus variantes de catálogo se cargarán automáticamente.
                </div>
            </div>

            <!-- Resumen de Características de la Prenda -->
            <div id="stock-product-preview-box" style="display:flex; align-items:center; gap:16px; padding:12px; border-radius:var(--radius-md); background:var(--color-bg-darker); border:1px solid var(--color-border); display:none;">
                <img id="stock-product-preview-img" src="LOGO.jpeg" style="width:60px; height:60px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--color-border-gold);">
                <div style="flex:1;">
                    <div id="stock-product-preview-name" style="font-size:0.95rem; font-weight:700; color:var(--color-gold-light);">Nombre de Prenda</div>
                    <div id="stock-product-preview-details" style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px;">Categoría • Precio</div>
                </div>
            </div>

            <!-- Listado de Variantes Existentes y Stock Entrante -->
            <div class="form-group">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
                    <span style="color:var(--color-gold-light); font-weight:700;"><i class="fas fa-boxes-packing"></i> Carga de Stock Entrante por Variante</span>
                </label>
                <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:12px;">
                    Indica la cantidad de unidades que ingresaron para cada variante. Las sumaremos automáticamente a la existencia actual.
                </div>
                
                <div id="stock-variants-table-wrapper" style="display:none; border:1px solid var(--color-border); border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-card);">
                    <div style="display:grid; grid-template-columns: 80px 100px 100px 90px 130px; align-items:center; background:rgba(212,175,55,0.05); padding:10px; font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid var(--color-border); color:var(--color-gold-light);">
                        <div style="text-align:center;">Talle</div>
                        <div>Color</div>
                        <div>Piel</div>
                        <div style="text-align:center;">Stock Actual</div>
                        <div style="text-align:center; color:var(--color-gold-light)">Ingresaron (+)</div>
                    </div>
                    <div id="form-stock-existing-container" style="max-height:220px; overflow-y:auto; background:var(--color-bg-card);">
                        <!-- Cargados dinámicamente -->
                    </div>
                </div>
            </div>

            <!-- Sección de Nuevas Variantes (Opcional) -->
            <div class="form-group" style="border-top:1px solid rgba(212, 175, 55, 0.15); padding-top:16px;">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>¿Llegó un talle o color nuevo no listado?</span>
                    <button type="button" class="btn btn-success" id="form-stock-btn-add-variant" style="padding: 6px 12px; font-size:0.75rem;"><i class="fas fa-plus"></i> Agregar Variante Nueva</button>
                </label>
                <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:8px;">
                    Si recibiste un talle o color que no estaba registrado para esta prenda, agrégalo aquí abajo con su cantidad entrante.
                </div>
                <div class="variants-editor-container" id="form-stock-variants-container">
                    <!-- Se cargan dinámicamente nuevas filas -->
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" id="form-stock-cancel">Cancelar</button>
                <button type="submit" class="btn btn-primary">Registrar Ingreso de Stock</button>
            </div>
        </form>
    `;

    openModal(modalTitleText, modalHtml);

    const productSelect = document.getElementById('form-stock-product-id');
    const previewBox = document.getElementById('stock-product-preview-box');
    const previewImg = document.getElementById('stock-product-preview-img');
    const previewName = document.getElementById('stock-product-preview-name');
    const previewDetails = document.getElementById('stock-product-preview-details');
    const existingContainer = document.getElementById('form-stock-existing-container');
    const variantsContainer = document.getElementById('form-stock-variants-container');
    const tableWrapper = document.getElementById('stock-variants-table-wrapper');

    // Función para recargar las variantes del producto seleccionado
    function onProductSelected() {
        const selectedId = productSelect.value;
        existingContainer.innerHTML = '';
        variantsContainer.innerHTML = ''; // Limpiar nuevas variantes agregadas

        if (!selectedId) {
            previewBox.style.display = 'none';
            tableWrapper.style.display = 'none';
            return;
        }

        const selectedProd = products.find(p => p.id === selectedId);
        if (!selectedProd) return;

        // Mostrar vista previa
        previewName.textContent = selectedProd.name;
        previewDetails.textContent = `Categoría: ${selectedProd.category} | Costo: $${selectedProd.cost_price.toLocaleString('es-AR')} | Venta: $${selectedProd.selling_price.toLocaleString('es-AR')}`;
        
        // Resolver imagen
        const prodInv = inventory.filter(inv => inv.product_id === selectedId);
        const firstColor = prodInv.length > 0 ? prodInv[0].color : "Negro";
        previewImg.src = resolveProductImage(selectedProd, firstColor);
        previewBox.style.display = 'flex';

        // Cargar variantes actuales de la base de datos
        if (prodInv.length > 0) {
            tableWrapper.style.display = 'block';
            prodInv.forEach(v => {
                const row = document.createElement('div');
                row.className = 'existing-variant-row';
                row.style = 'display:grid; grid-template-columns: 80px 100px 100px 90px 130px; align-items:center; border-bottom:1px solid var(--color-border); padding:10px; font-size:0.9rem;';
                
                row.innerHTML = `
                    <div style="text-align:center; font-weight:700; color:var(--color-text-primary); text-transform:uppercase;">${v.size}</div>
                    <div style="font-weight:600; color:var(--color-text-secondary);">${v.color}</div>
                    <div style="font-weight:600; color:var(--color-text-secondary);">${v.piel || 'Vaca'}</div>
                    <div style="text-align:center; font-weight:600; color:var(--color-text-muted);">${v.stock} uds</div>
                    <div style="text-align:center;">
                        <input type="number" class="form-input var-incoming" data-size="${v.size}" data-color="${v.color}" data-piel="${v.piel || 'Vaca'}" data-current="${v.stock}" data-sku="${v.sku || ''}" value="0" min="0" style="width: 100px; text-align: center; border: 1px solid var(--color-border-gold); font-weight:700; color:var(--color-gold-light); background:rgba(212,175,55,0.05); padding:6px;">
                    </div>
                `;
                existingContainer.appendChild(row);
            });
        } else {
            tableWrapper.style.display = 'block';
            const notice = document.createElement('div');
            notice.style = 'padding:24px; text-align:center; color:var(--color-text-muted); font-size:0.85rem;';
            notice.innerHTML = `<i class="fas fa-info-circle"></i> Esta prenda no tiene variantes de catálogo creadas. Cárgalas usando el botón inferior.`;
            existingContainer.appendChild(notice);
        }
    }

    // Función para crear inputs de variantes nuevas
    function appendVariantRow(size = 'M', color = 'Negro', piel = 'Vaca', incoming = 1) {
        const div = document.createElement('div');
        div.className = 'variant-row-input';
        div.innerHTML = `
            <input type="text" class="form-input var-size" required placeholder="Talle (S, M, 40)" value="${size}" style="text-transform:uppercase;">
            <input type="text" class="form-input var-color" required placeholder="Color (Negro, Marrón)" value="${color}">
            <select class="form-input var-piel" style="width:100px;">
                <option value="Vaca" ${piel === 'Vaca' ? 'selected' : ''}>Vaca</option>
                <option value="Oveja" ${piel === 'Oveja' ? 'selected' : ''}>Oveja</option>
            </select>
            <input type="number" class="form-input var-incoming-new" required min="0" placeholder="Entran" value="${incoming}">
            <button type="button" class="btn btn-danger btn-remove-var" style="padding:10px;" title="Remover"><i class="fas fa-trash"></i></button>
        `;

        div.querySelector('.btn-remove-var').addEventListener('click', () => {
            div.remove();
        });

        variantsContainer.appendChild(div);
    }

    // Escuchar cambio en el selector de productos
    productSelect.addEventListener('change', onProductSelected);

    // Botón agregar variante
    document.getElementById('form-stock-btn-add-variant').addEventListener('click', () => {
        appendVariantRow('M', 'Negro', 'Vaca', 1);
    });

    document.getElementById('form-stock-cancel').addEventListener('click', closeModal);

    // Si ya viene pre-seleccionado
    if (productId || productSelect.value) {
        onProductSelected();
    }

    // Envío del Formulario
    document.getElementById('product-stock-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedProductId = productSelect.value;
        if (!selectedProductId) {
            showToast('Selección Requerida', 'Por favor, elige un producto de la lista.', 'warning');
            return;
        }

        const selectedProd = products.find(p => p.id === selectedProductId);
        if (!selectedProd) return;

        const variantsList = [];
        
        // 1. Recolectar variantes existentes y sumarles el stock entrante
        const existingInputs = existingContainer.querySelectorAll('input.var-incoming');
        existingInputs.forEach(input => {
            const size = input.dataset.size;
            const color = input.dataset.color;
            const piel = input.dataset.piel || 'Vaca';
            const currentStock = parseInt(input.dataset.current) || 0;
            const incomingStock = parseInt(input.value) || 0;
            const sku = input.dataset.sku || '';

            // Suma del stock actual con el entrante
            const totalStock = currentStock + incomingStock;
            
            variantsList.push({
                size: size,
                color: color,
                piel: piel,
                stock: totalStock,
                sku: sku
            });
        });

        // 2. Recolectar variantes nuevas agregadas dinámicamente
        const newRows = variantsContainer.querySelectorAll('.variant-row-input');
        let hasValidationError = false;
        newRows.forEach(row => {
            const sizeVal = row.querySelector('.var-size').value.trim().toUpperCase();
            const colorVal = row.querySelector('.var-color').value.trim();
            const pielVal = row.querySelector('.var-piel').value;
            const incomingVal = parseInt(row.querySelector('.var-incoming-new').value) || 0;

            if (!sizeVal || !colorVal || isNaN(incomingVal) || incomingVal < 0) {
                hasValidationError = true;
                return;
            }

            // Comprobar si ya existe en la lista de guardado para acumularlo
            const dup = variantsList.find(v => v.size === sizeVal && v.color === colorVal && v.piel === pielVal);
            if (dup) {
                dup.stock += incomingVal;
            } else {
                variantsList.push({
                    size: sizeVal,
                    color: colorVal,
                    piel: pielVal,
                    stock: incomingVal
                });
            }
        });

        if (hasValidationError) {
            showToast('Formulario Incompleto', 'Completa todas las variantes con valores correctos.', 'warning');
            return;
        }

        try {
            const saveBtn = e.target.querySelector('button[type="submit"]');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando ingreso...';

            await saveProduct(selectedProd, variantsList);
            showToast('Ingreso Registrado', `Se cargó el ingreso de mercadería para "${selectedProd.name}" de forma exitosa.`, 'success');
            closeModal();
            
            // Recargar vistas generales
            await loadAndRefreshViews('inventory');
            
            // Si está activo el panel de fichas, asegurar su refresco
            const panelMaster = document.getElementById('panel-master-products');
            if (panelMaster && panelMaster.style.display !== 'none') {
                renderMasterProductsTable();
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo guardar el inventario.', 'danger');
        }
    });
}

function openProductFormModal(productId = null) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    // Redirigir a openBaseProductModal para mantener compatibilidad 100%
    openBaseProductModal(productId);
}

// Vaciar Stock de Prenda (Confirmación modal)
function confirmClearStock(id, name) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const confirmHtml = `
        <div style="text-align: center; display:flex; flex-direction:column; gap:16px;">
            <i class="fas fa-box-open" style="font-size:3.5rem; color:var(--color-gold-light)"></i>
            <p style="font-size:1.1rem; font-weight:600;">¿Deseas vaciar el stock de la prenda "${name}"?</p>
            <p style="font-size:0.85rem; color:var(--color-text-muted);">Esta acción pondrá las existencias de todas sus variantes en 0. La ficha técnica del producto se conservará en la pestaña 'Base de Datos (Fichas)'.</p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
                <button class="btn btn-secondary" id="confirm-clear-no">Cancelar</button>
                <button class="btn btn-danger" id="confirm-clear-yes">Vaciar Stock</button>
            </div>
        </div>
    `;

    openModal("Confirmar Vaciar Stock", confirmHtml);

    document.getElementById('confirm-clear-no').addEventListener('click', closeModal);
    document.getElementById('confirm-clear-yes').addEventListener('click', async () => {
        try {
            await clearProductStock(id);
            showToast('Stock Vaciado', `El stock de "${name}" se puso en 0. Se conservó la ficha en la Base de Datos.`, 'success');
            closeModal();
            loadAndRefreshViews('inventory');
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo vaciar el stock de la prenda.', 'danger');
        }
    });
}

// Eliminar Prenda (Confirmación modal)
function confirmDeleteProduct(id, name) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const confirmHtml = `
        <div style="text-align: center; display:flex; flex-direction:column; gap:16px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3.5rem; color:var(--color-danger)"></i>
            <p style="font-size:1.1rem; font-weight:600;">¿Estás seguro de que deseas eliminar la prenda "${name}"?</p>
            <p style="font-size:0.85rem; color:var(--color-text-muted);">Esta acción es irreversible y eliminará todas las variantes y existencias en stock de este modelo.</p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
                <button class="btn btn-secondary" id="confirm-del-no">Cancelar</button>
                <button class="btn btn-danger" id="confirm-del-yes">Eliminar Definitivamente</button>
            </div>
        </div>
    `;

    openModal("Confirmar Eliminación", confirmHtml);

    document.getElementById('confirm-del-no').addEventListener('click', closeModal);
    document.getElementById('confirm-del-yes').addEventListener('click', async () => {
        try {
            await deleteProduct(id);
            showToast('Prenda Eliminada', `"${name}" fue removido exitosamente del catálogo.`, 'success');
            closeModal();
            loadAndRefreshViews('inventory');
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo eliminar la prenda.', 'danger');
        }
    });
}

// ==========================================================================
// RENDERIZADOR: CLIENTES CRM (Base de Datos de Clientes)
// ==========================================================================
function renderCRMTable() {
    const tableBody = document.getElementById('crm-customers-body');
    tableBody.innerHTML = '';

    if (customers.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--color-text-muted); padding: 40px;">
                    <i class="fas fa-users-slash" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
                    <p>Aún no hay clientes registrados en el CRM.</p>
                </td>
            </tr>
        `;
        return;
    }

    customers.forEach(c => {
        const clientSales = sales.filter(s => s.customer_id === c.id);
        const purchaseCount = clientSales.length;
        const totalSpent = c.total_spent || 0;

        // Generar enlace de WhatsApp (WA.me) inteligente
        let phoneHtml = '<span style="color:var(--color-text-muted)">-</span>';
        if (c.phone) {
            let cleanPhone = c.phone.replace(/[^0-9]/g, '');
            if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
                cleanPhone = '549' + cleanPhone.substring(2);
            } else if (!cleanPhone.startsWith('54') && cleanPhone.length === 10) {
                cleanPhone = '549' + cleanPhone;
            }
            const waLink = `https://wa.me/${cleanPhone}`;
            phoneHtml = `
                <div style="display:inline-flex; align-items:center; gap:8px;">
                    <span>${c.phone}</span>
                    <a href="${waLink}" target="_blank" class="btn-whatsapp" title="Enviar WhatsApp" style="color:#25D366; font-size:1.15rem; display:inline-flex; align-items:center; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:700; color:var(--color-gold-light)" title="Notas: ${c.notes || 'Sin notas'}">
                ${c.first_name} ${c.last_name || ''}
                ${c.notes ? `<i class="fas fa-sticky-note crm-notes-indicator" style="margin-left:6px; font-size:0.8rem; color:var(--color-gold-light); cursor:pointer;" title="${c.notes}"></i>` : ''}
            </td>
            <td>${c.email || '<span style="color:var(--color-text-muted)">-</span>'}</td>
            <td>${phoneHtml}</td>
            <td style="text-align:center;"><span class="badge badge-stock-in" style="font-size:0.8rem;">${purchaseCount} compras</span></td>
            <td style="font-weight:700; color:var(--color-text-primary)">$${totalSpent.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
            <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn btn-secondary btn-crm-edit" data-id="${c.id}" style="padding: 6px 10px;" title="Ver Notas / Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-crm-delete" data-id="${c.id}" style="padding: 6px 10px;" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;

        // Eventos
        tr.querySelector('.btn-crm-edit').addEventListener('click', () => openCustomerFormModal(c.id));
        tr.querySelector('.btn-crm-delete').addEventListener('click', () => confirmDeleteCustomer(c.id, `${c.first_name} ${c.last_name || ''}`));
        
        if (c.notes) {
            tr.querySelector('.crm-notes-indicator').addEventListener('click', (e) => {
                e.stopPropagation();
                openCustomerFormModal(c.id);
            });
        }

        tableBody.appendChild(tr);
    });
}

// Formulario de Creación / Edición de Cliente
function openCustomerFormModal(customerId = null) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const isEdit = !!customerId;
    const cust = isEdit ? customers.find(c => c.id === customerId) : null;
    const modalTitleText = isEdit ? "Editar Cliente VIP" : "Agregar Cliente VIP";

    const formHtml = `
        <form id="crm-customer-form" style="display:flex; flex-direction:column; gap:16px;">
            <input type="hidden" id="crm-cust-id" value="${escapeHtmlAttr(cust?.id)}">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Nombre *</label>
                    <input type="text" id="crm-cust-first-name" class="form-input" required placeholder="Valentina" value="${escapeHtmlAttr(cust?.first_name)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Apellido</label>
                    <input type="text" id="crm-cust-last-name" class="form-input" placeholder="Rossi" value="${escapeHtmlAttr(cust?.last_name)}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Teléfono de Contacto</label>
                <input type="text" id="crm-cust-phone" class="form-input" placeholder="Ej: +54 11 5555 1234" value="${escapeHtmlAttr(cust?.phone)}">
            </div>
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="crm-cust-email" class="form-input" placeholder="valentina.rossi@example.com" value="${escapeHtmlAttr(cust?.email)}">
            </div>
            <div class="form-group">
                <label class="form-label">Preferencias / Medidas del Cliente / Notas</label>
                <textarea id="crm-cust-notes" class="form-input" placeholder="Talle preferido, colores favoritos, modelo de campera consultado..." style="height:100px; resize:none;">${escapeHtmlAttr(cust?.notes)}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" id="crm-cust-cancel">Cancelar</button>
                <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Registrar Cliente'}</button>
            </div>
        </form>
    `;

    openModal(modalTitleText, formHtml);

    document.getElementById('crm-cust-cancel').addEventListener('click', closeModal);
    document.getElementById('crm-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('crm-cust-id').value;
        const first_name = document.getElementById('crm-cust-first-name').value.trim();
        const last_name = document.getElementById('crm-cust-last-name').value.trim();
        const phone = document.getElementById('crm-cust-phone').value.trim();
        const email = document.getElementById('crm-cust-email').value.trim();
        const notes = document.getElementById('crm-cust-notes').value.trim();

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            await saveCustomer({ id: id || undefined, first_name, last_name, phone, email, notes });
            showToast('CRM Actualizado', `Se guardó al cliente ${first_name} de forma exitosa.`, 'success');
            closeModal();
            
            const activeSection = document.querySelector('.page-view.active');
            const activePage = activeSection ? activeSection.id.replace('-view', '') : 'crm';
            await loadAndRefreshViews(activePage);
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo guardar el cliente en la base de datos.', 'danger');
        }
    });
}

// Confirmación para eliminar cliente
function confirmDeleteCustomer(id, name) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }
    const confirmHtml = `
        <div style="text-align: center; display:flex; flex-direction:column; gap:16px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3.5rem; color:var(--color-danger)"></i>
            <p style="font-size:1.1rem; font-weight:600;">¿Estás seguro de que deseas eliminar al cliente "${name}"?</p>
            <p style="font-size:0.85rem; color:var(--color-text-muted);">Esta acción eliminará al cliente del CRM de forma irreversible. Los registros de ventas históricas asociadas a este cliente se mantendrán pero figurarán como cliente eliminado.</p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
                <button class="btn btn-secondary" id="confirm-cust-del-no">Cancelar</button>
                <button class="btn btn-danger" id="confirm-cust-del-yes">Eliminar Cliente</button>
            </div>
        </div>
    `;

    openModal("Confirmar Eliminación", confirmHtml);

    document.getElementById('confirm-cust-del-no').addEventListener('click', closeModal);
    document.getElementById('confirm-cust-del-yes').addEventListener('click', async () => {
        try {
            await deleteCustomer(id);
            showToast('Cliente Eliminado', `"${name}" fue removido exitosamente del CRM.`, 'success');
            closeModal();
            
            const activeSection = document.querySelector('.page-view.active');
            const activePage = activeSection ? activeSection.id.replace('-view', '') : 'crm';
            
            if (activePage === 'sales') {
                if (typeof setPOSSelectedCustomer === 'function') {
                    setPOSSelectedCustomer(null);
                }
            }
            
            await loadAndRefreshViews(activePage);
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo eliminar al cliente.', 'danger');
        }
    });
}

// Registrar Cliente desde Módulo CRM
function initCRMModule() {
    const btnNewCustomer = document.getElementById('crm-btn-new-customer');
    if (!btnNewCustomer) return;

    btnNewCustomer.addEventListener('click', () => {
        openCustomerFormModal();
    });
}

// ==========================================================================
// RENDERIZADOR: CONFIGURACIÓN SUPABASE & SQL ENGINE
// ==========================================================================
function renderSettingsPanel() {
    const creds = getCredentials();
    document.getElementById('settings-supabase-url').value = creds.url;
    document.getElementById('settings-supabase-key').value = creds.key;

    const connectionStatusBox = document.getElementById('settings-connection-status');
    
    if (isDemoMode()) {
        connectionStatusBox.innerHTML = `
            <div style="padding:16px; border-radius:var(--radius-md); background-color:rgba(245, 158, 11, 0.08); border:1px solid rgba(245, 158, 11, 0.25); display:flex; align-items:center; gap:16px;">
                <i class="fas fa-exclamation-triangle" style="font-size:1.8rem; color:var(--color-gold-light)"></i>
                <div>
                    <strong style="color:var(--color-gold-light)">Ejecutando en Modo Demo (Local)</strong>
                    <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">Los datos se guardan localmente en el navegador. Conéctate a Supabase para tener persistencia en la nube en tiempo real.</p>
                </div>
            </div>
        `;
    } else {
        connectionStatusBox.innerHTML = `
            <div style="padding:16px; border-radius:var(--radius-md); background-color:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.25); display:flex; align-items:center; gap:16px;">
                <i class="fas fa-check-circle" style="font-size:1.8rem; color:var(--color-success)"></i>
                <div>
                    <strong style="color:var(--color-success)">Sincronización Supabase Activa</strong>
                    <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:2px;">El sistema está guardando y cargando el inventario, ventas y clientes directamente desde la nube de Supabase.</p>
                </div>
            </div>
            
            <div style="margin-top: 16px; padding: 16px; border-radius: var(--radius-md); background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.25);">
                <strong style="color:var(--color-gold-light); display:block; margin-bottom:6px;"><i class="fas fa-database"></i> ¿Base de datos nueva o vacía en Supabase?</strong>
                <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:12px;">Carga masivamente los 5 productos base, variantes de stock y clientes del presupuesto SKULL y demostración de BELIA de forma online a tu Supabase en 1 solo clic.</p>
                <button type="button" class="btn btn-primary" id="btn-seed-supabase" style="padding: 8px 16px; font-size: 0.8rem;">
                    <i class="fas fa-cloud-arrow-up"></i> Semillar Datos en Supabase
                </button>
            </div>
        `;
        
        // Vincular listener de semillado interactivo
        setTimeout(() => {
            const btnSeed = document.getElementById('btn-seed-supabase');
            if (btnSeed) {
                btnSeed.addEventListener('click', async () => {
                    try {
                        btnSeed.disabled = true;
                        btnSeed.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Semillando Supabase...';
                        
                        const res = await seedSupabaseDatabase();
                        showToast('¡Base de Datos Semillada!', `Se cargaron ${res.count} productos de demostración con su stock y clientes VIP en Supabase.`, 'success');
                        
                        // Recargar la vista de configuración
                        loadAndRefreshViews('settings');
                    } catch (err) {
                        console.error(err);
                        showToast('Error al Semillar', `No se pudo completar la carga: ${err.message || err}`, 'danger');
                    } finally {
                        btnSeed.disabled = false;
                        btnSeed.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Semillar Datos en Supabase';
                    }
                });
            }
        }, 100);
    }

    // Configurar Caja de Código SQL
    const codeBlock = document.getElementById('supabase-sql-code');
    codeBlock.textContent = SUPABASE_SQL_SETUP;

    const btnCopySql = document.getElementById('btn-copy-sql');
    if (btnCopySql) {
        btnCopySql.addEventListener('click', () => {
            navigator.clipboard.writeText(SUPABASE_SQL_SETUP).then(() => {
                showToast('Copiado al Portapapeles', 'El script SQL de inicialización está listo para pegar en Supabase.', 'success');
            }).catch(err => {
                console.error(err);
                showToast('Error', 'No se pudo copiar el código automáticamente.', 'danger');
            });
        });
    }

    // Renderizar la tabla de usuarios en settings
    renderUsersTable();
}

function initSettingsModule() {
    const form = document.getElementById('settings-supabase-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = document.getElementById('settings-supabase-url').value.trim();
            const key = document.getElementById('settings-supabase-key').value.trim();

            if (url && key) {
                const success = setSupabaseCredentials(url, key);
                if (success) {
                    showToast('Conectado con Éxito', 'Las credenciales de Supabase fueron configuradas. Sincronizando...', 'success');
                } else {
                    showToast('Credenciales Guardadas', 'Se guardaron las credenciales, pero verifica que la librería Supabase cargue.', 'warning');
                }
            } else {
                setSupabaseCredentials('', '');
                showToast('Desconectado', 'Se removieron las credenciales. Has regresado al Modo Demo.', 'info');
            }

            loadAndRefreshViews('settings');
        });
    }

    const userForm = document.getElementById('settings-user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('user-form-id').value;
            const name = document.getElementById('user-form-name').value.trim();
            const password = document.getElementById('user-form-password').value.trim();
            const role = document.getElementById('user-form-role').value;

            if (!name || !password || !role) {
                showToast('Campos Incompletos', 'Por favor, rellena todos los campos requeridos.', 'warning');
                return;
            }

            const currentUsers = await getUsers();

            // Validar que la contraseña sea única
            const passwordCollision = currentUsers.find(u => u.password === password && u.id !== id);
            if (passwordCollision) {
                showToast('Clave en Uso', `La contraseña ya está asignada al usuario "${passwordCollision.name}". Elige otra clave única.`, 'danger');
                return;
            }

            if (id) {
                // Editar usuario existente
                const idx = currentUsers.findIndex(u => u.id === id);
                if (idx !== -1) {
                    // Si se está intentando cambiar el rol del último admin, bloquear
                    if (currentUsers[idx].role === 'admin' && role !== 'admin') {
                        const otherAdmins = currentUsers.filter(u => u.role === 'admin' && u.id !== id);
                        if (otherAdmins.length === 0) {
                            showToast('Operación Bloqueada', 'Debe haber al menos un Administrador activo en el sistema.', 'danger');
                            return;
                        }
                    }
                    
                    const userToSave = {
                        id: id,
                        name: name,
                        password: password,
                        role: role,
                        created_at: currentUsers[idx].created_at
                    };
                    await saveUser(userToSave);
                    showToast('Usuario Actualizado', `El usuario "${name}" se actualizó correctamente.`, 'success');
                }
            } else {
                // Crear nuevo usuario
                const userToSave = {
                    name,
                    password,
                    role
                };
                await saveUser(userToSave);
                showToast('Usuario Creado', `El usuario "${name}" fue registrado con éxito.`, 'success');
            }

            resetUserForm();
            await renderUsersTable();
        });
    }

    const btnCancel = document.getElementById('btn-user-form-cancel');
    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            resetUserForm();
        });
    }
}

// ==========================================================================
// MÓDULO: CALCULADORA DE FINANCIACIÓN
// ==========================================================================
let isCalculatorInitialized = false;

function initCalculatorModule() {
    const selectProd = document.getElementById('calc-select-product');
    const inputPrice = document.getElementById('calc-input-price');
    const pctCash = document.getElementById('calc-pct-cash');
    const pctTransfer = document.getElementById('calc-pct-transfer');
    const pctCard1 = document.getElementById('calc-pct-card-1');
    const pctCard3 = document.getElementById('calc-pct-card-3');
    const pctCard6 = document.getElementById('calc-pct-card-6');
    const pctCard9 = document.getElementById('calc-pct-card-9');
    const btnCopy = document.getElementById('calc-btn-copy');
    const btnCopyShipping = document.getElementById('calc-btn-copy-shipping');

    if (!selectProd) return;

    // Poblar desplegable de productos del catálogo si no se ha hecho o cambia
    selectProd.innerHTML = '<option value="">-- Ingresar precio manual --</option>';
    products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.selling_price;
        opt.dataset.name = p.name;
        opt.textContent = `${p.name} ($${p.selling_price.toLocaleString('es-AR')})`;
        selectProd.appendChild(opt);
    });

    // Vincular listeners para recálculos en tiempo real
    if (!isCalculatorInitialized) {
        const inputs = [inputPrice, pctCash, pctTransfer, pctCard1, pctCard3, pctCard6, pctCard9];
        inputs.forEach(input => {
            input.addEventListener('input', runCalculatorCalculations);
        });

        selectProd.addEventListener('change', (e) => {
            const selectedPrice = e.target.value;
            if (selectedPrice) {
                inputPrice.value = parseFloat(selectedPrice);
            }
            runCalculatorCalculations();
        });

        btnCopy.addEventListener('click', copyCalculatorSummaryToClipboard);
        if (btnCopyShipping) {
            btnCopyShipping.addEventListener('click', copyCalculatorShippingToClipboard);
        }
        isCalculatorInitialized = true;
    }

    // Ejecutar recálculo inicial
    runCalculatorCalculations();
}

function runCalculatorCalculations() {
    const basePrice = parseFloat(document.getElementById('calc-input-price').value) || 0;
    
    // Obtener porcentajes
    const pctCash = parseFloat(document.getElementById('calc-pct-cash').value) || 0;
    const pctTransfer = parseFloat(document.getElementById('calc-pct-transfer').value) || 0;
    const pctCard1 = parseFloat(document.getElementById('calc-pct-card-1').value) || 0;
    const pctCard3 = parseFloat(document.getElementById('calc-pct-card-3').value) || 0;
    const pctCard6 = parseFloat(document.getElementById('calc-pct-card-6').value) || 0;
    const pctCard9 = parseFloat(document.getElementById('calc-pct-card-9').value) || 0;

    // Calcular precios totales
    const priceCash = basePrice * (1 + (pctCash / 100));
    const priceTransfer = basePrice * (1 + (pctTransfer / 100));
    const priceCard1 = basePrice * (1 + (pctCard1 / 100));
    const priceCard3 = basePrice * (1 + (pctCard3 / 100));
    const priceCard6 = basePrice * (1 + (pctCard6 / 100));
    const priceCard9 = basePrice * (1 + (pctCard9 / 100));

    // Renderizar totales
    document.getElementById('calc-res-cash').textContent = `$${priceCash.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('calc-res-transfer').textContent = `$${priceTransfer.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('calc-res-card-1').textContent = `$${priceCard1.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('calc-res-card-3').textContent = `$${priceCard3.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('calc-res-card-6').textContent = `$${priceCard6.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('calc-res-card-9').textContent = `$${priceCard9.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

    // Renderizar detalles / notas
    document.getElementById('calc-cash-badge').textContent = pctCash < 0 ? `(${pctCash}% Desc. Aplicado)` : (pctCash > 0 ? `(+${pctCash}% Recargo)` : '(Sin recargos)');
    document.getElementById('calc-transfer-badge').textContent = pctTransfer < 0 ? `(${pctTransfer}% Desc. Aplicado)` : (pctTransfer > 0 ? `(+${pctTransfer}% Recargo)` : '(Sin recargos)');
    document.getElementById('calc-card1-badge').textContent = pctCard1 > 0 ? `(+${pctCard1}% Recargo de Financiación)` : '(Sin recargos)';

    const installment3 = priceCard3 / 3;
    document.getElementById('calc-res-card-3-installment').textContent = `3 cuotas fijas de $${installment3.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

    const installment6 = priceCard6 / 6;
    document.getElementById('calc-res-card-6-installment').textContent = `6 cuotas fijas de $${installment6.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

    const installment9 = priceCard9 / 9;
    document.getElementById('calc-res-card-9-installment').textContent = `9 cuotas fijas de $${installment9.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
}

function copyCalculatorSummaryToClipboard() {
    const basePrice = parseFloat(document.getElementById('calc-input-price').value) || 0;
    const selectProd = document.getElementById('calc-select-product');
    const selectedOpt = selectProd.options[selectProd.selectedIndex];
    
    const productName = selectedOpt.value ? selectedOpt.dataset.name : "Prenda Seleccionada";
    
    // Obtener porcentajes
    const pctCash = parseFloat(document.getElementById('calc-pct-cash').value) || 0;
    const pctTransfer = parseFloat(document.getElementById('calc-pct-transfer').value) || 0;
    const pctCard1 = parseFloat(document.getElementById('calc-pct-card-1').value) || 0;
    const pctCard3 = parseFloat(document.getElementById('calc-pct-card-3').value) || 0;
    const pctCard6 = parseFloat(document.getElementById('calc-pct-card-6').value) || 0;
    const pctCard9 = parseFloat(document.getElementById('calc-pct-card-9').value) || 0;

    // Calcular precios totales
    const priceCash = basePrice * (1 + (pctCash / 100));
    const priceTransfer = basePrice * (1 + (pctTransfer / 100));
    const priceCard1 = basePrice * (1 + (pctCard1 / 100));
    const priceCard3 = basePrice * (1 + (pctCard3 / 100));
    const priceCard6 = basePrice * (1 + (pctCard6 / 100));
    const priceCard9 = basePrice * (1 + (pctCard9 / 100));

    const installment3 = priceCard3 / 3;
    const installment6 = priceCard6 / 6;
    const installment9 = priceCard9 / 9;

    const fmt = (num) => `$${num.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;

    const summaryText = 
`¡Hola! Muchas gracias por elegirnos. Te compartimos el detalle de los valores y las opciones de financiación para tu ${productName !== "Prenda Seleccionada" ? `prenda de cuero seleccionada (*${productName}*)` : "prenda de cuero seleccionada"}: 🤎

*Valor Lista:* ${fmt(basePrice)}

*Formas de pago:* ✨
• *Efectivo / Contado:* ${fmt(priceCash)}${pctCash < 0 ? ` (${Math.abs(pctCash)}% de descuento)` : ''}
• *Transferencia bancaria:* ${fmt(priceTransfer)}
• *Tarjeta en 1 pago:* ${fmt(priceCard1)}

*Planes en cuotas fijas:* 🗓️
• *3 cuotas de ${fmt(installment3)}* (Total: ${fmt(priceCard3)})
• *6 cuotas de ${fmt(installment6)}* (Total: ${fmt(priceCard6)})
• *9 cuotas de ${fmt(installment9)}* (Total: ${fmt(priceCard9)})

_Tené en cuenta que esta cotización mantiene su valor por el día de hoy. Si tenés alguna duda con los talles o las opciones de pago, escribinos por acá y te asesoramos en lo que necesites._ ¡Muchas gracias!`;

    navigator.clipboard.writeText(summaryText).then(() => {
        showToast('Cotización Copiada', 'El resumen está en el portapapeles listo para enviar por WhatsApp.', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Error', 'No se pudo copiar el resumen automáticamente.', 'danger');
    });
}

function copyCalculatorShippingToClipboard() {
    const summaryText = 
`¡Muchísimas gracias por tu compra y por elegirnos! 🤎 Para poder organizar el envío de tu prenda, por favor completanos los siguientes datos: ✈️

*Opción 1: Envío a Domicilio* 🏠
• *Nombre completo:* 
• *DNI:* 
• *Teléfono:* 
• *Domicilio:* 
• *Ciudad:* 
• *Provincia:* 
• *Código Postal:* 

─────────────────────
*Opción 2: Retiro en Sucursal Andreani* 📦
• *Nombre completo:* 
• *DNI:* 
• *Teléfono:* 
• *Localidad / Sucursal Andreani:* 
• *Provincia:* 

_Copia este mensaje para tu facilidad y rellenalo con tus datos. ¡Muchas gracias!_`;

    navigator.clipboard.writeText(summaryText).then(() => {
        showToast('Datos de Envío Copiados', 'La plantilla de datos de envío se copió al portapapeles.', 'success');
    }).catch(err => {
        console.error(err);
        showToast('Error', 'No se pudo copiar la plantilla automáticamente.', 'danger');
    });
}

// ==========================================================================
// MÓDULO: GESTIÓN DE BASE DE FOTOS AUTOADMINISTRABLE
// ==========================================================================
async function renderPhotosView() {
    const tableBody = document.getElementById('photos-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align:center; padding:40px; color:var(--color-text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem; margin-bottom:12px; color:var(--color-gold);"></i>
                <div>Cargando base de fotos...</div>
            </td>
        </tr>
    `;

    try {
        const photosList = await getCustomPhotos();
        tableBody.innerHTML = '';

        if (photosList.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding:40px; color:var(--color-text-muted);">
                        <i class="fas fa-images" style="font-size:2.5rem; margin-bottom:12px;"></i>
                        <h4 style="font-family:var(--font-display); font-size:1.15rem; color:var(--color-text-primary)">No hay fotos vinculadas</h4>
                        <p style="font-size:0.8rem; margin-top:4px;">Carga imágenes personalizadas para que se auto-vinculen por talle y color.</p>
                    </td>
                </tr>
            `;
            return;
        }

        photosList.forEach(photo => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align:center; padding:12px;">
                    <img src="${photo.image_url}" style="width:60px; height:60px; object-fit:cover; border-radius:var(--radius-sm); border:1px solid var(--color-border-gold);" onerror="this.src='LOGO.jpeg'">
                </td>
                <td style="font-weight:600; color:var(--color-text-primary);">${photo.title}</td>
                <td>
                    <span class="badge" style="background-color:rgba(212,175,55,0.08); border:1px solid var(--color-border-gold); color:var(--color-gold-light); font-size:0.75rem; padding:4px 8px; border-radius:var(--radius-sm);">${photo.color}</span>
                </td>
                <td style="font-size:0.8rem; font-family:monospace; color:var(--color-text-secondary); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    <a href="${photo.image_url}" target="_blank" style="color:var(--color-gold-light); text-decoration:underline;">${photo.image_url}</a>
                </td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:8px;">
                        <button class="btn btn-secondary btn-edit-photo" data-id="${photo.id}" style="padding:8px 12px;"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger btn-delete-photo" data-id="${photo.id}" style="padding:8px 12px;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            `;

            tr.querySelector('.btn-edit-photo').addEventListener('click', () => openPhotoFormModal(photo.id));
            tr.querySelector('.btn-delete-photo').addEventListener('click', () => confirmDeletePhoto(photo.id, photo.title, photo.color));

            tableBody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error al renderizar biblioteca de fotos:", e);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:40px; color:var(--color-danger);">
                    <i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:12px;"></i>
                    <div>Error al cargar la base de fotos.</div>
                </td>
            </tr>
        `;
    }
}

function openPhotoFormModal(photoId = null) {
    const isEdit = !!photoId;
    const photo = isEdit ? cachedCustomPhotos.find(p => p.id === photoId) : null;
    const modalTitleText = isEdit ? "Editar Vinculación de Fotos" : "Vincular Nuevas Fotos de Cuero";

    // Obtener nombres de productos únicos de la base de datos
    const uniqueProductNames = [...new Set(products.map(p => p.name))].sort();

    const modalHtml = `
        <form id="photo-upsert-form" style="display:flex; flex-direction:column; gap:16px; min-width:320px;">
            <input type="hidden" id="form-photo-id" value="${escapeHtmlAttr(photo?.id)}">
            
            <div class="form-group">
                <label class="form-label">Seleccionar Prenda del Catálogo *</label>
                <select id="form-photo-product-select" class="form-input" style="cursor:pointer; padding:8px 12px;">
                    <option value="">-- Elige una prenda --</option>
                    ${uniqueProductNames.map(name => `<option value="${escapeHtmlAttr(name)}" ${photo?.title === name ? 'selected' : ''}>${escapeHtmlAttr(name)}</option>`).join('')}
                    <option value="custom" ${photo && !uniqueProductNames.includes(photo.title) ? 'selected' : ''}>[Ingresar nombre manualmente]</option>
                </select>
            </div>

            <div class="form-group" id="form-photo-title-container" style="display: none;">
                <label class="form-label">Título / Modelo de Prenda (Manual) *</label>
                <input type="text" id="form-photo-title" class="form-input" placeholder="Ej: Chaqueta Biker de Cuero 'Venezia'" value="${escapeHtmlAttr(photo?.title)}">
            </div>

            <!-- Contenedor dinámico de variantes de color y enlaces -->
            <div class="form-group" style="border-top:1px solid rgba(212, 175, 55, 0.15); padding-top:16px;">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span style="color:var(--color-gold-light); font-weight:700;"><i class="fas fa-images"></i> Enlaces de Fotos por Variante de Color</span>
                    <button type="button" class="btn btn-success" id="form-photo-btn-add-row" style="padding: 4px 10px; font-size:0.75rem; display:none;"><i class="fas fa-plus"></i> Agregar Color</button>
                </label>
                <div style="font-size:0.7rem; color:var(--color-text-muted); margin-bottom:12px;">
                    Asigna un enlace de imagen para cada color de este producto. Los enlaces vacíos se descartarán o desvincularán.
                </div>
                <div id="form-photo-links-container" style="display:flex; flex-direction:column; gap:10px; max-height:260px; overflow-y:auto; padding-right:4px;">
                    <!-- Rellenado dinámicamente -->
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:16px; margin-top:20px;">
                <button type="button" class="btn btn-secondary" id="form-photo-cancel">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar Fotos</button>
            </div>
        </form>
    `;

    openModal(modalTitleText, modalHtml);

    const productSelect = document.getElementById('form-photo-product-select');
    const titleContainer = document.getElementById('form-photo-title-container');
    const titleInput = document.getElementById('form-photo-title');
    const linksContainer = document.getElementById('form-photo-links-container');
    const btnAddRow = document.getElementById('form-photo-btn-add-row');

    function appendManualPhotoRow(color = '', url = '') {
        const div = document.createElement('div');
        div.className = 'photo-link-row-manual';
        div.style = 'display:grid; grid-template-columns: 130px 1fr 40px; align-items:center; gap:10px;';
        div.innerHTML = `
            <input type="text" class="form-input row-photo-color" required placeholder="Color (ej: Negro)" value="${escapeHtmlAttr(color)}">
            <input type="url" class="form-input row-photo-url" placeholder="https://ejemplo.com/imagen.jpg" value="${escapeHtmlAttr(url)}">
            <button type="button" class="btn btn-danger btn-remove-photo-row" style="padding:10px;" title="Remover"><i class="fas fa-trash"></i></button>
        `;
        
        div.querySelector('.btn-remove-photo-row').addEventListener('click', () => {
            div.remove();
        });
        
        linksContainer.appendChild(div);
    }

    // El color o badge no tienen comillas normalmente, pero es buena práctica escapar.
    function appendProductPhotoRow(color, url = '') {
        const div = document.createElement('div');
        div.className = 'photo-link-row-product';
        div.style = 'display:grid; grid-template-columns: 130px 1fr; align-items:center; gap:10px;';
        div.innerHTML = `
            <span class="badge" style="background-color:rgba(212,175,55,0.08); border:1px solid var(--color-border-gold); color:var(--color-gold-light); font-size:0.8rem; padding:8px 12px; border-radius:var(--radius-sm); text-align:center; font-weight:700; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtmlAttr(color)}</span>
            <input type="url" class="form-input row-photo-url" data-color="${escapeHtmlAttr(color)}" placeholder="Pegar URL de foto para color ${escapeHtmlAttr(color.toLowerCase())}" value="${escapeHtmlAttr(url)}">
        `;
        linksContainer.appendChild(div);
    }

    function handleProductChange() {
        const val = productSelect.value;
        linksContainer.innerHTML = '';
        
        if (val === 'custom') {
            titleContainer.style.display = 'block';
            titleInput.value = '';
            titleInput.required = true;
            btnAddRow.style.display = 'inline-flex';
            
            // Agregar una fila inicial vacía
            appendManualPhotoRow('', '');
        } else if (val) {
            titleContainer.style.display = 'none';
            titleInput.value = val;
            titleInput.required = false;
            btnAddRow.style.display = 'inline-flex'; // Siempre habilitar para agregar otras variantes
            
            // Buscar variantes del catálogo para este producto
            const selectedProd = products.find(p => p.name === val);
            if (selectedProd) {
                const prodInv = inventory.filter(inv => inv.product_id === selectedProd.id);
                const inventoryColors = prodInv.map(v => v.color);
                
                // Obtener colores ya vinculados para este nombre de producto en la base de fotos
                const savedColors = cachedCustomPhotos
                    .filter(p => p.title.toLowerCase() === val.toLowerCase())
                    .map(p => p.color);
                
                // Unión de colores (inventario + guardados) sin duplicados
                const allColors = [...new Set([...inventoryColors, ...savedColors])];
                
                if (allColors.length > 0) {
                    allColors.forEach(color => {
                        // Buscar si ya tiene foto vinculada en cachedCustomPhotos
                        const existingPhoto = cachedCustomPhotos.find(p => p.title.toLowerCase() === val.toLowerCase() && p.color.toLowerCase() === color.toLowerCase());
                        const existingUrl = existingPhoto ? existingPhoto.image_url : '';
                        appendProductPhotoRow(color, existingUrl);
                    });
                } else {
                    // Fallback por defecto si no hay colores en stock ni fotos
                    appendManualPhotoRow('Negro', '');
                }
            }
        } else {
            titleContainer.style.display = 'none';
            titleInput.value = '';
            titleInput.required = false;
            btnAddRow.style.display = 'none';
        }
    }

    productSelect.addEventListener('change', handleProductChange);
    btnAddRow.addEventListener('click', () => appendManualPhotoRow('', ''));

    document.getElementById('form-photo-cancel').addEventListener('click', closeModal);

    // Si es edición, pre-cargar el estado
    if (isEdit && photo) {
        const isCustom = !uniqueProductNames.includes(photo.title);
        if (isCustom) {
            productSelect.value = 'custom';
            titleContainer.style.display = 'block';
            titleInput.value = photo.title;
            btnAddRow.style.display = 'inline-flex';
            
            // Cargar todas las fotos de este producto manual
            const relatedPhotos = cachedCustomPhotos.filter(p => p.title.toLowerCase() === photo.title.toLowerCase());
            if (relatedPhotos.length > 0) {
                relatedPhotos.forEach(rp => appendManualPhotoRow(rp.color, rp.image_url));
            } else {
                appendManualPhotoRow(photo.color, photo.image_url);
            }
        } else {
            productSelect.value = photo.title;
            titleContainer.style.display = 'none';
            titleInput.value = photo.title;
            btnAddRow.style.display = 'inline-flex'; // Habilitar siempre
            
            // Cargar variantes del producto uniendo inventario y fotos guardadas
            const selectedProd = products.find(p => p.name === photo.title);
            if (selectedProd) {
                const prodInv = inventory.filter(inv => inv.product_id === selectedProd.id);
                const inventoryColors = prodInv.map(v => v.color);
                const savedColors = cachedCustomPhotos
                    .filter(p => p.title.toLowerCase() === photo.title.toLowerCase())
                    .map(p => p.color);
                
                const allColors = [...new Set([...inventoryColors, ...savedColors])];
                
                if (allColors.length > 0) {
                    allColors.forEach(color => {
                        const existingPhoto = cachedCustomPhotos.find(p => p.title.toLowerCase() === photo.title.toLowerCase() && p.color.toLowerCase() === color.toLowerCase());
                        const existingUrl = existingPhoto ? existingPhoto.image_url : '';
                        appendProductPhotoRow(color, existingUrl);
                    });
                } else {
                    appendProductPhotoRow(photo.color, photo.image_url);
                }
            } else {
                appendProductPhotoRow(photo.color, photo.image_url);
            }
        }
    }

    document.getElementById('photo-upsert-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleVal = titleInput.value.trim();
        if (!titleVal) {
            showToast('Formulario Incompleto', 'Por favor, selecciona o ingresa una prenda.', 'warning');
            return;
        }

        // Obtener todos los enlaces rellenados del contenedor
        const photoLinks = [];
        
        // 1. Procesar filas de variante de producto preexistentes
        const prodRows = linksContainer.querySelectorAll('.photo-link-row-product');
        prodRows.forEach(row => {
            const urlInputRow = row.querySelector('.row-photo-url');
            const colorVal = urlInputRow.dataset.color;
            const urlVal = urlInputRow.value.trim();
            photoLinks.push({ color: colorVal, url: urlVal });
        });

        // 2. Procesar filas agregadas manualmente (pueden ser del modo custom o variantes manuales del catálogo)
        const manualRows = linksContainer.querySelectorAll('.photo-link-row-manual');
        manualRows.forEach(row => {
            const colorInputRow = row.querySelector('.row-photo-color');
            const urlInputRow = row.querySelector('.row-photo-url');
            
            const colorVal = colorInputRow.value.trim();
            const urlVal = urlInputRow.value.trim();
            
            if (colorVal) {
                photoLinks.push({ color: colorVal, url: urlVal });
            }
        });

        if (photoLinks.length === 0) {
            showToast('Sin variantes', 'Debes configurar al menos una variante de color.', 'warning');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            // Buscar fotos existentes de este producto para ver si borramos alguna que fue limpiada
            const existingPhotos = cachedCustomPhotos.filter(p => p.title.toLowerCase() === titleVal.toLowerCase());
            const formColors = new Set(photoLinks.map(l => l.color.toLowerCase()));

            for (const linkItem of photoLinks) {
                const existing = existingPhotos.find(ep => ep.color.toLowerCase() === linkItem.color.toLowerCase());
                
                if (linkItem.url) {
                    // Guardar / Actualizar
                    await saveCustomPhoto(titleVal, linkItem.color, linkItem.url);
                } else if (existing) {
                    // Si el link fue borrado en la UI, eliminarlo de la base de datos
                    await deleteCustomPhoto(existing.id);
                }
            }

            // Desvincular fotos que existían pero que ya no figuran en absoluto en el formulario (por ejemplo si se borró una fila manual)
            for (const ep of existingPhotos) {
                if (!formColors.has(ep.color.toLowerCase())) {
                    await deleteCustomPhoto(ep.id);
                }
            }

            showToast('Fotos Guardadas', `Se actualizaron los enlaces de fotos para "${titleVal}" exitosamente.`, 'success');
            closeModal();
            renderPhotosView();
        } catch (err) {
            console.error("Error al guardar fotos personalizadas:", err);
            showToast('Error de Base de Datos', 'No se pudieron aplicar las modificaciones en la base de datos.', 'danger');
        }
    });
}

function confirmDeletePhoto(photoId, title, color) {
    const confirmHtml = `
        <div style="text-align: center; display:flex; flex-direction:column; gap:16px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3.5rem; color:var(--color-danger)"></i>
            <p style="font-size:1.1rem; font-weight:600;">¿Estás seguro de que deseas eliminar este vínculo de foto?</p>
            <p style="font-size:0.85rem; color:var(--color-text-muted);">
                La campera o artículo "${title}" en color "${color}" dejará de autovincular esta imagen.
            </p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
                <button class="btn btn-secondary" id="confirm-photo-del-no">Cancelar</button>
                <button class="btn btn-danger" id="confirm-photo-del-yes">Desvincular e Importar Fallbacks</button>
            </div>
        </div>
    `;

    openModal("Confirmar Desvinculación de Foto", confirmHtml);

    document.getElementById('confirm-photo-del-no').addEventListener('click', closeModal);
    document.getElementById('confirm-photo-del-yes').addEventListener('click', async () => {
        try {
            await deleteCustomPhoto(photoId);
            showToast('Vínculo Removido', `La foto para "${title}" en color "${color}" fue desvinculada del catálogo.`, 'success');
            closeModal();
            renderPhotosView();
        } catch (err) {
            console.error(err);
            showToast('Error', 'No se pudo eliminar la foto de la biblioteca.', 'danger');
        }
    });
}

function initPhotosModule() {
    const btnAdd = document.getElementById('photos-btn-add');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => openPhotoFormModal());
    }
}

// ==========================================================================
// CONTROL DE ACCESO BASADO EN ROLES (RBAC) - SEGURIDAD Y PERMISOS
// ==========================================================================

function applyRolePermissions(role) {
    const isSetter = (role === 'setter');
    
    // Configurar clase en body para selectores CSS condicionales (hiding cells/blocks)
    if (isSetter) {
        document.body.classList.add('role-setter');
        document.body.classList.remove('role-admin');
    } else {
        document.body.classList.add('role-admin');
        document.body.classList.remove('role-setter');
    }
    
    // Ocultar/Mostrar links del sidebar
    const restrictedPages = ['dashboard', 'bulk-upload', 'crm', 'photos', 'labels', 'settings'];
    restrictedPages.forEach(page => {
        const item = document.querySelector(`.menu-item[data-page="${page}"]`);
        if (item) {
            item.style.display = isSetter ? 'none' : '';
        }
    });
    
    // Ocultar categorías enteras del sidebar si están vacías
    const adminCategory = document.getElementById('menu-category-admin');
    if (adminCategory) {
        adminCategory.style.display = isSetter ? 'none' : '';
    }
    
    // Desactivar y oscurecer/bloquear las tasas en la calculadora de precios para Setters
    const lockOverlay = document.getElementById('calc-rates-lock-overlay');
    if (lockOverlay) {
        lockOverlay.style.display = isSetter ? 'flex' : 'none';
    }
    
    // Habilitar/Deshabilitar inputs de tasas en la calculadora
    const rateInputs = [
        'calc-pct-cash', 'calc-pct-transfer', 'calc-pct-card-1',
        'calc-pct-card-3', 'calc-pct-card-6', 'calc-pct-card-9'
    ];
    rateInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.disabled = isSetter;
        }
    });

    // Si el Setter aterriza en una vista restringida, redirigir al POS
    if (isSetter) {
        const activeMenuItem = document.querySelector('.menu-item.active');
        if (activeMenuItem) {
            const activePage = activeMenuItem.dataset.page;
            if (restrictedPages.includes(activePage)) {
                // Redirigir haciendo clic en Punto de Venta (POS)
                const salesItem = document.querySelector('.menu-item[data-page="sales"]');
                if (salesItem) {
                    setTimeout(() => salesItem.click(), 50);
                }
            }
        }
    }
}

function initAccessControl() {
    // Si estamos en demo mode, inicializar la semilla local para que exista al menos un usuario
    if (isDemoMode() && !localStorage.getItem('BELIA_USERS')) {
        const defaultUsers = [
            { id: 'u-admin', name: 'Administrador', password: 'admin123', role: 'admin' },
            { id: 'u-setter', name: 'Vendedor / Setter', password: 'setter123', role: 'setter' }
        ];
        localStorage.setItem('BELIA_USERS', JSON.stringify(defaultUsers));
    }
    
    // Variables de control de login
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginPasswordInput = document.getElementById('login-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    
    // Manejar envío de formulario de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = loginPasswordInput.value.trim();
            
            // Buscar usuario por contraseña (clave directa)
            let currentUsers = [];
            try {
                currentUsers = await getUsers();
            } catch (err) {
                console.error(err);
            }
            const foundUser = currentUsers.find(u => u.password === password);
            
            if (foundUser) {
                // Login correcto
                localStorage.setItem('BELIA_SESSION_ACTIVE', 'true');
                localStorage.setItem('BELIA_USER_ROLE', foundUser.role);
                localStorage.setItem('BELIA_USER_NAME', foundUser.name);
                if (loginErrorMsg) loginErrorMsg.style.display = 'none';
                
                // Ocultar Overlay
                if (loginOverlay) {
                    loginOverlay.style.display = 'none';
                }
                
                // Aplicar permisos
                applyRolePermissions(foundUser.role);
                updateConnectionBadge(); // Actualizar indicador de usuario
                
                // Toast de bienvenida
                showToast('Sesión Iniciada', `¡Bienvenido al sistema, ${foundUser.name}!`, 'success');
                
                // Redirigir según rol
                if (foundUser.role === 'setter') {
                    // Vendedores directo al POS
                    const salesItem = document.querySelector('.menu-item[data-page="sales"]');
                    if (salesItem) salesItem.click();
                } else {
                    // Administradores al Dashboard
                    const dashItem = document.querySelector('.menu-item[data-page="dashboard"]');
                    if (dashItem) dashItem.click();
                }
            } else {
                // Contraseña incorrecta
                if (loginErrorMsg) {
                    loginErrorMsg.style.display = 'block';
                    loginErrorMsg.textContent = 'Contraseña no válida. Intente nuevamente.';
                }
                if (loginPasswordInput) {
                    loginPasswordInput.value = '';
                    loginPasswordInput.focus();
                }
            }
        });
    }
    
    // Cerrar sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('BELIA_SESSION_ACTIVE');
            localStorage.removeItem('BELIA_USER_ROLE');
            localStorage.removeItem('BELIA_USER_NAME');
            showToast('Sesión Cerrada', 'Has cerrado la sesión correctamente.', 'info');
            
            // Recargar ventana para reiniciar estado limpio
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
    }
    
    // Validar estado de sesión actual al cargar
    const sessionActive = localStorage.getItem('BELIA_SESSION_ACTIVE') === 'true';
    if (sessionActive) {
        if (loginOverlay) {
            loginOverlay.style.display = 'none';
        }
        const activeRole = localStorage.getItem('BELIA_USER_ROLE') || 'setter';
        applyRolePermissions(activeRole);
    } else {
        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
        }
        if (loginPasswordInput) loginPasswordInput.focus();
    }
}

function resetUserForm() {
    const form = document.getElementById('settings-user-form');
    if (form) form.reset();
    
    const hiddenId = document.getElementById('user-form-id');
    if (hiddenId) hiddenId.value = '';
    
    const formTitle = document.getElementById('user-form-title');
    if (formTitle) formTitle.textContent = 'Nuevo Usuario';
    
    const btnCancel = document.getElementById('btn-user-form-cancel');
    if (btnCancel) btnCancel.style.display = 'none';
}

async function renderUsersTable() {
    const tbody = document.getElementById('settings-users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    let currentUsers = [];
    try {
        currentUsers = await getUsers();
    } catch (err) {
        console.error("Error al cargar usuarios:", err);
    }

    if (currentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 20px;">
                    No hay usuarios registrados.
                </td>
            </tr>
        `;
        return;
    }

    currentUsers.forEach(u => {
        const tr = document.createElement('tr');
        
        const roleLabel = u.role === 'admin' ? 
            '<span class="badge badge-stock-in" style="font-size:0.7rem;">ADMINISTRADOR</span>' : 
            '<span class="badge badge-stock-low" style="font-size:0.7rem;">SETTER / VENDEDOR</span>';

        tr.innerHTML = `
            <td style="font-weight: 600;">${u.name}</td>
            <td>${roleLabel}</td>
            <td style="font-family: monospace; font-weight: 700; color: var(--color-text-secondary); letter-spacing:1px; position:relative;">
                <span class="obscured-pass" id="pass-obscure-${u.id}">••••••••</span>
                <span class="plain-pass" id="pass-plain-${u.id}" style="display:none;">${u.password}</span>
                <button type="button" class="btn-toggle-pass-visibility" data-id="${u.id}" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; margin-left:6px; font-size:0.8rem;" title="Mostrar/Ocultar">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
            <td style="text-align:center;">
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn btn-secondary btn-edit-user" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem;" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-delete-user" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem;" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;

        // Bind visibility toggle
        const toggleBtn = tr.querySelector('.btn-toggle-pass-visibility');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const obs = document.getElementById(`pass-obscure-${u.id}`);
                const plain = document.getElementById(`pass-plain-${u.id}`);
                const icon = toggleBtn.querySelector('i');
                if (obs && plain) {
                    const isHidden = plain.style.display === 'none';
                    plain.style.display = isHidden ? 'inline' : 'none';
                    obs.style.display = isHidden ? 'none' : 'inline';
                    if (icon) {
                        icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
                    }
                }
            });
        }

        // Bind Edit button
        const editBtn = tr.querySelector('.btn-edit-user');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                document.getElementById('user-form-id').value = u.id;
                document.getElementById('user-form-name').value = u.name;
                document.getElementById('user-form-password').value = u.password;
                document.getElementById('user-form-role').value = u.role;
                
                const title = document.getElementById('user-form-title');
                if (title) title.textContent = 'Editar Usuario';
                
                const btnCancel = document.getElementById('btn-user-form-cancel');
                if (btnCancel) btnCancel.style.display = 'inline-block';
            });
        }

        // Bind Delete button
        const deleteBtn = tr.querySelector('.btn-delete-user');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                confirmDeleteUser(u.id, u.name);
            });
        }

        tbody.appendChild(tr);
    });
}

async function confirmDeleteUser(userId, userName) {
    const isSetter = localStorage.getItem('BELIA_USER_ROLE') === 'setter';
    if (isSetter) {
        showToast('Acceso Denegado', 'Esta acción requiere privilegios de administrador.', 'danger');
        return;
    }

    let currentUsers = [];
    try {
        currentUsers = await getUsers();
    } catch (e) {
        console.error(e);
    }
    const userToDelete = currentUsers.find(u => u.id === userId);
    
    if (!userToDelete) return;

    if (userToDelete.role === 'admin') {
        const otherAdmins = currentUsers.filter(u => u.role === 'admin' && u.id !== userId);
        if (otherAdmins.length === 0) {
            showToast('Operación Bloqueada', 'No puedes eliminar al único Administrador del sistema.', 'danger');
            return;
        }
    }

    const confirmHtml = `
        <div style="text-align: center; display:flex; flex-direction:column; gap:16px;">
            <i class="fas fa-exclamation-triangle" style="font-size:3.5rem; color:var(--color-danger)"></i>
            <p style="font-size:1.1rem; font-weight:600;">¿Estás seguro de que deseas eliminar al usuario "${userName}"?</p>
            <p style="font-size:0.85rem; color:var(--color-text-muted);">Este usuario perderá inmediatamente el acceso a la plataforma.</p>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
                <button class="btn btn-secondary" id="confirm-user-del-no">Cancelar</button>
                <button class="btn btn-danger" id="confirm-user-del-yes">Eliminar Usuario</button>
            </div>
        </div>
    `;

    openModal("Confirmar Eliminación de Usuario", confirmHtml);

    document.getElementById('confirm-user-del-no').addEventListener('click', closeModal);
    document.getElementById('confirm-user-del-yes').addEventListener('click', async () => {
        try {
            await deleteUser(userId);
            closeModal();
            showToast('Usuario Eliminado', `El usuario "${userName}" fue eliminado del sistema.`, 'success');
            
            // Si el usuario eliminado era el actual logueado, forzar deslogueo
            const currentActiveName = localStorage.getItem('BELIA_USER_NAME');
            if (currentActiveName === userName) {
                localStorage.removeItem('BELIA_SESSION_ACTIVE');
                localStorage.removeItem('BELIA_USER_ROLE');
                localStorage.removeItem('BELIA_USER_NAME');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                await renderUsersTable();
            }
        } catch (e) {
            console.error("Error al eliminar usuario:", e);
            showToast('Error', 'No se pudo eliminar al usuario de la base de datos.', 'danger');
        }
    });
}

// ==========================================================================
// INICIALIZACIÓN GLOBAL DE LA APLICACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        // 0. Inicializar Control de Acceso (RBAC)
        initAccessControl();

        // 1. Inicializar Enrutador SPA
        initRouter();

        // 2. Inicializar Módulo de Carga Masiva (CSV Engine)
        initBulkUploader(showToast, () => {
            loadAndRefreshViews('inventory'); // Recargar catálogo tras importar en lote
        });

        // 3. Inicializar Punto de Venta (POS)
        initSalesPOS(showToast, () => {
            loadAndRefreshViews('dashboard'); // Recargar stock tras realizar ventas
        }, openModal, closeModal);

        // 4. Inicializar Módulo CRM
        initCRMModule();

        // 4.1 Inicializar Módulo Base de Fotos
        initPhotosModule();

        // 4.2 Inicializar Módulo de Historial de Cierres de Caja
        initShiftsModule();

        // 5. Inicializar Módulo Ajustes
        initSettingsModule();

        // 5.1 Inicializar Módulo de Etiquetado
        initLabelsModule();

        // 6. Buscador del Catálogo e Inventario
        const invSearch = document.getElementById('inventory-search');
        if (invSearch) invSearch.addEventListener('input', () => renderInventoryGrid());
        const invFilter = document.getElementById('inventory-filter-category');
        if (invFilter) invFilter.addEventListener('change', () => renderInventoryGrid());
        
        // Buscador y filtro de la Base de Productos
        const mastSearch = document.getElementById('master-search');
        if (mastSearch) mastSearch.addEventListener('input', () => renderMasterProductsTable());
        const mastFilter = document.getElementById('master-filter-category');
        if (mastFilter) mastFilter.addEventListener('change', () => renderMasterProductsTable());

        // Botones de acción del catálogo
        const btnNewBase = document.getElementById('inventory-btn-new-base');
        if (btnNewBase) btnNewBase.addEventListener('click', () => openBaseProductModal());
        const btnLoadStock = document.getElementById('inventory-btn-load-stock');
        if (btnLoadStock) btnLoadStock.addEventListener('click', () => openLoadStockModal());

        // Pestañas de inventario
        const tabActiveStock = document.getElementById('tab-active-stock');
        const tabMasterProducts = document.getElementById('tab-master-products');
        const panelActiveStock = document.getElementById('panel-active-stock');
        const panelMasterProducts = document.getElementById('panel-master-products');

        if (tabActiveStock && tabMasterProducts) {
            tabActiveStock.addEventListener('click', () => {
                tabActiveStock.classList.add('active');
                tabMasterProducts.classList.remove('active');
                tabActiveStock.style.borderBottomColor = 'var(--color-gold)';
                tabActiveStock.style.color = 'var(--color-gold-light)';
                tabMasterProducts.style.borderBottomColor = 'transparent';
                tabMasterProducts.style.color = 'var(--color-text-secondary)';
                if (panelActiveStock) panelActiveStock.style.display = 'block';
                if (panelMasterProducts) panelMasterProducts.style.display = 'none';
                renderInventoryGrid();
            });

            tabMasterProducts.addEventListener('click', () => {
                tabMasterProducts.classList.add('active');
                tabActiveStock.classList.remove('active');
                tabMasterProducts.style.borderBottomColor = 'var(--color-gold)';
                tabMasterProducts.style.color = 'var(--color-gold-light)';
                tabActiveStock.style.borderBottomColor = 'transparent';
                tabActiveStock.style.color = 'var(--color-text-secondary)';
                if (panelActiveStock) panelActiveStock.style.display = 'none';
                if (panelMasterProducts) panelMasterProducts.style.display = 'block';
                renderMasterProductsTable();
                populateMasterCategoryFilter();
            });
        }

        // 6.2 Botón flotante para Caja (POS)
        const floatingPosBtn = document.getElementById('floating-pos-btn');
        if (floatingPosBtn) {
            floatingPosBtn.addEventListener('click', () => {
                const salesItem = document.querySelector('.menu-item[data-page="sales"]');
                if (salesItem) salesItem.click();
            });
        }

        // 6.3 Botón de Actualizar Aplicación (Sidebar)
        const btnRefreshApp = document.getElementById('btn-refresh-app');
        if (btnRefreshApp) {
            btnRefreshApp.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Actualizando', 'Recargando el sistema...', 'info');
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            });
        }

        // 7. Cierre del Sidebar en pantallas pequeñas
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');

        function toggleMobileSidebar() {
            if (sidebar) {
                const isOpen = sidebar.classList.toggle('mobile-open');
                if (sidebarBackdrop) {
                    sidebarBackdrop.classList.toggle('active', isOpen);
                }
            }
        }

        if (menuToggle) {
            menuToggle.addEventListener('click', toggleMobileSidebar);
        }

        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', toggleMobileSidebar);
        }

        // Si se hace clic en un ítem de menú en móvil, cerrar sidebar
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (sidebar && sidebar.classList.contains('mobile-open')) {
                    toggleMobileSidebar();
                }
            });
        });
    } catch (err) {
        console.error("Critical error in DOMContentLoaded initialization:", err);
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast('Error de Inicio', `Falla en carga: ${err.message || err}`, 'danger');
            }
        }, 1000);
    }
});

// ==========================================================================
// MÓDULO DE HISTORIAL DE CAJAS Y CIERRES (EXCEL EXPORT)
// ==========================================================================
function initShiftsModule() {
    const btnExport = document.getElementById('btn-export-shifts-excel');
    if (btnExport) {
        btnExport.addEventListener('click', () => downloadShiftsExcel());
    }
}

async function renderShiftsView() {
    const tableBody = document.getElementById('shifts-table-body');
    if (!tableBody) return;

    try {
        const shifts = await getCashShifts();
        const allSales = await getSales();
        tableBody.innerHTML = '';

        if (!shifts || shifts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center; padding: 40px; color: var(--color-text-muted);">
                        <i class="fas fa-vault" style="font-size: 2.2rem; margin-bottom: 12px; display:block; color:var(--color-border-gold); opacity: 0.7;"></i>
                        No hay cierres de caja registrados en el sistema.
                    </td>
                </tr>
            `;
            return;
        }

        // Ordenar por fecha de apertura descendente (el más reciente primero)
        const sortedShifts = [...shifts].sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));

        // Calcular número secuencial de turno (Turno 1 = el más antiguo)
        // Se ordena ascendente para numerar, el más antiguo es el Turno 1
        const chronoSorted = [...shifts].sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at));
        const shiftNumberMap = {};
        chronoSorted.forEach((s, idx) => {
            shiftNumberMap[s.id] = idx + 1;
        });

        sortedShifts.forEach(s => {
            const tr = document.createElement('tr');
            
            const dateOpen = new Date(s.opened_at).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            
            const dateClose = s.closed_at ? new Date(s.closed_at).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            }) : '<span style="color:var(--color-gold-light); font-weight:700;"><i class="fas fa-spinner fa-spin"></i> Activo</span>';

            const statusClass = s.status === 'open' ? 'badge-stock-in' : 'badge-stock-out';
            const statusLabel = s.status === 'open' ? 'Abierto' : 'Cerrado';

            // Calcular ventas del turno desglosadas
            const shiftSales = allSales.filter(sale => sale.shift_id === s.id);
            
            let cashSales    = 0;
            let onlineSales  = 0; // débito + crédito + transferencia agrupados
            let totalSales   = 0;

            shiftSales.forEach(sale => {
                const br = getSalePaymentBreakdown(sale);
                cashSales   += br.efectivo;
                onlineSales += br.debito + br.credito + br.transferencia;
                totalSales  += br.total;
            });

            const difCashVal = parseFloat(s.cash_difference) || 0;
            const difCardVal = parseFloat(s.card_difference) || 0;

            // Total caja: diferencia combinada efectivo + online
            const totalCajaDiff = difCashVal + difCardVal;

            const formatMoney = (n) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 });

            const formatDif = (val) => {
                if (val > 0) return `<span style="color:var(--color-success); font-weight:700;">+${formatMoney(val)}</span>`;
                if (val < 0) return `<span style="color:var(--color-danger); font-weight:700;">-${formatMoney(Math.abs(val))}</span>`;
                return `<span style="color:var(--color-text-muted);">$0,00</span>`;
            };

            // Total Caja: si faltó efectivo pero sobró online, se salva
            let totalCajaHtml;
            if (s.status === 'open') {
                totalCajaHtml = '<span style="color:var(--color-text-muted);">-</span>';
            } else {
                const totalColor = totalCajaDiff === 0 ? 'var(--color-success)' :
                                   totalCajaDiff > 0  ? 'var(--color-gold-light)' : 'var(--color-danger)';
                const totalTxt   = totalCajaDiff === 0 ? 'Cuadrada' :
                                   totalCajaDiff > 0  ? `+${formatMoney(totalCajaDiff)}` :
                                                        `-${formatMoney(Math.abs(totalCajaDiff))}`;
                // Nota de compensación
                const compensaNota = (difCashVal < 0 && difCardVal > 0 && totalCajaDiff >= 0)
                    ? ` <i class="fas fa-check-circle" title="Online compensó el faltante" style="color:var(--color-success); font-size:0.75rem;"></i>`
                    : '';
                totalCajaHtml = `<span style="font-weight:700; color:${totalColor};">${totalTxt}${compensaNota}</span>`;
            }

            tr.innerHTML = `
                <td style="text-align:center;">
                    <span style="color:var(--color-gold-light); font-weight:700; font-size:0.9rem; font-family:var(--font-display); letter-spacing:0.5px; opacity:0.9;">#${shiftNumberMap[s.id]}</span>
                </td>
                <td><strong>${dateOpen}</strong></td>
                <td>${dateClose}</td>
                <td>${s.opened_by || 'Administrador'}</td>
                <td style="text-align:right; font-weight:600; color:#4ADE80;">${formatMoney(cashSales)}</td>
                <td style="text-align:right; font-weight:600; color:#60A5FA;">${formatMoney(onlineSales)}</td>
                <td style="text-align:right; font-weight:700; color:var(--color-gold-light);">${formatMoney(totalSales)}</td>
                <td style="text-align:right;">${s.status === 'open' ? '-' : formatDif(difCashVal)}</td>
                <td style="text-align:right;">${totalCajaHtml}</td>
                <td style="text-align:center;">
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </td>
                <td style="text-align:center;">
                    <button class="btn btn-secondary btn-print-shift" data-shift-id="${s.id}" style="padding: 4px 8px; font-size: 0.75rem;" title="Imprimir Reporte">
                        <i class="fas fa-print"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);

            const printBtn = tr.querySelector('.btn-print-shift');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    const expectedCashVal = parseFloat(s.opening_cash) + cashSales;
                    const reportData = {
                        ventasEfectivo: cashSales,
                        ventasOnline: onlineSales,
                        totalVentas: totalSales,
                        expectedCash: expectedCashVal,
                        shiftNumber: shiftNumberMap[s.id]
                    };
                    printShiftReport(s, reportData);
                });
            }
        });

    } catch (err) {
        console.error(err);
        showToast('Error', 'No se pudo renderizar el historial de cajas.', 'danger');
    }
}


async function downloadShiftsExcel() {
    try {
        const shifts = await getCashShifts();
        const allSales = await getSales();
        if (!shifts || shifts.length === 0) {
            showToast('Sin datos', 'No hay cierres de caja registrados para descargar.', 'warning');
            return;
        }

        // Crear encabezados en español de Argentina desglosados
        const headers = [
            "Turno N°",
            "ID Turno",
            "Fecha Apertura",
            "Fecha Cierre",
            "Responsable",
            "Estado",
            "Ventas Efectivo ($)",
            "Ventas Debito ($)",
            "Ventas Credito ($)",
            "Ventas Transferencia ($)",
            "Total Ventas ($)",
            "Efectivo Inicial ($)",
            "Efectivo Esperado ($)",
            "Efectivo Contado ($)",
            "Diferencia Efectivo ($)",
            "Tarjeta Esperado ($)",
            "Tarjeta Contado ($)",
            "Diferencia Tarjeta ($)",
            "Notas"
        ];

        // Calcular número de turno secuencial para el Excel
        const chronoSortedExcel = [...shifts].sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at));
        const shiftNumberMapExcel = {};
        chronoSortedExcel.forEach((s, idx) => {
            shiftNumberMapExcel[s.id] = idx + 1;
        });

        // Mapear filas
        const rows = shifts.map(s => {
            const dateOpen = new Date(s.opened_at).toLocaleString('es-AR');
            const dateClose = s.closed_at ? new Date(s.closed_at).toLocaleString('es-AR') : 'Sin cerrar';
            const statusLabel = s.status === 'open' ? 'Abierto' : 'Cerrado';
            
            const notesClean = s.notes ? s.notes.replace(/[\n\r;]/g, ' ') : '';

            // Calcular ventas del turno desglosadas
            const shiftSales = allSales.filter(sale => sale.shift_id === s.id);
            let cashSales = 0;
            let debitoSales = 0;
            let creditoSales = 0;
            let transferSales = 0;
            let totalSales = 0;

            shiftSales.forEach(sale => {
                const br = getSalePaymentBreakdown(sale);
                cashSales += br.efectivo;
                debitoSales += br.debito;
                creditoSales += br.credito;
                transferSales += br.transferencia;
                totalSales += br.total;
            });

            return [
                `Turno ${shiftNumberMapExcel[s.id]}`,
                s.id,
                dateOpen,
                dateClose,
                s.opened_by || 'Administrador',
                statusLabel,
                cashSales.toFixed(2),
                debitoSales.toFixed(2),
                creditoSales.toFixed(2),
                transferSales.toFixed(2),
                totalSales.toFixed(2),
                s.opening_cash,
                s.expected_cash || 0,
                s.actual_cash || 0,
                s.cash_difference || 0,
                s.expected_card || 0,
                s.actual_card || 0,
                s.card_difference || 0,
                notesClean
            ];
        });

        // Formar el contenido CSV utilizando punto y coma ";" para que Excel en español lo tome por columnas directamente
        let csvContent = "\uFEFF"; // Byte Order Mark (BOM) para forzar codificación UTF-8 en Excel
        csvContent += headers.join(";") + "\n";
        
        rows.forEach(r => {
            csvContent += r.join(";") + "\n";
        });

        // Crear Blob y disparar la descarga
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute("href", url);
        link.setAttribute("download", `cierres_de_caja_belia_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Exportación Exitosa', 'El archivo Excel (.CSV) con el historial desglosado se ha descargado.', 'success');
    } catch (err) {
        console.error(err);
        showToast('Error', 'No se pudo exportar el historial de cajas.', 'danger');
    }
}

/* ==========================================================================
   MÓDULO: ETIQUETADO TÉRMICO Y SKU DINÁMICO
   ========================================================================== */
let isLabelsInitialized = false;

function initLabelsModule() {
    if (isLabelsInitialized) return;
    
    const searchInput = document.getElementById('labels-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderLabelsView());
    }
    
    const categorySelect = document.getElementById('labels-filter-category');
    if (categorySelect) {
        categorySelect.addEventListener('change', () => renderLabelsView());
    }
    
    const selectAllCheckbox = document.getElementById('labels-select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const rowCheckboxes = document.querySelectorAll('.label-row-checkbox');
            rowCheckboxes.forEach(cb => {
                cb.checked = isChecked;
            });
            updateLabelsSelectedCount();
        });
    }
    
    const btnPrint = document.getElementById('btn-print-labels');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => printSelectedLabels());
    }
    
    isLabelsInitialized = true;
}

function populateLabelsCategoryFilter() {
    const filter = document.getElementById('labels-filter-category');
    if (!filter) return;
    
    const categories = [...new Set(products.map(p => p.category))];
    const prevVal = filter.value;
    
    filter.innerHTML = '<option value="all">Todas las Categorías</option>' + 
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    filter.value = prevVal || 'all';
}

function renderLabelsView() {
    const tableBody = document.getElementById('labels-table-body');
    if (!tableBody) return;
    
    const searchVal = document.getElementById('labels-search').value.toLowerCase().trim();
    const filterCat = document.getElementById('labels-filter-category').value;
    
    tableBody.innerHTML = '';
    
    // Obtener todas las variantes cruzadas con su producto base
    const rowsData = [];
    
    inventory.forEach(v => {
        const prod = products.find(p => p.id === v.product_id);
        if (!prod) return;
        
        // SKU Dinámico si no lo tiene
        const computedSku = v.sku || generateSKU(prod.supplier_code, v.color, v.size, v.piel);
        
        const matchesSearch = prod.name.toLowerCase().includes(searchVal) || 
                              (prod.supplier_code || '').toLowerCase().includes(searchVal) ||
                              computedSku.toLowerCase().includes(searchVal) ||
                              v.color.toLowerCase().includes(searchVal) ||
                              (v.piel || '').toLowerCase().includes(searchVal) ||
                              v.size.toLowerCase().includes(searchVal);
        
        const matchesCat = filterCat === 'all' || prod.category === filterCat;
        
        if (matchesSearch && matchesCat) {
            rowsData.push({
                variant: v,
                product: prod,
                sku: computedSku
            });
        }
    });
    
    if (rowsData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: var(--color-text-muted); padding: 40px;">
                    <i class="fas fa-tags" style="font-size: 2.5rem; margin-bottom: 12px; display:block; color:rgba(212,175,55,0.4);"></i>
                    <p>No se encontraron variantes en el catálogo para etiquetar.</p>
                </td>
            </tr>
        `;
        document.getElementById('labels-select-all').checked = false;
        updateLabelsSelectedCount();
        return;
    }
    
    // Ordenar alfabéticamente por producto y luego por talle
    rowsData.sort((a, b) => {
        const nameA = a.product.name.toLowerCase();
        const nameB = b.product.name.toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return a.variant.size.localeCompare(b.variant.size, undefined, { numeric: true });
    });
    
    rowsData.forEach(item => {
        const v = item.variant;
        const p = item.product;
        const sku = item.sku;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="label-row-checkbox" data-inv-id="${v.id}" style="cursor:pointer; transform:scale(1.15);">
            </td>
            <td style="font-weight:700; color:var(--color-gold-light); text-align:center;">${p.supplier_code || '-'}</td>
            <td style="font-weight:600; color:var(--color-text-primary);">${p.name}</td>
            <td style="text-align:center; font-weight:700; color:var(--color-text-secondary); text-transform:uppercase;">${v.size}</td>
            <td style="color:var(--color-text-secondary);">${v.color}</td>
            <td style="color:var(--color-text-secondary);">${v.piel || 'Vaca'}</td>
            <td style="font-family:monospace; font-weight:700; color:var(--color-text-muted);">${sku}</td>
            <td style="text-align:center; font-weight:600; color:var(--color-text-secondary);">${v.stock} u.</td>
            <td style="text-align:center;">
                <input type="number" class="form-input label-copies" data-inv-id="${v.id}" value="1" min="1" style="width: 70px; text-align: center; padding: 5px; font-weight:600; border: 1px solid var(--color-border-gold); background: rgba(212,175,55,0.05); color: var(--color-gold-light);">
            </td>
            <td style="text-align:center;">
                <button class="btn btn-secondary btn-print-single" data-inv-id="${v.id}" style="padding: 6px 12px; font-size: 0.75rem;" title="Imprimir etiqueta individual">
                    <i class="fas fa-print"></i>
                </button>
            </td>
        `;
        
        // Agregar listeners
        tr.querySelector('.label-row-checkbox').addEventListener('change', () => {
            updateLabelsSelectedCount();
            // Desmarcar select-all si se desmarca uno
            if (!tr.querySelector('.label-row-checkbox').checked) {
                document.getElementById('labels-select-all').checked = false;
            }
        });
        
        tr.querySelector('.btn-print-single').addEventListener('click', () => {
            const copiesInput = tr.querySelector('.label-copies');
            const copies = parseInt(copiesInput.value) || 1;
            printSingleLabel(v.id, copies);
        });
        
        tableBody.appendChild(tr);
    });
    
    // Resetear select-all al renderizar
    document.getElementById('labels-select-all').checked = false;
    updateLabelsSelectedCount();
}

function updateLabelsSelectedCount() {
    const checkedBoxes = document.querySelectorAll('.label-row-checkbox:checked');
    const labelCount = document.getElementById('labels-selected-count');
    if (labelCount) {
        labelCount.textContent = checkedBoxes.length;
    }
}

function printSingleLabel(variantId, copies = 1) {
    const v = inventory.find(item => item.id === variantId);
    if (!v) return;
    const p = products.find(prod => prod.id === v.product_id);
    if (!p) return;
    
    const sku = v.sku || generateSKU(p.supplier_code, v.color, v.size);
    
    executeLabelsPrintJob([{ product: p, variant: v, sku: sku, copies: copies }]);
}

function printSelectedLabels() {
    const checkedBoxes = document.querySelectorAll('.label-row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showToast('Selección Vacía', 'Por favor, selecciona al menos una variante para imprimir.', 'warning');
        return;
    }
    
    const jobItems = [];
    checkedBoxes.forEach(cb => {
        const invId = cb.dataset.invId;
        const v = inventory.find(item => item.id === invId);
        if (!v) return;
        const p = products.find(prod => prod.id === v.product_id);
        if (!p) return;
        
        const sku = v.sku || generateSKU(p.supplier_code, v.color, v.size);
        
        // Obtener cantidad de copias del input
        const row = cb.closest('tr');
        const copiesInput = row.querySelector('.label-copies');
        const copies = parseInt(copiesInput.value) || 1;
        
        jobItems.push({
            product: p,
            variant: v,
            sku: sku,
            copies: copies
        });
    });
    
    executeLabelsPrintJob(jobItems);
}

function executeLabelsPrintJob(jobItems) {
    const printType = document.getElementById('labels-print-type').value; // 'qr' o 'barcode'
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
        showToast('Bloqueador de Popups', 'Permite las ventanas emergentes para poder imprimir etiquetas.', 'danger');
        return;
    }
    
    printWindow.document.write('<!DOCTYPE html><html><head><title>Imprimir Etiquetas - BELIA</title>');
    
    // Inyectar CDNs en la ventana de impresión
    printWindow.document.write('<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>');
    printWindow.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>');
    
    // Inyectar CSS optimizado para etiquetas térmicas de 5x9 cm (90x50mm)
    printWindow.document.write('<style>');
    printWindow.document.write(`
        @page {
            size: 90mm 50mm;
            margin: 0;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            -webkit-print-color-adjust: exact;
        }
        /* Contenedor de etiqueta térmica 90x50mm (5x9 cm) */
        .label-card {
            width: 90mm;
            height: 50mm;
            box-sizing: border-box;
            padding: 3mm 4mm;
            display: flex;
            page-break-after: always;
            overflow: hidden;
            background: #fff;
            position: relative;
        }
        .label-info {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .label-brand {
            font-size: 7pt;
            font-weight: 800;
            letter-spacing: 1.2px;
            color: #000;
            margin: 0 0 1mm 0;
            text-transform: uppercase;
        }
        .label-title {
            font-size: 11pt;
            font-weight: 700;
            line-height: 1.2;
            margin: 0 0 1.5mm 0;
            color: #000;
            text-transform: uppercase;
            max-height: 26pt;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .label-meta-row {
            display: flex;
            gap: 2mm;
            margin: 0 0 1mm 0;
        }
        .label-meta {
            font-size: 8pt;
            font-weight: 600;
            color: #333;
            background: #f0f0f0;
            padding: 0.5mm 2mm;
            border-radius: 0.8mm;
            text-transform: uppercase;
        }
        .label-sku {
            font-size: 9pt;
            font-weight: 700;
            font-family: "Courier New", Courier, monospace;
            margin-top: 1.5mm;
            color: #000;
            letter-spacing: 0.5px;
        }
        
        /* Layout horizontal para QR */
        .label-card.layout-qr {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 4mm 6mm;
        }
        .label-card.layout-qr .label-info {
            flex: 1;
            padding-right: 4mm;
            height: 100%;
        }
        .label-card.layout-qr .label-graphic {
            width: 32mm;
            height: 32mm;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .qr-canvas-holder {
            width: 32mm;
            height: 32mm;
        }
        
        /* Layout vertical para códigos de barra */
        .label-card.layout-barcode {
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            padding: 3mm 4mm;
        }
        .label-card.layout-barcode .label-info {
            text-align: center;
            width: 100%;
            height: auto;
            align-items: center;
        }
        .label-card.layout-barcode .label-meta-row {
            justify-content: center;
        }
        .label-card.layout-barcode .label-graphic {
            width: 100%;
            height: 22mm;
            margin-top: 1mm;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .barcode-svg {
            width: 82mm;
            height: 18mm;
        }
        
        /* Ocultar bordes al imprimir real */
        @media print {
            body {
                background: #fff;
            }
            .label-card {
                border: none;
            }
        }
        
        /* Borde simulado en pantalla para previsualizar */
        @media screen {
            body {
                background: #f0f2f5;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 15px;
            }
            .label-card {
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                border: 1px dashed #d4af37;
                border-radius: 4px;
            }
        }
    `);
    printWindow.document.write('</style></head><body>');
    
    // Inyectar cada etiqueta según la cantidad de copias solicitadas
    let index = 0;
    jobItems.forEach(item => {
        for (let c = 0; c < item.copies; c++) {
            const uniqueId = `lbl-${index}`;
            if (printType === 'qr') {
                printWindow.document.write(`
                    <div class="label-card layout-qr">
                        <div class="label-info">
                            <div class="label-brand">BELIA LEATHER</div>
                            <div class="label-title">${item.product.name}</div>
                            <div class="label-meta-row">
                                <span class="label-meta">${item.variant.color}</span>
                                <span class="label-meta">T: ${item.variant.size}</span>
                                <span class="label-meta">${item.variant.piel || 'Vaca'}</span>
                            </div>
                            <div class="label-sku">${item.sku}</div>
                        </div>
                        <div class="label-graphic">
                            <div class="qr-canvas-holder" id="qr-${uniqueId}" data-sku="${item.sku}"></div>
                        </div>
                    </div>
                `);
            } else {
                printWindow.document.write(`
                    <div class="label-card layout-barcode">
                        <div class="label-info">
                            <div class="label-brand" style="margin-bottom:0.2mm;">BELIA LEATHER</div>
                            <div class="label-title" style="font-size:11pt; -webkit-line-clamp:1; margin-bottom:0.5mm;">${item.product.name}</div>
                            <div class="label-meta-row">
                                <span class="label-meta" style="font-size:7.5pt; padding:0.2mm 1mm;">${item.variant.color}</span>
                                <span class="label-meta" style="font-size:7.5pt; padding:0.2mm 1mm;">TALLE ${item.variant.size}</span>
                                <span class="label-meta" style="font-size:7.5pt; padding:0.2mm 1mm;">${item.variant.piel || 'Vaca'}</span>
                            </div>
                        </div>
                        <div class="label-graphic">
                            <svg class="barcode-svg" id="barcode-${uniqueId}" data-sku="${item.sku}"></svg>
                        </div>
                        <div class="label-sku" style="margin-top: 0.5mm;">${item.sku}</div>
                    </div>
                `);
            }
            index++;
        }
    });
    
    // Script de generación autónoma al cargar las librerías
    printWindow.document.write(`
        <script>
            // Esperar que las librerías se carguen completamente
            function checkLibraries() {
                const hasQR = typeof QRCode !== 'undefined';
                const hasBarcode = typeof JsBarcode !== 'undefined';
                const mode = "${printType}";
                
                if ((mode === 'qr' && !hasQR) || (mode === 'barcode' && !hasBarcode)) {
                    setTimeout(checkLibraries, 50);
                    return;
                }
                
                // Generar los códigos correspondientes
                if (mode === 'qr') {
                    document.querySelectorAll('.qr-canvas-holder').forEach(el => {
                        const sku = el.dataset.sku;
                        new QRCode(el, {
                            text: sku,
                            width: 120,
                            height: 120,
                            correctLevel: QRCode.CorrectLevel.M
                        });
                    });
                } else {
                    document.querySelectorAll('.barcode-svg').forEach(el => {
                        const sku = el.dataset.sku;
                        try {
                            JsBarcode(el, sku, {
                                format: "CODE128",
                                width: 2.0,
                                height: 55,
                                displayValue: false,
                                margin: 0
                            });
                        } catch (err) {
                            console.error("Barcode generation failed for SKU:", sku, err);
                        }
                    });
                }
                
                // Disparar la impresión tras un breve retardo para asegurar renderizado
                setTimeout(function() {
                    window.print();
                    window.close();
                }, 400);
            }
            
            window.onload = checkLibraries;
        </script>
    `);
    
    printWindow.document.write('</body></html>');
    printWindow.document.close();
}


/* ==========================================================================
   MÓDULO DE CITAS SHOWROOM Y RESERVAS (app.js)
   ========================================================================== */
let currentCalendarDate = new Date();
let selectedCalendarDate = new Date();

const ARG_HOLIDAYS_2026 = [
    { "date": "2026-01-01", "label": "Año Nuevo", "type": "inamovible" },
    { "date": "2026-02-16", "label": "Carnaval", "type": "inamovible" },
    { "date": "2026-02-17", "label": "Carnaval", "type": "inamovible" },
    { "date": "2026-03-20", "label": "Fiesta de la Ruptura del Ayuno (Ramadán)", "type": "no_laborable" },
    { "date": "2026-03-23", "label": "Feriado con fines turísticos", "type": "turistico" },
    { "date": "2026-03-24", "label": "Día Nacional de la Memoria por la Verdad y la Justicia", "type": "inamovible" },
    { "date": "2026-04-02", "label": "Día del Veterano y de los Caídos en la Guerra de Malvinas / Jueves Santo", "type": "inamovible_no_laborable" },
    { "date": "2026-04-03", "label": "Viernes Santo / Pascua Judía", "type": "inamovible_no_laborable" },
    { "date": "2026-04-08", "label": "Pascua Judía (últimos días)", "type": "no_laborable" },
    { "date": "2026-04-09", "label": "Pascua Judía (últimos días)", "type": "no_laborable" },
    { "date": "2026-04-24", "label": "Día de acción por la tolerancia y el respeto entre los pueblos", "type": "no_laborable" },
    { "date": "2026-05-01", "label": "Día del Trabajador", "type": "inamovible" },
    { "date": "2026-05-25", "label": "Día de la Revolución de Mayo", "type": "inamovible" },
    { "date": "2026-05-27", "label": "Fiesta del Sacrificio (Islámico)", "type": "no_laborable" },
    { "date": "2026-06-15", "label": "Paso a la Inmortalidad del Gral. Güemes (trasladado del 17/6)", "type": "trasladable" },
    { "date": "2026-06-17", "label": "Año Nuevo Islámico", "type": "no_laborable" },
    { "date": "2026-06-20", "label": "Paso a la Inmortalidad del Gral. Manuel Belgrano", "type": "inamovible" },
    { "date": "2026-07-09", "label": "Día de la Independencia", "type": "inamovible" },
    { "date": "2026-07-10", "label": "Feriado con fines turísticos", "type": "turistico" },
    { "date": "2026-08-17", "label": "Paso a la Inmortalidad del Gral. José de San Martín", "type": "trasladable" },
    { "date": "2026-09-12", "label": "Año Nuevo Judío", "type": "no_laborable" },
    { "date": "2026-09-13", "label": "Año Nuevo Judío", "type": "no_laborable" },
    { "date": "2026-09-21", "label": "Día del Perdón (Iom Kipur)", "type": "no_laborable" },
    { "date": "2026-10-12", "label": "Día del Respeto a la Diversidad Cultural (trasladado)", "type": "trasladable" },
    { "date": "2026-11-23", "label": "Día de la Soberanía Nacional (trasladado del 20/11)", "type": "trasladable" },
    { "date": "2026-12-07", "label": "Feriado con fines turísticos", "type": "turistico" },
    { "date": "2026-12-08", "label": "Inmaculada Concepción de María", "type": "inamovible" },
    { "date": "2026-12-25", "label": "Navidad", "type": "inamovible" }
];

function getHolidayTypeLabel(type) {
    switch(type) {
        case 'inamovible': return 'Feriado Inamovible';
        case 'trasladable': return 'Feriado Trasladable';
        case 'no_laborable': return 'Día No Laborable';
        case 'turistico': return 'Feriado Turístico';
        case 'inamovible_no_laborable': return 'Feriado Inamovible / Religioso';
        default: return 'Feriado';
    }
}

function getHolidayTypeDescription(type) {
    switch(type) {
        case 'inamovible': 
            return 'Se conmemora el mismo día en que cae y no se traslada a otra fecha.';
        case 'trasladable': 
            return 'Feriado nacional regulado por la Ley 27.399. Si coincide con martes o miércoles se traslada al lunes anterior; si coincide con jueves o viernes, al lunes siguiente.';
        case 'no_laborable': 
            return 'El trabajo es optativo para el empleador. En caso de prestar servicios, se abona de manera habitual (no aplica pago doble de feriado).';
        case 'turistico': 
            return 'Día no laborable/feriado puente establecido por el Poder Ejecutivo nacional para fomentar el turismo interno y generar fines de semana largos.';
        case 'inamovible_no_laborable': 
            return 'Festividad o recordatorio de carácter inamovible o no laborable según la religión (conmemoración de Jueves Santo, Pascuas u otras festividades especiales).';
        default: 
            return 'Feriado nacional o día no laborable según el calendario oficial.';
    }
}


function initSettingsNotificationsForm() {
    const emailInput = document.getElementById('settings-notification-email');
    const telegramTokenInput = document.getElementById('settings-telegram-token');
    const telegramChatIdInput = document.getElementById('settings-telegram-chatid');
    const settingsForm = document.getElementById('settings-notifications-form');
    
    if (emailInput) {
        emailInput.value = localStorage.getItem('BELIA_NOTIFICATION_EMAIL') || '';
    }
    if (telegramTokenInput) {
        telegramTokenInput.value = localStorage.getItem('BELIA_TELEGRAM_BOT_TOKEN') || '';
    }
    if (telegramChatIdInput) {
        telegramChatIdInput.value = localStorage.getItem('BELIA_TELEGRAM_CHAT_ID') || '';
    }
    
    if (settingsForm) {
        // Remover listeners anteriores para evitar duplicados
        const newForm = settingsForm.cloneNode(true);
        settingsForm.parentNode.replaceChild(newForm, settingsForm);
        
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailVal = document.getElementById('settings-notification-email').value.trim();
            const tokenVal = document.getElementById('settings-telegram-token').value.trim();
            const chatIdVal = document.getElementById('settings-telegram-chatid').value.trim();
            
            localStorage.setItem('BELIA_NOTIFICATION_EMAIL', emailVal);
            localStorage.setItem('BELIA_TELEGRAM_BOT_TOKEN', tokenVal);
            localStorage.setItem('BELIA_TELEGRAM_CHAT_ID', chatIdVal);
            
            showToast('Ajustes Guardados', 'Las preferencias de notificación se guardaron correctamente.', 'success');
        });

        // Evento de prueba del bot de Telegram
        const testBtn = newForm.querySelector('#settings-telegram-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', async () => {
                const token = document.getElementById('settings-telegram-token').value.trim();
                const chatId = document.getElementById('settings-telegram-chatid').value.trim();
                
                if (!token || !chatId) {
                    showToast('Campos Vacíos', 'Introduce el Token del Bot y el Chat ID para realizar la prueba.', 'warning');
                    return;
                }
                
                testBtn.disabled = true;
                testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando...';
                
                const testMsg = `🔔 *Mensaje de Prueba de BELIA CRM* 🔔\n\n` +
                                `¡Felicidades! Tu bot de Telegram se ha conectado correctamente con el sistema BELIA CRM.\n\n` +
                                `⚡ _Las notificaciones automáticas de citas del showroom ya están activas._`;
                                
                try {
                    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: testMsg,
                            parse_mode: 'Markdown'
                        })
                    });
                    
                    if (res.ok) {
                        showToast('Prueba Exitosa', 'El mensaje de prueba se envió correctamente a Telegram.', 'success');
                    } else {
                        const errData = await res.json();
                        showToast('Falla en la Prueba', `Telegram devolvió un error: ${errData.description || 'Desconocido'}`, 'danger');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('Error de Conexión', 'No se pudo conectar con los servidores de Telegram.', 'danger');
                } finally {
                    testBtn.disabled = false;
                    testBtn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px;"></i> Probar Bot';
                }
            });
        }

        // Evento de activación de correo en FormSubmit
        const activateBtn = newForm.querySelector('#settings-email-activate-btn');
        if (activateBtn) {
            activateBtn.addEventListener('click', () => {
                const emailVal = document.getElementById('settings-notification-email').value.trim();
                if (!emailVal) {
                    showToast('Campo Vacío', 'Por favor ingresa un correo para activarlo.', 'warning');
                    return;
                }
                
                // Crear un formulario temporal
                const tempForm = document.createElement('form');
                tempForm.method = 'POST';
                tempForm.action = `https://formsubmit.co/${emailVal}`;
                tempForm.target = '_blank';
                
                const honeyInput = document.createElement('input');
                honeyInput.type = 'hidden';
                honeyInput.name = '_honey';
                honeyInput.value = '';
                tempForm.appendChild(honeyInput);
                
                const subjectInput = document.createElement('input');
                subjectInput.type = 'hidden';
                subjectInput.name = '_subject';
                subjectInput.value = 'Activación de Notificaciones BELIA CRM';
                tempForm.appendChild(subjectInput);

                const messageInput = document.createElement('input');
                messageInput.type = 'hidden';
                messageInput.name = 'Mensaje';
                messageInput.value = 'Esta es una solicitud de activación para recibir notificaciones desde esta aplicación BELIA CRM. Haz clic en activar para autorizar los envíos desde este dominio.';
                tempForm.appendChild(messageInput);
                
                document.body.appendChild(tempForm);
                tempForm.submit();
                document.body.removeChild(tempForm);
                
                showToast('Activación Iniciada', 'Se abrió la pestaña de FormSubmit. Revisa tu correo y haz clic en "Activate" para autorizar este dominio.', 'info');
            });
        }
    }
}

function initAppointmentsModule() {
    currentCalendarDate = new Date(selectedCalendarDate);
    
    // Bind de botones de navegación del calendario
    const btnPrev = document.getElementById('appt-calendar-prev');
    const btnNext = document.getElementById('appt-calendar-next');
    const btnNew = document.getElementById('appt-btn-new');
    
    if (btnPrev) {
        const newBtnPrev = btnPrev.cloneNode(true);
        btnPrev.parentNode.replaceChild(newBtnPrev, btnPrev);
        newBtnPrev.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        });
    }
    if (btnNext) {
        const newBtnNext = btnNext.cloneNode(true);
        btnNext.parentNode.replaceChild(newBtnNext, btnNext);
        newBtnNext.addEventListener('click', () => {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        });
    }
    if (btnNew) {
        const newBtnNew = btnNew.cloneNode(true);
        btnNew.parentNode.replaceChild(newBtnNew, btnNew);
        newBtnNew.addEventListener('click', () => {
            openAppointmentModal();
        });
    }
    
    renderCalendar();
    renderAppointmentsForSelectedDay();
}

function renderCalendar() {
    const grid = document.getElementById('appt-calendar-days');
    const title = document.getElementById('appt-calendar-month-year');
    if (!grid || !title) return;
    
    grid.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Nombre del mes y año en español
    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    title.textContent = `${monthNames[month]} ${year}`;
    
    const firstDayIndex = new Date(year, month, 1).getDay(); // Día de la semana del día 1 (0 = Dom, 1 = Lun...)
    const numDays = new Date(year, month + 1, 0).getDate(); // Total de días del mes
    const prevNumDays = new Date(year, month, 0).getDate(); // Días del mes anterior
    
    // 1. Renderizar días del mes anterior (como inactivos)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevNumDays - i;
        const prevMonthDate = new Date(year, month - 1, dayNum);
        const cell = createCalendarCell(prevMonthDate, dayNum, true);
        grid.appendChild(cell);
    }
    
    // 2. Renderizar días del mes actual
    const today = new Date();
    for (let day = 1; day <= numDays; day++) {
        const currentDate = new Date(year, month, day);
        const cell = createCalendarCell(currentDate, day, false);
        grid.appendChild(cell);
    }
    
    // 3. Renderizar días del mes siguiente (relleno de la grilla de 7x6 o 7x5)
    const totalRendered = firstDayIndex + numDays;
    const remaining = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let day = 1; day <= remaining; day++) {
        const nextMonthDate = new Date(year, month + 1, day);
        const cell = createCalendarCell(nextMonthDate, day, true);
        grid.appendChild(cell);
    }
}

function createCalendarCell(date, dayNum, isOtherMonth) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    if (isOtherMonth) cell.classList.add('other-month');
    
    cell.textContent = dayNum;
    
    const dateStr = date.toISOString().split('T')[0];
    cell.dataset.date = dateStr;
    
    // Resaltar hoy
    const today = new Date();
    if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear() && !isOtherMonth) {
        cell.classList.add('today');
    }
    
    // Resaltar día seleccionado
    if (date.getDate() === selectedCalendarDate.getDate() && date.getMonth() === selectedCalendarDate.getMonth() && date.getFullYear() === selectedCalendarDate.getFullYear()) {
        cell.classList.add('selected');
    }
    
    // Identificar feriados nacionales (Argentina 2026)
    const holiday = ARG_HOLIDAYS_2026.find(h => h.date === dateStr);
    if (holiday) {
        cell.classList.add(`holiday-${holiday.type}`);
        cell.title = `Feriado: ${holiday.label} (${getHolidayTypeLabel(holiday.type)})`;
    }
    
    // Verificar si hay citas agendadas en esta fecha
    const dayAppts = appointments.filter(a => {
        const apptDateStr = new Date(a.appointment_date).toISOString().split('T')[0];
        return apptDateStr === dateStr;
    });
    
    if (dayAppts.length > 0) {
        const dot = document.createElement('span');
        dot.className = 'calendar-day-dot';
        // Si todas están completadas, pintar verde. Si no, amarillo/oro
        const allCompleted = dayAppts.every(a => a.status === 'completed');
        if (allCompleted) dot.classList.add('completed');
        cell.appendChild(dot);
    }
    
    // Evento de clic
    cell.addEventListener('click', () => {
        selectedCalendarDate = new Date(date);
        initAppointmentsModule();
    });
    
    return cell;
}

function renderAppointmentsForSelectedDay() {
    const container = document.getElementById('appt-day-list');
    const label = document.getElementById('appt-list-date-label');
    if (!container || !label) return;
    
    const formattedSelected = selectedCalendarDate.toLocaleDateString('es-AR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
    label.textContent = formattedSelected.charAt(0).toUpperCase() + formattedSelected.slice(1);
    
    container.innerHTML = '';
    
    const dateStr = selectedCalendarDate.toISOString().split('T')[0];
    
    // Mostrar información del feriado si aplica
    const holiday = ARG_HOLIDAYS_2026.find(h => h.date === dateStr);
    if (holiday) {
        const holidayBox = document.createElement('div');
        holidayBox.className = 'holiday-info-box';
        
        const typeLabel = getHolidayTypeLabel(holiday.type);
        const typeDesc = getHolidayTypeDescription(holiday.type);
        
        holidayBox.innerHTML = `
            <div class="holiday-info-title">
                <i class="fas fa-calendar-check" style="color:var(--color-gold-light);"></i>
                <span>🎉 Feriado: ${holiday.label}</span>
            </div>
            <div class="holiday-info-type holiday-type-${holiday.type}">
                ${typeLabel}
            </div>
            <div class="holiday-info-desc">
                ${typeDesc}
            </div>
        `;
        container.appendChild(holidayBox);
    }
    
    const dayAppts = appointments.filter(a => {
        const apptDateStr = new Date(a.appointment_date).toISOString().split('T')[0];
        return apptDateStr === dateStr;
    }).sort((a,b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    
    if (dayAppts.length === 0) {
        const noApptsDiv = document.createElement('div');
        noApptsDiv.style.textAlign = 'center';
        noApptsDiv.style.color = 'var(--color-text-muted)';
        noApptsDiv.style.padding = '30px';
        noApptsDiv.style.fontStyle = 'italic';
        noApptsDiv.style.border = '1px dashed var(--color-border)';
        noApptsDiv.style.borderRadius = 'var(--radius-md)';
        noApptsDiv.textContent = 'No hay citas agendadas para este día.';
        container.appendChild(noApptsDiv);
        return;
    }
    
    dayAppts.forEach(appt => {
        const card = document.createElement('div');
        card.className = 'appt-card';
        
        const timeStr = new Date(appt.appointment_date).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });
        
        let garmentHtml = '';
        if (appt.inventory_id) {
            const invItem = inventory.find(i => i.id === appt.inventory_id);
            if (invItem) {
                const prod = products.find(p => p.id === invItem.product_id);
                if (prod) {
                    garmentHtml = `
                        <div class="appt-garment-box">
                            <i class="fas fa-shirt" style="color:var(--color-gold-light); margin-right:6px;"></i>
                            <strong>Reserva:</strong> ${prod.name} (Talle: ${invItem.size} | Color: ${invItem.color} | Piel: ${invItem.piel || 'Vaca'})
                        </div>
                    `;
                }
            }
        }
        
        const badgeClass = `appt-badge-${appt.status}`;
        const badgeText = appt.status === 'completed' ? 'Completada' : appt.status === 'cancelled' ? 'Cancelada' : 'Pendiente';
        
        // Formatear celular para WhatsApp link
        let cleanPhone = (appt.phone || '').replace(/[^0-9]/g, '');
        if (cleanPhone.length === 10 && !cleanPhone.startsWith('54')) {
            cleanPhone = '549' + cleanPhone;
        } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
            cleanPhone = '549' + cleanPhone.substring(2);
        }
        const waLink = `https://wa.me/${cleanPhone}`;
        
        let actionsHtml = '';
        if (appt.status === 'pending') {
            actionsHtml = `
                <div class="appt-actions">
                    <button class="btn btn-secondary btn-cancel-appt" data-id="${appt.id}" style="padding:6px 12px; font-size:0.75rem;">Cancelar</button>
                    ${appt.inventory_id ? `
                        <button class="btn btn-primary btn-sale-appt" data-id="${appt.id}" style="padding:6px 12px; font-size:0.75rem;">
                            <i class="fas fa-cash-register"></i> Venta Directa
                        </button>
                    ` : `
                        <button class="btn btn-success btn-complete-appt" data-id="${appt.id}" style="padding:6px 12px; font-size:0.75rem;">
                            <i class="fas fa-check"></i> Completar
                        </button>
                    `}
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="appt-card-header">
                <span class="appt-time"><i class="far fa-clock" style="margin-right:6px;"></i>${timeStr} hs</span>
                <span class="appt-badge ${badgeClass}">${badgeText}</span>
            </div>
            
            <div class="appt-client-info">
                <span class="appt-client-name">${appt.client_name}</span>
                <div class="appt-client-phone-row">
                    <span class="appt-client-phone">${appt.phone || 'Sin celular'}</span>
                    ${appt.phone ? `
                        <a href="${waLink}" target="_blank" class="btn-whatsapp-appt" title="Enviar WhatsApp Directo">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </a>
                    ` : ''}
                </div>
            </div>
            
            ${garmentHtml}
            
            ${appt.notes ? `<div class="appt-notes">${appt.notes}</div>` : ''}
            
            ${actionsHtml}
        `;
        
        // Asignar listeners
        const btnCancel = card.querySelector('.btn-cancel-appt');
        const btnComplete = card.querySelector('.btn-complete-appt');
        const btnSale = card.querySelector('.btn-sale-appt');
        
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                openConfirmModal(
                    "Cancelar Cita Showroom", 
                    `¿Estás seguro de que deseas cancelar la cita de ${appt.client_name}? Esta acción no se puede deshacer.`,
                    async () => {
                        try {
                            await deleteAppointment(appt.id);
                            
                            // Enviar notificación de cancelación por Telegram si está configurado
                            const tgToken = localStorage.getItem('BELIA_TELEGRAM_BOT_TOKEN');
                            const tgChatId = localStorage.getItem('BELIA_TELEGRAM_CHAT_ID');
                            if (tgToken && tgToken.trim() !== '' && tgChatId && tgChatId.trim() !== '') {
                                sendTelegramCancellationNotification(appt);
                            }
                            
                            appointments = await getAppointments();
                            initAppointmentsModule();
                            showToast('Cita Cancelada', `Se eliminó la cita de ${appt.client_name}`, 'warning');
                        } catch (err) {
                            console.error(err);
                            showToast('Error', 'No se pudo cancelar la cita.', 'danger');
                        }
                    }
                );
            });
        }
        
        if (btnComplete) {
            btnComplete.addEventListener('click', async () => {
                await completeAppointment(appt.id);
                appointments = await getAppointments();
                initAppointmentsModule();
                showToast('Cita Completada', `Se marcó la cita de ${appt.client_name} como completada.`, 'success');
            });
        }
        
        if (btnSale) {
            btnSale.addEventListener('click', async () => {
                try {
                    btnSale.disabled = true;
                    btnSale.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
                    
                    // 1. Obtener o guardar cliente en el CRM
                    let customer = null;
                    if (appt.customer_id) {
                        customer = customers.find(c => c.id === appt.customer_id);
                    }
                    if (!customer) {
                        customer = customers.find(c => {
                            const cleanP = (c.phone || '').replace(/[^0-9]/g, '');
                            const cleanApptP = (appt.phone || '').replace(/[^0-9]/g, '');
                            return (cleanP !== '' && cleanP === cleanApptP) || 
                                   (c.first_name.toLowerCase().trim() === appt.client_name.toLowerCase().trim());
                        });
                    }
                    
                    if (!customer) {
                        // Crear nuevo cliente
                        customer = await saveCustomer({
                            first_name: appt.client_name,
                            phone: appt.phone || ""
                        });
                        customers = await getCustomers();
                    }
                    
                    // 2. Obtener la variante e inventario
                    const invItem = inventory.find(i => i.id === appt.inventory_id);
                    if (!invItem) {
                        showToast('Error de Venta', 'No se encontró el stock de la variante reservada.', 'danger');
                        return;
                    }
                    
                    const prod = products.find(p => p.id === invItem.product_id);
                    if (!prod) {
                        showToast('Error de Venta', 'No se encontró el producto base.', 'danger');
                        return;
                    }
                    
                    // 3. Cargar en el POS y redireccionar
                    if (typeof loadReservationIntoPOS === 'function') {
                        await loadReservationIntoPOS(appt, customer, invItem, prod);
                        
                        // Switch visual de SPA
                        document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
                        const salesItem = document.querySelector('.menu-item[data-page="sales"]');
                        if (salesItem) salesItem.classList.add('active');
                        
                        document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
                        const salesView = document.getElementById('sales-view');
                        if (salesView) salesView.classList.add('active');
                        
                        await loadAndRefreshViews('sales');
                    } else {
                        showToast('Error de Módulo', 'El cargador del Punto de Venta no se encuentra activo.', 'danger');
                    }
                } catch(e) {
                    console.error(e);
                    showToast('Error', 'No se pudo realizar la transición al POS.', 'danger');
                } finally {
                    if (btnSale) {
                        btnSale.disabled = false;
                        btnSale.innerHTML = '<i class="fas fa-cash-register"></i> Venta Directa';
                    }
                }
            });
        }
        
        container.appendChild(card);
    });
}

function openAppointmentModal() {
    const activeInventory = inventory.filter(i => i.stock > 0);
    
    let optionsHtml = '<option value="">-- Sin Reserva / Solo Interés General --</option>';
    activeInventory.forEach(inv => {
        const prod = products.find(p => p.id === inv.product_id);
        if (prod) {
            optionsHtml += `
                <option value="${inv.id}">
                    ${prod.name} — ${inv.color} / Talle ${inv.size} (${inv.piel || 'Vaca'}) (Stock: ${inv.stock} u.)
                </option>
            `;
        }
    });
    
    // Obtener fecha por defecto en formato YYYY-MM-DD
    const localDateStr = selectedCalendarDate.toLocaleDateString('en-CA'); // YYYY-MM-DD local
    
    // Obtener hora actual redondeada a los 5 minutos más cercanos
    const now = new Date();
    const min = now.getMinutes();
    const roundedMin = Math.round(min / 5) * 5;
    if (roundedMin === 60) {
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
    } else {
        now.setMinutes(roundedMin);
    }
    const defaultTimeStr = now.toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'});
    
    const formHtml = `
        <form id="appt-form" style="display:flex; flex-direction:column; gap:14px;">
            <div class="form-group" style="position: relative;">
                <label class="form-label">Nombre Completo del Cliente *</label>
                <input type="text" id="appt-form-name" class="form-input" placeholder="Ej: Carolina Herrera" required autocomplete="off">
                <input type="hidden" id="appt-form-customer-id" value="">
                <div id="appt-customer-search-results" style="display:none; position:absolute; left:0; right:0; top:100%; z-index:10000; background:var(--color-bg-darker); border:1px solid var(--color-border); border-radius:var(--radius-md); max-height:200px; overflow-y:auto; box-shadow:0 4px 12px rgba(0,0,0,0.5); margin-top:4px;"></div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Número de Celular *</label>
                <input type="tel" id="appt-form-phone" class="form-input" placeholder="Ej: 11 5555 4444" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">Prenda de Interés a Reservar</label>
                <select id="appt-form-inventory" class="form-input" style="cursor:pointer;">
                    ${optionsHtml}
                </select>
            </div>
            
            <div style="display:flex; gap:16px;">
                <div class="form-group" style="flex:1;">
                    <label class="form-label">Fecha *</label>
                    <input type="date" id="appt-form-date" class="form-input" value="${localDateStr}" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label class="form-label">Horario (Pasos de 5 min) *</label>
                    <input type="time" id="appt-form-time" class="form-input" step="300" value="${defaultTimeStr}" required>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">Notas / Observaciones</label>
                <textarea id="appt-form-notes" class="form-input" style="height:60px; resize:none;" placeholder="Anotaciones sobre preferencias de talle, color, piel..."></textarea>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Agendar Cita Showroom</button>
            </div>
        </form>
    `;
    
    openModal("Agendar Nueva Cita Showroom", formHtml);
    
    const nameInput = document.getElementById('appt-form-name');
    const phoneInput = document.getElementById('appt-form-phone');
    const customerIdInput = document.getElementById('appt-form-customer-id');
    const searchResults = document.getElementById('appt-customer-search-results');
    const timeInput = document.getElementById('appt-form-time');

    function renderApptCustomerSearchResults(query = '') {
        if (!searchResults) return;
        searchResults.innerHTML = '';
        const cleanQuery = query.toLowerCase().trim();

        if (cleanQuery.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        const filtered = customers.filter(c => {
            const fullName = `${c.first_name} ${c.last_name || ''}`.toLowerCase();
            const email = (c.email || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return fullName.includes(cleanQuery) || email.includes(cleanQuery) || phone.includes(cleanQuery);
        });

        if (filtered.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        filtered.forEach(c => {
            const div = document.createElement('div');
            div.style.padding = '10px 14px';
            div.style.cursor = 'pointer';
            div.style.fontSize = '0.8rem';
            div.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            div.style.transition = 'background 0.2s';
            
            div.innerHTML = `
                <div style="font-weight:700; color:var(--color-gold-light);">${c.first_name} ${c.last_name || ''}</div>
                <div style="font-size:0.7rem; color:var(--color-text-secondary); margin-top:2px;">
                    ${c.phone ? `<span style="margin-right:8px;"><i class="fas fa-phone" style="font-size:0.65rem; color:var(--color-gold-light); opacity:0.8;"></i> ${c.phone}</span>` : ''} 
                    ${c.email ? `<span><i class="fas fa-envelope" style="font-size:0.65rem; color:var(--color-gold-light); opacity:0.8;"></i> ${c.email}</span>` : ''}
                </div>
            `;

            div.addEventListener('click', () => {
                nameInput.value = `${c.first_name} ${c.last_name || ''}`.trim();
                phoneInput.value = c.phone || '';
                customerIdInput.value = c.id;
                searchResults.style.display = 'none';
                showToast('Cliente Vinculado', `${c.first_name} se vinculó a la cita.`, 'success');
            });

            div.addEventListener('mouseenter', () => {
                div.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
            });
            div.addEventListener('mouseleave', () => {
                div.style.backgroundColor = 'transparent';
            });

            searchResults.appendChild(div);
        });

        searchResults.style.display = 'block';
    }

    if (nameInput) {
        nameInput.addEventListener('input', (e) => {
            customerIdInput.value = ''; // Reset ID if user modifies the name field manually
            renderApptCustomerSearchResults(e.target.value);
        });

        nameInput.addEventListener('focus', (e) => {
            renderApptCustomerSearchResults(e.target.value);
        });

        nameInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (searchResults) searchResults.style.display = 'none';
            }, 250);
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            customerIdInput.value = ''; // Reset ID if user modifies the phone field manually
        });
    }
    
    if (timeInput) {
        timeInput.addEventListener('blur', () => {
            const timeVal = timeInput.value;
            if (!timeVal) return;
            const [hours, minutes] = timeVal.split(':').map(Number);
            if (minutes % 5 !== 0) {
                const rounded = Math.round(minutes / 5) * 5;
                let finalM = rounded;
                let finalH = hours;
                if (finalM === 60) {
                    finalM = 0;
                    finalH = (hours + 1) % 24;
                }
                const formattedTime = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
                timeInput.value = formattedTime;
                showToast('Horario Ajustado', `El horario se redondeó a ${formattedTime} para encajar en el intervalo de 5 minutos.`, 'info');
            }
        });
    }
    
    document.getElementById('appt-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const client_name = document.getElementById('appt-form-name').value.trim();
        const phone = document.getElementById('appt-form-phone').value.trim();
        const customer_id = document.getElementById('appt-form-customer-id').value || null;
        const inventory_id = document.getElementById('appt-form-inventory').value || null;
        const dateVal = document.getElementById('appt-form-date').value;
        const timeVal = document.getElementById('appt-form-time').value;
        const notes = document.getElementById('appt-form-notes').value.trim();
        
        if (!client_name || !phone || !dateVal || !timeVal) {
            showToast('Campos Incompletos', 'Completa los campos obligatorios.', 'warning');
            return;
        }
        
        // Validar y redondear hora
        const [hours, minutes] = timeVal.split(':').map(Number);
        const roundedMins = Math.round(minutes / 5) * 5;
        let finalM = roundedMins;
        let finalH = hours;
        if (finalM === 60) {
            finalM = 0;
            finalH = (hours + 1) % 24;
        }
        const finalTimeStr = `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
        
        const appt_date = new Date(`${dateVal}T${finalTimeStr}:00`).toISOString();
        
        try {
            const apptPayload = {
                customer_id,
                client_name,
                phone,
                inventory_id,
                appointment_date: appt_date,
                notes
            };
            
            const savedAppt = await saveAppointment(apptPayload);
            showToast('✓ Cita Agendada', `Cita guardada correctamente para ${client_name}.`, 'success');
            
            // Enviar correo si FormSubmit está configurado
            const emailDest = localStorage.getItem('BELIA_NOTIFICATION_EMAIL');
            if (emailDest && emailDest.trim() !== '') {
                showToast('Enviando Notificación', 'Se está enviando la notificación por email...', 'info');
                sendFormSubmitEmail(savedAppt, emailDest).then(result => {
                    if (result.success) {
                        showToast('Email Enviado', `Notificación enviada a ${emailDest}.`, 'success');
                    } else {
                        const errMsg = result.message || 'Activa el correo si es primera vez.';
                        showToast('Alerta de Email', `No se pudo despachar: ${errMsg}`, 'warning');
                    }
                });
            }
            
            // Enviar Telegram si el Bot está configurado
            const tgToken = localStorage.getItem('BELIA_TELEGRAM_BOT_TOKEN');
            const tgChatId = localStorage.getItem('BELIA_TELEGRAM_CHAT_ID');
            if (tgToken && tgToken.trim() !== '' && tgChatId && tgChatId.trim() !== '') {
                showToast('Enviando Telegram', 'Enviando notificación al bot de Telegram...', 'info');
                sendTelegramNotification(savedAppt).then(ok => {
                    if (ok) {
                        showToast('Telegram Enviado', 'Notificación enviada con éxito.', 'success');
                    } else {
                        showToast('Error Telegram', 'No se pudo enviar el mensaje de Telegram. Revisa el token/ID.', 'warning');
                    }
                });
            }
            
            closeModal();
            appointments = await getAppointments();
            initAppointmentsModule();
        } catch(err) {
            console.error(err);
            showToast('Error de Registro', 'No se pudo guardar la cita.', 'danger');
        }
    });
}

function renderDashboardAppointmentsWidget() {
    const list = document.getElementById('dash-appointments-list');
    const count = document.getElementById('dash-appointments-count');
    if (!list || !count) return;
    
    list.innerHTML = '';
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayAppts = appointments.filter(a => {
        const apptDateStr = new Date(a.appointment_date).toISOString().split('T')[0];
        return apptDateStr === todayStr && a.status === 'pending';
    }).sort((a,b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    
    count.textContent = todayAppts.length;
    
    if (todayAppts.length === 0) {
        list.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; color:var(--color-success); padding:30px; text-align:center;">
                <i class="fas fa-check-double" style="font-size:2rem; margin-bottom:8px;"></i>
                <span style="font-size:0.9rem; font-weight:600;">Sin Citas para Hoy</span>
                <span style="font-size:0.75rem; color:var(--color-text-muted);">No tienes visitas programadas al showroom hoy.</span>
            </div>
        `;
        return;
    }
    
    todayAppts.forEach(appt => {
        const timeStr = new Date(appt.appointment_date).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });
        
        let interestTxt = "Interés general";
        if (appt.inventory_id) {
            const inv = inventory.find(i => i.id === appt.inventory_id);
            if (inv) {
                const prod = products.find(p => p.id === inv.product_id);
                if (prod) interestTxt = `${prod.name} (${inv.color})`;
            }
        }
        
        const div = document.createElement('div');
        div.className = 'appt-item-dashboard';
        div.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:4px;">
                <span style="font-size:0.9rem; font-weight:700; color:var(--color-text-primary);">${appt.client_name}</span>
                <span style="font-size:0.72rem; color:var(--color-text-muted);"><i class="fas fa-shirt" style="margin-right:4px;"></i>${interestTxt}</span>
            </div>
            <div style="text-align:right;">
                <span style="font-size:0.9rem; font-weight:800; color:var(--color-gold-light);">${timeStr} hs</span>
                <div style="font-size:0.65rem; color:var(--color-text-muted); margin-top:2px;">Pendiente</div>
            </div>
        `;
        list.appendChild(div);
    });
}

function checkDashboardAppointmentsNovelty() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPendingAppts = appointments.filter(a => {
        const apptDateStr = new Date(a.appointment_date).toISOString().split('T')[0];
        return apptDateStr === todayStr && a.status === 'pending';
    }).sort((a,b) => new Date(a.appointment_date) - new Date(b.appointment_date));
    
    if (todayPendingAppts.length > 0) {
        // Mostrar modal de novedad si no se ha mostrado en esta sesión
        if (!sessionStorage.getItem('BELIA_APPT_NOVELTY_SHOWN')) {
            setTimeout(() => {
                showAppointmentsNoveltyModal(todayPendingAppts);
                sessionStorage.setItem('BELIA_APPT_NOVELTY_SHOWN', 'true');
            }, 800);
        }
    }
}

function showAppointmentsNoveltyModal(appts) {
    let rowsHtml = '';
    appts.forEach(appt => {
        const timeStr = new Date(appt.appointment_date).toLocaleTimeString('es-AR', {
            hour: '2-digit', minute: '2-digit'
        });
        
        let garmentDetail = "Interés General";
        if (appt.inventory_id) {
            const inv = inventory.find(i => i.id === appt.inventory_id);
            if (inv) {
                const prod = products.find(p => p.id === inv.product_id);
                if (prod) garmentDetail = `${prod.name} (${inv.color} / Talle ${inv.size})`;
            }
        }
        
        rowsHtml += `
            <div style="padding:14px; border-radius:var(--radius-sm); border:1px solid var(--color-border); background-color:var(--color-bg-darker); margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--color-gold-light); font-size:1.05rem;">${timeStr} hs</strong>
                    <span class="appt-badge appt-badge-pending">Pendiente</span>
                </div>
                <div style="font-size:0.95rem; font-weight:700; color:var(--color-text-primary);">${appt.client_name}</div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);"><i class="fas fa-phone" style="margin-right:6px; color:var(--color-gold-light);"></i>${appt.phone || 'Sin celular'}</div>
                <div style="font-size:0.8rem; color:var(--color-text-secondary);"><i class="fas fa-shirt" style="margin-right:6px; color:var(--color-gold-light);"></i>${garmentDetail}</div>
                ${appt.notes ? `<div style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic; border-left:2px solid var(--color-gold); padding-left:8px; margin-top:2px;">${appt.notes}</div>` : ''}
            </div>
        `;
    });
    
    const bodyHtml = `
        <div style="font-family:var(--font-sans); color:var(--color-text-primary);">
            <p style="font-size:0.88rem; color:var(--color-text-secondary); margin-bottom:14px;">Tienes las siguientes visitas programadas al showroom para el día de hoy:</p>
            <div style="max-height:300px; overflow-y:auto; padding-right:4px;">
                ${rowsHtml}
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
                <button class="btn btn-primary" onclick="closeModal()">Entendido</button>
            </div>
        </div>
    `;
    
    openModal("Citas del Showroom de Hoy", bodyHtml);
}


