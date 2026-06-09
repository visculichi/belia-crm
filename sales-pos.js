/* ==========================================================================
   BELIA CRM - LÓGICA DE PUNTO DE VENTA (SALES & POS MODULE)
   ========================================================================== */

// Parsear moneda argentina a número flotante
function parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Eliminar todo excepto dígitos, signo negativo y comas
    let clean = val.replace(/[^0-9,-]/g, '');
    // Cambiar la coma decimal por punto decimal para parseFloat
    clean = clean.replace(/,/g, '.');
    return parseFloat(clean) || 0;
}

// Formatear número a moneda argentina con separador de miles y coma decimal
function formatCurrency(num) {
    if (isNaN(num) || num === null) return "$0,00";
    return `$${num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Estado global de la sesión POS
let posProducts = [];
let posInventory = [];
let posCustomers = [];
let cart = [];
let selectedCustomer = null;
let appliedDiscountPercent = 0;
let activeShift = null;
let activeShiftNumber = 0; // Número secuencial del turno activo (Turno 1, 2, 3...)

let showToastCallback = null;
let updateStockViewsCallback = null;
let openModalOverlayCallback = null;
let closeModalOverlayCallback = null;

// ==========================================================================
// INICIALIZACIÓN DE COMPORTAMIENTOS DEL POS
// ==========================================================================
async function initSalesPOS(showToast, updateViews, openModalOverlay, closeModalOverlay) {
    showToastCallback = showToast;
    updateStockViewsCallback = updateViews;
    openModalOverlayCallback = openModalOverlay;
    closeModalOverlayCallback = closeModalOverlay;

    const posCatalogSearch = document.getElementById('pos-search-input');
    const posCatalogFilter = document.getElementById('pos-filter-category');
    const posCartItems = document.getElementById('pos-cart-items-list');
    const posSelectCustomer = document.getElementById('pos-select-customer');
    const posBtnNewCustomer = document.getElementById('pos-btn-new-customer');
    const posBtnCheckout = document.getElementById('pos-btn-checkout');
    
    // Contenedores del Recibo/Ticket
    const ticketModalOverlay = document.getElementById('ticket-modal-overlay');
    const ticketCloseBtn = document.getElementById('ticket-close-btn');
    const btnPrintReceipt = document.getElementById('btn-print-receipt');

    if (!posCartItems) return;

    // Cargar datos iniciales
    await reloadPOSData();
    await checkShiftState();

    // Filtros de Catálogo POS
    posCatalogSearch.addEventListener('input', () => renderPOSCatalog());
    posCatalogFilter.addEventListener('change', () => renderPOSCatalog());

    // Interceptar escaneo de código de barras en el buscador del POS
    if (posCatalogSearch) {
        posCatalogSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Misma limpieza que addVariantBySKU para consistencia
                const raw = posCatalogSearch.value;
                const query = raw
                    .replace(/[",;]/g, '')                                    // quitar comillas y punto y coma
                    .replace(/[\u00B4\u0060\u0027\u2018\u2019\u02BC]/g, '-') // acento ´, apóstrofe ', comilla curva → guión
                    .replace(/[,\/\\]/g, '-')                                 // comas y barras → guión
                    .replace(/_/g, '-')                                       // guión bajo → guión
                    .replace(/-{2,}/g, '-')                                   // guiones dobles → uno
                    .replace(/^-|-$/g, '')                                    // quitar guiones al inicio/fin
                    .trim()
                    .toUpperCase();
                posCatalogSearch.value = query;
                if (query.length > 0) {
                    const added = addVariantBySKU(query);
                    if (added) {
                        e.preventDefault();
                        posCatalogSearch.value = '';
                        renderPOSCatalog();
                    }
                }
            }
        });
    }

    // Lector global de códigos de barra (con buffer rápido < 50ms) cuando no está enfocado
    let barcodeBuffer = '';
    let lastKeyTime = 0;

    window.addEventListener('keydown', (e) => {
        // Ignorar si no estamos en la pestaña de POS activa
        const activeSection = document.querySelector('.page-view.active');
        if (!activeSection || activeSection.id !== 'sales-view') {
            return;
        }

        // Ignorar si el usuario está editando un campo de texto que no sea el buscador del POS
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'pos-search-input') {
            return;
        }

        const now = Date.now();
        // Si hay una pausa mayor a 200ms, asumir que es entrada humana y vaciar el buffer
        if (now - lastKeyTime > 200) {
            barcodeBuffer = '';
        }
        lastKeyTime = now;

        if (e.key === 'Enter') {
            if (barcodeBuffer.length > 2) {
                const added = addVariantBySKU(barcodeBuffer);
                if (added) {
                    e.preventDefault();
                    if (posCatalogSearch) {
                        posCatalogSearch.value = '';
                        renderPOSCatalog();
                    }
                }
            }
            barcodeBuffer = '';
        } else if (e.key.length === 1) {
            barcodeBuffer += e.key;
        }
    });

    // Selección de Cliente
    posSelectCustomer.addEventListener('change', (e) => {
        const val = e.target.value;
        selectedCustomer = posCustomers.find(c => c.id === val) || null;
        updateCartTotals();
        updatePOSSelectedCustomerInfo();
        syncPOSCustomerSearchInput();
    });

    const customerSearchInput = document.getElementById('pos-customer-search-input');
    const customerSearchResults = document.getElementById('pos-customer-search-results');

    if (customerSearchInput && customerSearchResults) {
        customerSearchInput.addEventListener('focus', () => {
            if (customerSearchInput.value === 'Consumidor Final') {
                customerSearchInput.value = '';
            }
            renderCustomerSearchResults(customerSearchInput.value);
        });

        customerSearchInput.addEventListener('input', (e) => {
            renderCustomerSearchResults(e.target.value);
        });

        customerSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                customerSearchResults.style.display = 'none';
                syncPOSCustomerSearchInput();
            }, 250);
        });
    }

    const posBtnEditCustomer = document.getElementById('pos-btn-edit-customer');
    if (posBtnEditCustomer) {
        posBtnEditCustomer.addEventListener('click', () => {
            if (selectedCustomer) {
                openCustomerFormModal(selectedCustomer.id);
            }
        });
    }

    const posBtnDeleteCustomer = document.getElementById('pos-btn-delete-customer');
    if (posBtnDeleteCustomer) {
        posBtnDeleteCustomer.addEventListener('click', () => {
            if (selectedCustomer) {
                confirmDeleteCustomer(selectedCustomer.id, `${selectedCustomer.first_name} ${selectedCustomer.last_name || ''}`);
            }
        });
    }

    // Botones de Descuento Rápido (0%, 10%, 15%, 20%)
    document.querySelectorAll('.pos-discount-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pos-discount-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appliedDiscountPercent = parseInt(btn.dataset.pct) || 0;
            updateCartTotals();
        });
    });

    // Evento para cambio de método de pago (mostrar/ocultar calculador de vuelto)
    const posPaymentMethodSelect = document.getElementById('pos-payment-method');
    if (posPaymentMethodSelect) {
        posPaymentMethodSelect.addEventListener('change', () => {
            updateCartTotals();
        });
    }

    // Evento para ingreso de monto recibido (vuelto)
    const posCashReceivedInput = document.getElementById('pos-cash-received');
    if (posCashReceivedInput) {
        posCashReceivedInput.addEventListener('input', () => {
            updateVuelto();
        });
        
        posCashReceivedInput.addEventListener('focus', () => {
            let val = parseCurrency(posCashReceivedInput.value);
            posCashReceivedInput.value = val === 0 ? '' : val.toFixed(2).replace('.', ',');
        });

        posCashReceivedInput.addEventListener('blur', () => {
            let val = parseCurrency(posCashReceivedInput.value);
            posCashReceivedInput.value = formatCurrency(val);
        });
    }

    // Eventos para split payments (Pago Dividido) con auto-relleno inteligente y selección de medios libre
    const splitAmt1Input = document.getElementById('pos-split-amount-1');
    const splitAmt2Input = document.getElementById('pos-split-amount-2');
    const splitMethod1Select = document.getElementById('pos-split-method-1');
    const splitMethod2Select = document.getElementById('pos-split-method-2');

    if (splitAmt1Input) {
        splitAmt1Input.addEventListener('input', () => {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const discountAmount = subtotal * (appliedDiscountPercent / 100);
            const totalNeto = Math.max(0, subtotal - discountAmount);

            let amt1 = parseCurrency(splitAmt1Input.value);
            if (amt1 < 0) amt1 = 0;
            if (amt1 > totalNeto) {
                amt1 = totalNeto;
                splitAmt1Input.value = totalNeto.toFixed(2).replace('.', ',');
            }

            if (splitAmt2Input) {
                // Si el input 2 no está enfocado, mostrar formateado
                if (document.activeElement !== splitAmt2Input) {
                    splitAmt2Input.value = formatCurrency(totalNeto - amt1);
                } else {
                    splitAmt2Input.value = (totalNeto - amt1).toFixed(2).replace('.', ',');
                }
            }
            updateVuelto();
        });

        splitAmt1Input.addEventListener('focus', () => {
            let val = parseCurrency(splitAmt1Input.value);
            splitAmt1Input.value = val === 0 ? '' : val.toFixed(2).replace('.', ',');
        });

        splitAmt1Input.addEventListener('blur', () => {
            let val = parseCurrency(splitAmt1Input.value);
            splitAmt1Input.value = formatCurrency(val);
        });
    }
    if (splitAmt2Input) {
        splitAmt2Input.addEventListener('input', () => {
            const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const discountAmount = subtotal * (appliedDiscountPercent / 100);
            const totalNeto = Math.max(0, subtotal - discountAmount);

            let amt2 = parseCurrency(splitAmt2Input.value);
            if (amt2 < 0) amt2 = 0;
            if (amt2 > totalNeto) {
                amt2 = totalNeto;
                splitAmt2Input.value = totalNeto.toFixed(2).replace('.', ',');
            }

            if (splitAmt1Input) {
                // Si el input 1 no está enfocado, mostrar formateado
                if (document.activeElement !== splitAmt1Input) {
                    splitAmt1Input.value = formatCurrency(totalNeto - amt2);
                } else {
                    splitAmt1Input.value = (totalNeto - amt2).toFixed(2).replace('.', ',');
                }
            }
            updateVuelto();
        });

        splitAmt2Input.addEventListener('focus', () => {
            let val = parseCurrency(splitAmt2Input.value);
            splitAmt2Input.value = val === 0 ? '' : val.toFixed(2).replace('.', ',');
        });

        splitAmt2Input.addEventListener('blur', () => {
            let val = parseCurrency(splitAmt2Input.value);
            splitAmt2Input.value = formatCurrency(val);
        });
    }
    if (splitMethod1Select) {
        splitMethod1Select.addEventListener('change', () => {
            updateCartTotals();
        });
    }
    if (splitMethod2Select) {
        splitMethod2Select.addEventListener('change', () => {
            updateCartTotals();
        });
    }

    // Registrar Cliente rápido desde POS
    posBtnNewCustomer.addEventListener('click', () => {
        // Mostrar modal de registro de cliente
        const formNewCustHtml = `
            <form id="pos-quick-customer-form">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Nombre *</label>
                        <input type="text" id="pos-cust-first-name" class="form-input" required placeholder="Nombre">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Apellido</label>
                        <input type="text" id="pos-cust-last-name" class="form-input" placeholder="Apellido">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Teléfono</label>
                    <input type="text" id="pos-cust-phone" class="form-input" placeholder="Ej: +54 11 5555 1234">
                </div>
                <div class="form-group">
                    <label class="form-label">Email</label>
                    <input type="email" id="pos-cust-email" class="form-input" placeholder="correo@ejemplo.com">
                </div>
                <div class="form-group">
                    <label class="form-label">Notas / Preferencias</label>
                    <textarea id="pos-cust-notes" class="form-input" placeholder="Notas especiales..." style="height:80px; resize:none;"></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
                    <button type="button" class="btn btn-secondary" id="pos-cust-cancel">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Registrar Cliente</button>
                </div>
            </form>
        `;

        openModalOverlay("Registro Rápido de Cliente", formNewCustHtml);

        document.getElementById('pos-cust-cancel').addEventListener('click', closeModalOverlay);
        document.getElementById('pos-quick-customer-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const first_name = document.getElementById('pos-cust-first-name').value.trim();
                const last_name = document.getElementById('pos-cust-last-name').value.trim();
                const phone = document.getElementById('pos-cust-phone').value.trim();
                const email = document.getElementById('pos-cust-email').value.trim();
                const notes = document.getElementById('pos-cust-notes').value.trim();

                const newCust = await saveCustomer({ first_name, last_name, phone, email, notes });
                showToastCallback('Cliente Registrado', `${first_name} se añadió exitosamente.`, 'success');
                closeModalOverlay();
                
                // Recargar listado y seleccionar el nuevo
                await reloadPOSData();
                populateCustomersSelect(newCust.id);
            } catch (err) {
                console.error(err);
                showToastCallback('Error', 'No se pudo crear el cliente.', 'danger');
            }
        });
    });

    // Checkout (Completar Venta)
    posBtnCheckout.addEventListener('click', async () => {
        // Bloquear facturación si no hay turno de caja abierto
        if (!activeShift) {
            showToastCallback('Caja Cerrada', 'Por favor, inicia el turno de caja antes de realizar ventas.', 'warning');
            return;
        }

        if (cart.length === 0) {
            showToastCallback('Carrito Vacío', 'Por favor, añade al menos una prenda de cuero al carrito.', 'warning');
            return;
        }

        const paymentMethod = document.getElementById('pos-payment-method').value;
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const discountAmount = subtotal * (appliedDiscountPercent / 100);
        const totalAmount = Math.max(0, subtotal - discountAmount);

        // Calcular montos efectivo y tarjeta (Split Payment y formas simples de medios libres)
        let amountCash = 0;
        let amountCard = 0;

        if (paymentMethod === 'Efectivo') {
            amountCash = totalAmount;
        } else if (paymentMethod === 'Tarjeta' || paymentMethod === 'Transferencia') {
            amountCard = totalAmount;
        } else if (paymentMethod === 'Dividido') {
            const splitMethod1 = document.getElementById('pos-split-method-1').value;
            const splitMethod2 = document.getElementById('pos-split-method-2').value;
            const splitAmount1 = parseCurrency(document.getElementById('pos-split-amount-1').value) || 0;
            const splitAmount2 = parseCurrency(document.getElementById('pos-split-amount-2').value) || 0;

            const splitTotal = splitAmount1 + splitAmount2;
            if (Math.abs(splitTotal - totalAmount) > 1) {
                showToastCallback('Monto Dividido Incorrecto', `La suma de los montos ($${splitAmount1.toLocaleString('es-AR')} + $${splitAmount2.toLocaleString('es-AR')}) debe ser igual al total neto ($${totalAmount.toLocaleString('es-AR')}).`, 'warning');
                return;
            }
            
            // Sumar a efectivo o digital según lo seleccionado por el usuario en cada select
            if (splitMethod1 === 'Efectivo') amountCash += splitAmount1;
            else amountCard += splitAmount1;

            if (splitMethod2 === 'Efectivo') amountCash += splitAmount2;
            else amountCard += splitAmount2;
        }

        // Si es efectivo/dividido y ingresó monto, recuperar para el ticket
        const cashReceivedInput = document.getElementById('pos-cash-received');
        const cashReceived = ((paymentMethod === 'Efectivo' || paymentMethod === 'Dividido') && cashReceivedInput) ? (parseCurrency(cashReceivedInput.value) || 0) : 0;
        const compareBase = paymentMethod === 'Dividido' ? amountCash : totalAmount;
        const changeAmount = cashReceived > compareBase ? (cashReceived - compareBase) : 0;

        try {
            posBtnCheckout.disabled = true;
            posBtnCheckout.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

            const salePayload = {
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                total_amount: totalAmount,
                payment_method: paymentMethod,
                amount_cash: amountCash,
                amount_card: amountCard,
                items: cart.map(item => ({
                    inventory_id: item.inventory_id,
                    quantity: item.quantity,
                    unit_price: item.price
                }))
            };

            const completedSale = await saveSale(salePayload);
            showToastCallback('¡Venta Exitosa!', 'La prenda se ha registrado y el stock fue actualizado.', 'success');

            // Limpiar Carrito y recargar
            const cartRef = [...cart];
            const clientRef = selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name || ''}`.trim() : "Consumidor Final";
            
            // Guardar referencias de descuento para el ticket antes de resetear
            const subtotalRef = subtotal;
            const discountPercentRef = appliedDiscountPercent;
            const totalAmountRef = totalAmount;
            const cashReceivedRef = cashReceived;
            const changeAmountRef = changeAmount;

            cart = [];
            selectedCustomer = null;
            posSelectCustomer.value = "";
            document.getElementById('pos-payment-method').value = "Efectivo";
            appliedDiscountPercent = 0;

            // Resetear visualmente los botones de descuento
            document.querySelectorAll('.pos-discount-btn').forEach(b => b.classList.remove('active'));
            const zeroPctBtn = Array.from(document.querySelectorAll('.pos-discount-btn')).find(b => b.dataset.pct === '0');
            if (zeroPctBtn) zeroPctBtn.classList.add('active');

            // Resetear input de cash received y split box
            if (cashReceivedInput) cashReceivedInput.value = "";
            const splitCashBox = document.getElementById('pos-split-payment-box');
            if (splitCashBox) splitCashBox.style.display = 'none';
            
            const splitAmt1 = document.getElementById('pos-split-amount-1');
            const splitAmt2 = document.getElementById('pos-split-amount-2');
            if (splitAmt1) splitAmt1.value = "";
            if (splitAmt2) splitAmt2.value = "";

            renderPOSCart();
            await reloadPOSData();
            renderPOSCatalog();
            updateStockViewsCallback(); // Actualizar catálogo global e inventario del dashboard

            // Mostrar el ticket premium imprimible desglosado
            showReceiptModal(completedSale, cartRef, clientRef, paymentMethod, subtotalRef, discountPercentRef, totalAmountRef, cashReceivedRef, changeAmountRef, ticketModalOverlay);

        } catch (error) {
            console.error(error);
            showToastCallback('Error de Venta', 'Ocurrió un problema al procesar la venta. Revisa el stock.', 'danger');
        } finally {
            posBtnCheckout.disabled = false;
            posBtnCheckout.textContent = 'Completar y Cobrar Venta';
        }
    });

    // Cerrar ticket
    ticketCloseBtn.addEventListener('click', () => {
        ticketModalOverlay.classList.remove('active');
    });

    btnPrintReceipt.addEventListener('click', () => {
        const printContent = document.getElementById('receipt-print-area').innerHTML;
        const originalContent = document.body.innerHTML;

        // Estilos específicos de impresión rápida
        const printWindow = window.open('', '', 'height=600,width=450');
        printWindow.document.write('<html><head><title>Imprimir Ticket - BELIA</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: "Courier New", monospace; color: #000; padding: 20px; text-align: left; }');
        printWindow.document.write('.receipt-header { text-align: center; margin-bottom: 20px; }');
        printWindow.document.write('.receipt-brand { font-size: 1.6rem; font-weight: bold; margin-bottom: 4px; }');
        printWindow.document.write('.receipt-divider { border-top: 1px dashed #000; margin: 10px 0; }');
        printWindow.document.write('.receipt-table { width: 100%; border-collapse: collapse; }');
        printWindow.document.write('.receipt-table th, .receipt-table td { text-align: left; font-size: 0.8rem; padding: 4px 0; }');
        printWindow.document.write('.receipt-table th:last-child, .receipt-table td:last-child { text-align: right; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(printContent);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    });

    // Renderizado Inicial
    renderPOSCatalog();
    populateCustomersSelect();
}

// Cargar y sincronizar datos locales del POS
async function reloadPOSData() {
    posProducts = await getProducts();
    posInventory = await getInventory();
    posCustomers = await getCustomers();
}

// Renderizar Catálogo de Prendas
function renderPOSCatalog() {
    const catalogGrid = document.getElementById('pos-catalog-grid');
    const searchVal = document.getElementById('pos-search-input').value.toLowerCase().trim();
    const filterCat = document.getElementById('pos-filter-category').value;

    catalogGrid.innerHTML = '';

    const filtered = posProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.description.toLowerCase().includes(searchVal);
        const matchesCat = filterCat === 'all' || p.category === filterCat;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        catalogGrid.innerHTML = `
            <div style="grid-column: span 3; text-align: center; padding: 40px; color: var(--color-text-muted);">
                <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 12px;"></i>
                <p>No se encontraron prendas con esos filtros.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(p => {
        // Calcular stock total disponible
        const prodInv = posInventory.filter(inv => inv.product_id === p.id);
        const totalStock = prodInv.reduce((sum, i) => sum + i.stock, 0);

        // HIERRO: Ocultar completamente los artículos sin stock
        if (totalStock === 0) return;

        // Resolver imagen con soporte multivariante de color
        const firstVariantColor = prodInv.length > 0 ? prodInv[0].color : "Negro";
        const displayImage = resolveProductImage(p, firstVariantColor);

        const card = document.createElement('div');
        card.className = 'pos-product-card';
        card.innerHTML = `
            <img src="${escapeHtmlAttr(displayImage)}" alt="${escapeHtmlAttr(p.name)}" class="pos-product-thumb">
            <div class="pos-product-title">${p.name}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="pos-product-price">$${p.selling_price.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                <span class="badge ${totalStock > 3 ? 'badge-stock-in' : totalStock > 0 ? 'badge-stock-low' : 'badge-stock-out'}" style="font-size:0.65rem;">
                    ${totalStock > 0 ? `${totalStock} u.` : 'Sin stock'}
                </span>
            </div>
        `;

        if (totalStock > 0) {
            card.addEventListener('click', () => openVariantSelectorSheet(p, prodInv));
        } else {
            card.style.opacity = '0.6';
            card.style.cursor = 'not-allowed';
        }

        catalogGrid.appendChild(card);
    });
}

// Abrir Selector de Talle/Color (Hoja Lateral de Variantes)
function openVariantSelectorSheet(product, productVariants) {
    const sheetOverlay = document.getElementById('sheet-overlay');
    const sheetContainer = document.getElementById('sheet-container');
    
    // Agrupar por talle
    const sizes = [...new Set(productVariants.map(v => v.size))];
    const colors = [...new Set(productVariants.map(v => v.color))];

    // Buscar primer talle que posea stock > 0
    let activeSize = sizes.find(s => productVariants.some(v => v.size === s && v.stock > 0)) || sizes[0];
    let activeColor = null;
    let activePiel = null;
    let selectedVariant = null;

    let sheetHtml = `
        <div class="modal-header">
            <h3 class="modal-title" style="font-family:var(--font-display);">${product.name}</h3>
            <button class="modal-close" id="sheet-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:20px;">
            <div style="display:flex; gap:16px;">
                <img id="sheet-product-img" src="${escapeHtmlAttr(resolveProductImage(product, colors[0] || 'Negro'))}" style="width:120px; height:120px; object-fit:cover; border-radius:var(--radius-md); border:1px solid var(--color-border);">
                <div style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
                    <span class="badge badge-stock-in" style="width:fit-content">${product.category}</span>
                    <span style="font-size:1.3rem; font-weight:700; color:var(--color-gold-light);">$${product.selling_price.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Seleccionar Talle *</label>
                <div style="display:flex; gap:10px; flex-wrap:wrap;" id="sheet-size-options">
                    ${sizes.map((s) => {
                        const hasStock = productVariants.some(v => v.size === s && v.stock > 0);
                        const disabledClass = hasStock ? '' : 'opt-btn-disabled';
                        const activeClass = s === activeSize ? 'btn-primary' : 'btn-secondary';
                        return `<button class="btn ${activeClass} size-opt-btn ${disabledClass}" data-size="${escapeHtmlAttr(s)}" style="padding: 8px 16px;">${s}</button>`;
                    }).join('')}
                </div>
            </div>
 
            <div class="form-group">
                <label class="form-label">Seleccionar Color *</label>
                <div style="display:flex; gap:10px; flex-wrap:wrap;" id="sheet-color-options">
                    <!-- Se poblará dinámicamente según el talle -->
                </div>
            </div>
 
            <div class="form-group">
                <label class="form-label">Seleccionar Piel *</label>
                <div style="display:flex; gap:10px; flex-wrap:wrap;" id="sheet-piel-options">
                    <!-- Se poblará dinámicamente según el color -->
                </div>
            </div>
 
            <div style="display:flex; justify-content:space-between; align-items:center; background-color:var(--color-bg-darker); padding:16px; border-radius:var(--radius-md); border:1px solid var(--color-border);">
                <div>
                    <div style="font-size:0.8rem; color:var(--color-text-muted); text-transform:uppercase;">Stock Disponible</div>
                    <div style="font-size:1.3rem; font-weight:700;" id="sheet-stock-qty">0 unidades</div>
                </div>
                <div class="form-group" style="margin-bottom:0; width:120px;">
                    <label class="form-label" style="font-size:0.75rem;">Cantidad</label>
                    <input type="number" id="sheet-input-qty" class="form-input" value="1" min="1" style="text-align:center;">
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="sheet-btn-cancel">Cancelar</button>
            <button class="btn btn-primary" id="sheet-btn-add-cart">Añadir al Carrito</button>
        </div>
    `;

    sheetContainer.innerHTML = sheetHtml;
    sheetOverlay.classList.add('active');

    // Manejo de botones de talle
    const sizeBtns = sheetContainer.querySelectorAll('.size-opt-btn');
    sizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.classList.contains('opt-btn-disabled')) return;
            sizeBtns.forEach(b => b.classList.replace('btn-primary', 'btn-secondary'));
            btn.classList.replace('btn-secondary', 'btn-primary');
            activeSize = btn.dataset.size;
            updateColorsForSize();
        });
    });

    // Actualizar colores, piel y stock de talle (mostrando tachados los sin stock)
    function updateColorsForSize() {
        const sizeVariants = productVariants.filter(v => v.size === activeSize);
        const colorOptionsContainer = document.getElementById('sheet-color-options');
        
        colorOptionsContainer.innerHTML = '';
        
        if (sizeVariants.length === 0) {
            colorOptionsContainer.innerHTML = `<span style="color:var(--color-danger); font-size:0.85rem;">Sin disponibilidad en talle ${activeSize}</span>`;
            document.getElementById('sheet-stock-qty').textContent = "0 unidades";
            document.getElementById('sheet-stock-qty').style.color = "var(--color-danger)";
            selectedVariant = null;
            return;
        }
 
        const uniqueColors = [...new Set(sizeVariants.map(v => v.color))];
 
        uniqueColors.forEach((colorName) => {
            const hasStock = sizeVariants.some(v => v.color === colorName && v.stock > 0);
            const disabledClass = hasStock ? '' : 'opt-btn-disabled';
            
            const btn = document.createElement('button');
            btn.className = `btn btn-secondary color-opt-btn ${disabledClass}`;
            btn.dataset.color = colorName;
            btn.textContent = colorName;
            btn.style.padding = '8px 16px';
            
            btn.addEventListener('click', () => {
                colorOptionsContainer.querySelectorAll('.color-opt-btn').forEach(b => b.classList.replace('btn-primary', 'btn-secondary'));
                btn.classList.replace('btn-secondary', 'btn-primary');
                activeColor = colorName;
                updateSkinsForColor();
            });
 
            colorOptionsContainer.appendChild(btn);
        });
 
        // Seleccionar por defecto el primer color con stock
        const firstStockColorVar = sizeVariants.find(v => v.stock > 0);
        if (firstStockColorVar) {
            activeColor = firstStockColorVar.color;
        } else {
            activeColor = uniqueColors[0];
        }
        const activeBtn = Array.from(colorOptionsContainer.querySelectorAll('.color-opt-btn')).find(b => b.dataset.color === activeColor);
        if (activeBtn) {
            activeBtn.classList.replace('btn-secondary', 'btn-primary');
        }
        updateSkinsForColor();
    }
 
    function updateSkinsForColor() {
        const colorVariants = productVariants.filter(v => v.size === activeSize && v.color === activeColor);
        const pielOptionsContainer = document.getElementById('sheet-piel-options');
        
        pielOptionsContainer.innerHTML = '';
        
        if (colorVariants.length === 0) {
            pielOptionsContainer.innerHTML = `<span style="color:var(--color-danger); font-size:0.85rem;">Sin disponibilidad</span>`;
            document.getElementById('sheet-stock-qty').textContent = "0 unidades";
            document.getElementById('sheet-stock-qty').style.color = "var(--color-danger)";
            selectedVariant = null;
            return;
        }
 
        const uniqueSkins = [...new Set(colorVariants.map(v => v.piel || 'Vaca'))];
 
        uniqueSkins.forEach((pielName) => {
            const hasStock = colorVariants.some(v => (v.piel || 'Vaca') === pielName && v.stock > 0);
            const disabledClass = hasStock ? '' : 'opt-btn-disabled';
            
            const btn = document.createElement('button');
            btn.className = `btn btn-secondary piel-opt-btn ${disabledClass}`;
            btn.dataset.piel = pielName;
            btn.textContent = pielName;
            btn.style.padding = '8px 16px';
            
            btn.addEventListener('click', () => {
                pielOptionsContainer.querySelectorAll('.piel-opt-btn').forEach(b => b.classList.replace('btn-primary', 'btn-secondary'));
                btn.classList.replace('btn-secondary', 'btn-primary');
                activePiel = pielName;
                updateStockDisplay();
            });
 
            pielOptionsContainer.appendChild(btn);
        });
 
        // Seleccionar por defecto la primera piel con stock
        const firstStockPielVar = colorVariants.find(v => v.stock > 0);
        if (firstStockPielVar) {
            activePiel = firstStockPielVar.piel || 'Vaca';
        } else {
            activePiel = uniqueSkins[0];
        }
        const activeBtn = Array.from(pielOptionsContainer.querySelectorAll('.piel-opt-btn')).find(b => b.dataset.piel === activePiel);
        if (activeBtn) {
            activeBtn.classList.replace('btn-secondary', 'btn-primary');
        }
        updateStockDisplay();
    }
 
    // Actualizar cantidad de stock disponible visualmente
    function updateStockDisplay() {
        selectedVariant = productVariants.find(v => v.size === activeSize && v.color === activeColor && (v.piel || 'Vaca') === activePiel);
        const stockQtyLabel = document.getElementById('sheet-stock-qty');
        const qtyInput = document.getElementById('sheet-input-qty');
        const sheetImg = document.getElementById('sheet-product-img');
 
        // Cambiar dinámicamente la foto según la variante de color seleccionada con soporte multivariante
        if (sheetImg && activeColor) {
            sheetImg.src = resolveProductImage(product, activeColor);
        }
 
        if (selectedVariant) {
            stockQtyLabel.textContent = `${selectedVariant.stock} unidades (${selectedVariant.piel || 'Vaca'})`;
            stockQtyLabel.style.color = selectedVariant.stock > 3 ? "var(--color-success)" : "var(--color-gold-light)";
            qtyInput.max = selectedVariant.stock;
            qtyInput.value = 1;
        } else {
            stockQtyLabel.textContent = "Sin stock";
            stockQtyLabel.style.color = "var(--color-danger)";
            qtyInput.max = 0;
            qtyInput.value = 0;
        }
    }

    updateColorsForSize();

    // Eventos de Cierre y Cancelación
    const closeSheet = () => {
        sheetOverlay.classList.remove('active');
    };
    document.getElementById('sheet-close-btn').addEventListener('click', closeSheet);
    document.getElementById('sheet-btn-cancel').addEventListener('click', closeSheet);
    sheetOverlay.addEventListener('click', closeSheet);

    // Añadir al Carrito
    document.getElementById('sheet-btn-add-cart').addEventListener('click', () => {
        if (!selectedVariant) {
            showToastCallback('Error', 'Variante no disponible en stock.', 'danger');
            return;
        }

        const qty = parseInt(document.getElementById('sheet-input-qty').value);
        if (isNaN(qty) || qty <= 0) {
            showToastCallback('Cantidad Inválida', 'Por favor, introduce una cantidad mayor a 0.', 'warning');
            return;
        }

        if (qty > selectedVariant.stock) {
            showToastCallback('Sin Stock Suficiente', `Solo hay ${selectedVariant.stock} prendas disponibles en talle ${selectedVariant.size} color ${selectedVariant.color}.`, 'danger');
            return;
        }

        // Incorporar al Carrito
        addToCart(product, selectedVariant, qty);
        closeSheet();
        showToastCallback('Prenda Añadida', `${product.name} (${selectedVariant.size} - ${selectedVariant.color}) en el carrito.`, 'success');
    });
}

// Agregar Item al Carrito Físico
function addToCart(product, variant, qty) {
    const existingIndex = cart.findIndex(item => item.inventory_id === variant.id);

    if (existingIndex !== -1) {
        const totalNewQty = cart[existingIndex].quantity + qty;
        if (totalNewQty > variant.stock) {
            cart[existingIndex].quantity = variant.stock;
            showToastCallback('Límite de Stock', `Se ajustó la cantidad al máximo disponible (${variant.stock} u.)`, 'warning');
        } else {
            cart[existingIndex].quantity = totalNewQty;
        }
    } else {
        cart.push({
            product_id: product.id,
            inventory_id: variant.id,
            name: product.name,
            size: variant.size,
            color: variant.color,
            piel: variant.piel || 'Vaca',
            price: product.selling_price,
            quantity: qty,
            max_stock: variant.stock
        });
    }

    renderPOSCart();
}

// Renderizar Carrito en UI
function renderPOSCart() {
    const cartContainer = document.getElementById('pos-cart-items-list');
    cartContainer.innerHTML = '';

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--color-text-muted); display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%;">
                <i class="fas fa-shopping-bag" style="font-size: 3rem; margin-bottom: 16px; color:rgba(250,250,249,0.05)"></i>
                <p style="font-size:0.95rem;">Selecciona prendas del catálogo para iniciar una venta.</p>
            </div>
        `;
        updateCartTotals();
        return;
    }

    cart.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-desc">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-variant">Talle: ${item.size} | Color: ${item.color} | Piel: ${item.piel || 'Vaca'}</div>
            </div>
            <div class="cart-item-qty-control">
                <button class="qty-btn btn-minus" data-index="${idx}">-</button>
                <span style="font-weight:700; font-size:0.9rem; min-width:16px; text-align:center;">${item.quantity}</span>
                <button class="qty-btn btn-plus" data-index="${idx}">+</button>
            </div>
            <div class="cart-item-price">$${(item.price * item.quantity).toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
            <i class="fas fa-trash-alt cart-item-remove" data-index="${idx}"></i>
        `;

        // Acciones cantidad
        div.querySelector('.btn-minus').addEventListener('click', () => {
            if (item.quantity > 1) {
                item.quantity--;
            } else {
                cart.splice(idx, 1);
            }
            renderPOSCart();
        });

        div.querySelector('.btn-plus').addEventListener('click', () => {
            if (item.quantity < item.max_stock) {
                item.quantity++;
            } else {
                showToastCallback('Stock Máximo', 'Has seleccionado la cantidad total disponible en stock.', 'warning');
            }
            renderPOSCart();
        });

        div.querySelector('.cart-item-remove').addEventListener('click', () => {
            cart.splice(idx, 1);
            renderPOSCart();
        });

        cartContainer.appendChild(div);
    });

    updateCartTotals();
}

// Calcular y refrescar totales
function updateCartTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calcular descuento
    const discountAmount = subtotal * (appliedDiscountPercent / 100);
    const total = Math.max(0, subtotal - discountAmount);

    document.getElementById('pos-cart-subtotal').textContent = `$${subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}`;
    
    // Badge de descuento
    const discountBadge = document.getElementById('pos-discount-badge');
    if (discountBadge) {
        if (appliedDiscountPercent > 0) {
            discountBadge.textContent = `-${appliedDiscountPercent}%`;
            discountBadge.style.display = 'inline-block';
        } else {
            discountBadge.style.display = 'none';
        }
    }

    document.getElementById('pos-cart-total').textContent = `$${total.toLocaleString('es-AR', {minimumFractionDigits:2})}`;

    // Mostrar/ocultar calculador de vuelto según método de pago e inicializar split
    const paymentMethodSelect = document.getElementById('pos-payment-method');
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'Efectivo';
    
    const splitPaymentBox = document.getElementById('pos-split-payment-box');
    if (splitPaymentBox) {
        if (paymentMethod === 'Dividido') {
            splitPaymentBox.style.display = 'flex';
            
            const splitAmt1 = document.getElementById('pos-split-amount-1');
            const splitAmt2 = document.getElementById('pos-split-amount-2');
            if (splitAmt1 && splitAmt2) {
                const val1 = parseCurrency(splitAmt1.value) || 0;
                const val2 = parseCurrency(splitAmt2.value) || 0;
                
                // Si están vacíos o no suman el total, inicializar por defecto (el total en el medio 1)
                if (splitAmt1.value === '' && splitAmt2.value === '') {
                    splitAmt1.value = formatCurrency(total);
                    splitAmt2.value = formatCurrency(0);
                } else if (Math.abs((val1 + val2) - total) > 0.01) {
                    // Si el total cambió, recalculamos para que cuadre
                    if (val1 <= total) {
                        if (document.activeElement !== splitAmt2) {
                            splitAmt2.value = formatCurrency(total - val1);
                        } else {
                            splitAmt2.value = (total - val1).toFixed(2).replace('.', ',');
                        }
                    } else {
                        splitAmt1.value = formatCurrency(total);
                        splitAmt2.value = formatCurrency(0);
                    }
                }
            }
        } else {
            splitPaymentBox.style.display = 'none';
            // Limpiar inputs si no está en modo dividido
            const splitAmt1 = document.getElementById('pos-split-amount-1');
            const splitAmt2 = document.getElementById('pos-split-amount-2');
            if (splitAmt1) splitAmt1.value = '';
            if (splitAmt2) splitAmt2.value = '';
        }
    }

    // Gestionar visualización de la caja de vuelto gigante
    const cashChangeBox = document.getElementById('pos-cash-change-box');
    if (cashChangeBox) {
        let showChangeBox = false;
        
        if (cart.length > 0) {
            if (paymentMethod === 'Efectivo') {
                showChangeBox = true;
            } else if (paymentMethod === 'Dividido') {
                const splitMethod1 = document.getElementById('pos-split-method-1').value;
                const splitMethod2 = document.getElementById('pos-split-method-2').value;
                if (splitMethod1 === 'Efectivo' || splitMethod2 === 'Efectivo') {
                    showChangeBox = true;
                }
            }
        }

        if (showChangeBox) {
            cashChangeBox.style.display = 'block';
        } else {
            cashChangeBox.style.display = 'none';
            // Limpiar recibidos si se cambia de método de pago o el carrito está vacío
            const cashReceivedInput = document.getElementById('pos-cash-received');
            if (cashReceivedInput) {
                cashReceivedInput.value = '';
            }
        }
    }

    // Actualizar vuelto reactivamente
    updateVuelto();
}

// Calcular vuelto para el pago en efectivo y pago dividido
function updateVuelto() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = subtotal * (appliedDiscountPercent / 100);
    const totalNeto = Math.max(0, subtotal - discountAmount);

    const paymentMethodSelect = document.getElementById('pos-payment-method');
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'Efectivo';
    
    const cashReceivedInput = document.getElementById('pos-cash-received');
    const cashChangeLabel = document.getElementById('pos-cash-change');

    if (!cashChangeLabel) return;

    let hasCashInvolved = false;
    let baseToCompare = totalNeto;

    if (paymentMethod === 'Efectivo') {
        hasCashInvolved = true;
        baseToCompare = totalNeto;
    } else if (paymentMethod === 'Dividido') {
        const splitMethod1 = document.getElementById('pos-split-method-1').value;
        const splitMethod2 = document.getElementById('pos-split-method-2').value;
        const splitAmount1 = parseCurrency(document.getElementById('pos-split-amount-1').value) || 0;
        const splitAmount2 = parseCurrency(document.getElementById('pos-split-amount-2').value) || 0;

        let cashAssigned = 0;
        if (splitMethod1 === 'Efectivo') {
            cashAssigned += splitAmount1;
            hasCashInvolved = true;
        }
        if (splitMethod2 === 'Efectivo') {
            cashAssigned += splitAmount2;
            hasCashInvolved = true;
        }
        baseToCompare = cashAssigned;
    }

    if (!hasCashInvolved || cart.length === 0 || baseToCompare <= 0) {
        cashChangeLabel.textContent = "$0,00";
        cashChangeLabel.style.color = "var(--color-gold-light)";
        return;
    }

    const cashReceived = parseCurrency(cashReceivedInput.value);

    if (isNaN(cashReceived) || cashReceived < baseToCompare) {
        cashChangeLabel.textContent = "$0,00";
        cashChangeLabel.style.color = "var(--color-danger)"; // Rojo carmesí para advertencia de dinero insuficiente
        return;
    }

    const change = cashReceived - baseToCompare;
    cashChangeLabel.textContent = `$${change.toLocaleString('es-AR', {minimumFractionDigits:2})}`;
    cashChangeLabel.style.color = "var(--color-success)"; // Oro/Verde éxito si cubre el costo
}

// Poblar desplegable de selección de cliente
function populateCustomersSelect(selectId = null) {
    const select = document.getElementById('pos-select-customer');
    if (!select) return;

    // Si no se especifica selectId, intentar usar el valor actual del selector
    const currentSelectedId = selectId || select.value || null;

    select.innerHTML = '<option value="">Consumidor Final</option>';
    
    let found = false;
    posCustomers.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.first_name} ${c.last_name || ''} (${c.phone || c.email || 'Sin datos'})`;
        
        if (currentSelectedId && c.id === currentSelectedId) {
            option.selected = true;
            selectedCustomer = c;
            found = true;
        }

        select.appendChild(option);
    });

    if (!found) {
        selectedCustomer = null;
    }
    
    syncPOSCustomerSearchInput();
    updatePOSSelectedCustomerInfo();
}

// Sincronizar el buscador visual de clientes en el POS con el estado actual
function syncPOSCustomerSearchInput() {
    const searchInput = document.getElementById('pos-customer-search-input');
    if (!searchInput) return;

    if (selectedCustomer) {
        searchInput.value = `${selectedCustomer.first_name} ${selectedCustomer.last_name || ''}`.trim();
    } else {
        searchInput.value = 'Consumidor Final';
    }
}

// Renderizar dinámicamente los resultados de la búsqueda de clientes
function renderCustomerSearchResults(query = '') {
    const resultsContainer = document.getElementById('pos-customer-search-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';
    const cleanQuery = query.toLowerCase().trim();

    // Opción por defecto: Consumidor Final
    const defaultOption = document.createElement('div');
    defaultOption.style.padding = '10px 14px';
    defaultOption.style.cursor = 'pointer';
    defaultOption.style.fontSize = '0.8rem';
    defaultOption.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    defaultOption.style.color = 'var(--color-text-muted)';
    defaultOption.style.transition = 'background 0.2s';
    defaultOption.textContent = 'Consumidor Final';
    
    defaultOption.addEventListener('click', () => {
        const select = document.getElementById('pos-select-customer');
        if (select) {
            select.value = '';
            select.dispatchEvent(new Event('change'));
        }
        resultsContainer.style.display = 'none';
    });

    defaultOption.addEventListener('mouseenter', () => {
        defaultOption.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
    });
    defaultOption.addEventListener('mouseleave', () => {
        defaultOption.style.backgroundColor = 'transparent';
    });
    
    resultsContainer.appendChild(defaultOption);

    // Filtrar clientes
    const filtered = posCustomers.filter(c => {
        const fullName = `${c.first_name} ${c.last_name || ''}`.toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return fullName.includes(cleanQuery) || email.includes(cleanQuery) || phone.includes(cleanQuery);
    });

    if (filtered.length === 0 && cleanQuery.length > 0) {
        const noResults = document.createElement('div');
        noResults.style.padding = '10px 14px';
        noResults.style.fontSize = '0.75rem';
        noResults.style.color = 'var(--color-text-muted)';
        noResults.style.fontStyle = 'italic';
        noResults.textContent = 'No se encontraron clientes...';
        resultsContainer.appendChild(noResults);
    } else {
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
                const select = document.getElementById('pos-select-customer');
                if (select) {
                    select.value = c.id;
                    select.dispatchEvent(new Event('change'));
                }
                resultsContainer.style.display = 'none';
            });

            div.addEventListener('mouseenter', () => {
                div.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
            });
            div.addEventListener('mouseleave', () => {
                div.style.backgroundColor = 'transparent';
            });

            resultsContainer.appendChild(div);
        });
    }

    resultsContainer.style.display = 'block';
}

// Actualizar panel de información del cliente seleccionado en el POS
function updatePOSSelectedCustomerInfo() {
    const infoBox = document.getElementById('pos-customer-info-box');
    const nameEl = document.getElementById('pos-customer-info-name');
    const waEl = document.getElementById('pos-customer-info-wa');
    const notesEl = document.getElementById('pos-customer-info-notes');

    if (!infoBox) return;

    if (!selectedCustomer) {
        infoBox.style.display = 'none';
        return;
    }

    infoBox.style.display = 'block';
    nameEl.textContent = `${selectedCustomer.first_name} ${selectedCustomer.last_name || ''}`.trim();

    // Enlace de WhatsApp (WA.me) inteligente
    if (selectedCustomer.phone) {
        let cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
            cleanPhone = '549' + cleanPhone.substring(2);
        } else if (!cleanPhone.startsWith('54') && cleanPhone.length === 10) {
            cleanPhone = '549' + cleanPhone;
        }
        const waLink = `https://wa.me/${cleanPhone}`;
        waEl.innerHTML = `
            <a href="${waLink}" target="_blank" class="btn-whatsapp" title="Enviar WhatsApp" style="color:#25D366; font-size:1.1rem; display:inline-flex; align-items:center; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
                <i class="fab fa-whatsapp"></i>
            </a>
        `;
    } else {
        waEl.innerHTML = '';
    }

    // Notas
    if (selectedCustomer.notes) {
        notesEl.textContent = selectedCustomer.notes;
    } else {
        notesEl.innerHTML = '<span style="color:var(--color-text-muted); font-style:italic;">Sin notas registradas.</span>';
    }
}

// Helper global para cambiar el cliente seleccionado del POS desde otros módulos
function setPOSSelectedCustomer(cust) {
    selectedCustomer = cust;
}

// Agregar variante de prenda al carrito utilizando su SKU (Código de barras o QR)
function addVariantBySKU(sku) {
    // Limpiar cualquier artefacto del escáner: comillas, acentos, apóstrofes, comas, barras
    const cleanSku = sku
        .replace(/[",;]/g, '')                                    // quitar comillas dobles y punto y coma
        .replace(/[\u00B4\u0060\u0027\u2018\u2019\u02BC]/g, '-') // acento ´, apóstrofe ', comilla curva → guión
        .replace(/[,\/\\]/g, '-')                                 // comas y barras → guiones
        .replace(/_/g, '-')                                       // guiones bajos → guiones
        .replace(/-{2,}/g, '-')                                   // guiones dobles → uno solo
        .replace(/^-|-$/g, '')                                    // quitar guiones al inicio/fin
        .trim()
        .toUpperCase();

    if (!cleanSku) return false;

    console.log('[BELIA Scanner] SKU bruto:', JSON.stringify(sku), '→ limpio:', cleanSku);

    // 1) Búsqueda exacta por SKU
    let variant = posInventory.find(v => (v.sku || '').toUpperCase() === cleanSku);

    // 2) Si no encontró exacto, buscar por coincidencia parcial (los primeros 2 segmentos del SKU)
    if (!variant) {
        const parts = cleanSku.split('-');
        if (parts.length >= 2) {
            const prefix = parts.slice(0, 2).join('-'); // ej: "001-NGR"
            const candidates = posInventory.filter(v => (v.sku || '').toUpperCase().startsWith(prefix));
            if (candidates.length === 1) {
                // Solo un candidato → usarlo
                variant = candidates[0];
                console.log('[BELIA Scanner] Match parcial encontrado:', variant.sku);
            } else if (candidates.length > 1) {
                // Más de uno → intentar con 3 segmentos
                const prefix3 = parts.slice(0, 3).join('-');
                const candidates3 = posInventory.filter(v => (v.sku || '').toUpperCase().startsWith(prefix3));
                if (candidates3.length === 1) {
                    variant = candidates3[0];
                    console.log('[BELIA Scanner] Match parcial (3 seg) encontrado:', variant.sku);
                }
            }
        }
    }

    if (!variant) {
        console.warn('[BELIA Scanner] SKU no encontrado:', cleanSku);
        showToastCallback('No Encontrado', `No se encontró prenda con SKU: ${cleanSku}`, 'warning');
        return false;
    }

    // Buscar el producto correspondiente en posProducts
    const product = posProducts.find(p => p.id === variant.product_id);
    if (!product) {
        console.warn('[BELIA Scanner] Producto no encontrado para variant.product_id:', variant.product_id);
        return false;
    }

    // Verificar si hay stock
    if (variant.stock <= 0) {
        showToastCallback('Sin Stock', `La variante ${cleanSku} no tiene stock disponible.`, 'danger');
        return true; 
    }

    // Agregar al carrito
    addToCart(product, variant, 1);
    updateCartTotals();
    showToastCallback('Prenda Escaneada', `${product.name} (${variant.size} - ${variant.color} - ${variant.piel || 'Vaca'}) se añadió al carrito.`, 'success');
    return true;
}

// Mostrar modal de ticket impreso premium desglosado
function showReceiptModal(sale, cartItems, clientName, paymentMethod, subtotal, discountPercent, totalAmount, cashReceived, changeAmount, modalOverlay) {
    const ticketPrintArea = document.getElementById('receipt-print-area');
    const invoiceNumber = `BL-${String(Math.floor(1000 + Math.random()*9000))}-${String(Math.floor(10 + Math.random()*90))}`;
    
    const formattedDate = new Date().toLocaleString('es-AR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    ticketPrintArea.innerHTML = `
        <div class="receipt-header">
            <div class="receipt-brand">Belia Leather</div>
            <div style="font-size:0.75rem; letter-spacing:1px; margin-top:2px;">Indumentaria de cuero genuino</div>
            <div style="font-size:0.7rem; color:#555; margin-top:4px;">La Plata, Buenos Aires</div>
        </div>
        <div class="receipt-divider"></div>
        <div style="font-size: 0.75rem; line-height: 1.6;">
            <div><strong>TICKET Nro:</strong> ${invoiceNumber}</div>
            <div><strong>FECHA:</strong> ${formattedDate}</div>
            <div><strong>CLIENTE:</strong> ${clientName}</div>
            <div><strong>PAGO:</strong> ${paymentMethod === 'Dividido' ? 'Pago Dividido (Mixto)' : paymentMethod}</div>
        </div>
        <div class="receipt-divider"></div>
        <table class="receipt-table">
            <thead>
                <tr>
                    <th>PRENDA</th>
                    <th style="text-align:center;">CANT</th>
                    <th style="text-align:right;">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${cartItems.map(item => `
                    <tr>
                        <td>
                            ${item.name}<br>
                            <span style="font-size:0.65rem; color:#444;">Talle: ${item.size} | Color: ${item.color} | Piel: ${item.piel || 'Vaca'}</span>
                        </td>
                        <td style="text-align:center;">${item.quantity}</td>
                        <td style="text-align:right;">$${(item.price * item.quantity).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div class="receipt-divider"></div>
        
        <!-- Desglose de totales con descuento si aplica -->
        ${discountPercent > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5;">
                <span>Subtotal:</span>
                <span>$${subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5; color:#555;">
                <span>Descuento (${discountPercent}%):</span>
                <span>-$${(subtotal * discountPercent / 100).toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; font-size:0.9rem; font-weight:bold; margin-top:4px;">
            <span>TOTAL NETO:</span>
            <span>$${totalAmount.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
        </div>

        <!-- Detalles de pago mixto si aplica -->
        ${paymentMethod === 'Dividido' ? `
            <div class="receipt-divider" style="border-top:1px dashed #000; margin:6px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5;">
                <span>Pago Efectivo Asignado:</span>
                <span>$${(sale.amount_cash || 0).toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5;">
                <span>Pago Digital Asignado:</span>
                <span>$${(sale.amount_card || 0).toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
        ` : ''}

        <!-- Detalle de Vuelto si fue pago en Efectivo o Dividido y se ingresó dinero -->
        ${(paymentMethod === 'Efectivo' || paymentMethod === 'Dividido') && cashReceived > 0 ? `
            <div class="receipt-divider" style="border-top:1px dashed #000; margin:6px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5;">
                <span>Abonó en Efectivo:</span>
                <span>$${cashReceived.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; line-height: 1.5; font-weight:bold;">
                <span>Vuelto de Efectivo:</span>
                <span>$${changeAmount.toLocaleString('es-AR', {minimumFractionDigits:2})}</span>
            </div>
        ` : ''}

        <div class="receipt-divider"></div>
        <div style="text-align:center; font-size:0.7rem; margin-top:20px; font-style:italic;">
            Gracias por elegir la elegancia de BELIA.<br>
            belialeather.com.ar
        </div>
    `;

    modalOverlay.classList.add('active');
}

// ==========================================================================
// CONTROL DE TURNOS DE CAJA Y ARQUEOS (UI CONTROLLER)
// ==========================================================================
async function checkShiftState() {
    activeShift = await getActiveShift();

    // Calcular número secuencial del turno activo
    activeShiftNumber = 0;
    if (activeShift) {
        try {
            const allShifts = await getCashShifts();
            const chronoSorted = [...allShifts].sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at));
            const idx = chronoSorted.findIndex(s => s.id === activeShift.id);
            activeShiftNumber = idx !== -1 ? idx + 1 : allShifts.length;
        } catch (e) {
            activeShiftNumber = 1;
        }
    }

    renderShiftPanel();
    
    const posLayout = document.querySelector('.pos-layout');
    if (posLayout) {
        if (activeShift) {
            posLayout.style.opacity = '1';
            posLayout.style.pointerEvents = 'auto';
        } else {
            posLayout.style.opacity = '0.15';
            posLayout.style.pointerEvents = 'none';
        }
    }
}

function renderShiftPanel() {
    const shiftPanel = document.getElementById('pos-cash-shift-panel');
    if (!shiftPanel) return;

    if (!activeShift) {
        // Caja Cerrada
        shiftPanel.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, rgba(212,175,55,0.06) 0%, rgba(14,14,13,0.95) 100%); border: 1.5px solid var(--color-border-gold); padding: 30px; border-radius: var(--radius-md); text-align: center; max-width: 600px; margin: 30px auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <i class="fas fa-lock" style="font-size: 3rem; color: var(--color-gold-light); margin-bottom: 16px; text-shadow: 0 0 10px rgba(212,175,55,0.3);"></i>
                <h2 style="font-family: var(--font-display); color: #FFF; margin-bottom: 8px; font-weight: 700;">Turno de Caja Cerrado</h2>
                <p style="color: var(--color-text-secondary); font-size: 0.9rem; margin-bottom: 24px; max-width: 450px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                    Para comenzar a vender, realizar transacciones y emitir comprobantes, por favor abre la caja ingresando el monto base de efectivo inicial.
                </p>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 320px; margin: 0 auto;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--color-gold-light); text-transform: uppercase; align-self: flex-start; margin-left: 2px;">Efectivo Inicial en Caja ($) *</label>
                    <input type="number" id="shift-opening-cash" class="form-input" placeholder="0.00" value="0.00" style="font-size: 1.5rem; font-weight: 900; text-align: center; padding: 10px; border-color: var(--color-border-gold); background: #000; color: #FFF; border-radius:var(--radius-sm);">
                    <button id="btn-open-shift" class="btn btn-primary" style="width: 100%; padding: 14px; font-weight: 700; font-size: 0.95rem; margin-top: 8px; border-radius:var(--radius-sm);">
                        <i class="fas fa-key"></i> Iniciar Turno de Caja
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-open-shift').addEventListener('click', async () => {
            const val = parseFloat(document.getElementById('shift-opening-cash').value);
            if (isNaN(val) || val < 0) {
                showToastCallback('Monto Inválido', 'Por favor ingresa un monto inicial válido.', 'warning');
                return;
            }
            
            try {
                const newShift = await openShift(val);
                showToastCallback('Turno Iniciado', `Caja abierta con un saldo inicial de $${val.toLocaleString('es-AR')}`, 'success');
                await checkShiftState();
            } catch (err) {
                console.error(err);
                showToastCallback('Error', 'No se pudo iniciar el turno de caja.', 'danger');
            }
        });
    } else {
        // Turno Activo
        const openedAtStr = new Date(activeShift.opened_at).toLocaleString('es-AR', {
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
        });
        const openingCashStr = parseFloat(activeShift.opening_cash).toLocaleString('es-AR', { minimumFractionDigits: 2 });

        shiftPanel.innerHTML = `
            <div class="card" style="background: rgba(14,14,13,0.7); backdrop-filter: blur(10px); border: 1px solid var(--color-border); padding: 14px 20px; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="pulse-indicator" style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #4ADE80; box-shadow: 0 0 10px #4ADE80;"></span>
                    <span style="color:var(--color-gold-light); font-weight:700; font-size:0.9rem; font-family:var(--font-display); letter-spacing:0.5px; opacity:0.9; flex-shrink:0;">#${activeShiftNumber}</span>
                    <div style="font-size: 0.9rem;">
                        <span style="color: var(--color-text-secondary); font-weight: 700; text-transform:uppercase; letter-spacing:0.5px; font-size:0.8rem;">Turno N°${activeShiftNumber} &mdash; Activo</span>
                        <span style="color: var(--color-text-muted); margin-left: 8px;">| Abierto: <strong style="color: #FFF;">${openedAtStr}</strong></span>
                        <span style="color: var(--color-text-muted); margin-left: 8px;">| Ef. Inicial: <strong style="color: var(--color-gold-light); font-weight:700;">$${openingCashStr}</strong></span>
                    </div>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button id="btn-arqueo-shift" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.8rem; font-weight: 700; border-color: var(--color-border-gold); color: var(--color-gold-light); border-radius:var(--radius-sm);">
                        <i class="fas fa-calculator"></i> Arqueo Parcial
                    </button>
                    <button id="btn-close-shift" class="btn btn-danger" style="padding: 8px 16px; font-size: 0.8rem; font-weight: 700; background-color: rgba(239, 68, 68, 0.12); border-color: var(--color-danger); color: var(--color-danger); border-radius:var(--radius-sm);">
                        <i class="fas fa-lock"></i> Finalizar Turno N°${activeShiftNumber}
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-arqueo-shift').addEventListener('click', () => openShiftAuditModal('arqueo'));
        document.getElementById('btn-close-shift').addEventListener('click', () => openShiftAuditModal('close'));
    }
}

async function openShiftAuditModal(mode) {
    const isClose = (mode === 'close');
    
    let shiftSales = [];
    try {
        if (!isDemoMode()) {
            const { data, error } = await supabaseClient
                .from('sales')
                .select('total_amount, payment_method, amount_cash, amount_card')
                .eq('shift_id', activeShift.id);
            if (error) throw error;
            shiftSales = data || [];
        } else {
            const allSales = JSON.parse(localStorage.getItem('BELIA_DEMO_SALES')) || [];
            shiftSales = allSales.filter(s => s.shift_id === activeShift.id);
        }
    } catch (err) {
        console.error(err);
        const allSales = JSON.parse(localStorage.getItem('BELIA_DEMO_SALES')) || [];
        shiftSales = allSales.filter(s => s.shift_id === activeShift.id);
    }

    const ventasEfectivo = shiftSales.reduce((sum, s) => sum + (parseFloat(s.amount_cash) || 0), 0);
    const ventasOnline   = shiftSales.reduce((sum, s) => sum + (parseFloat(s.amount_card) || 0), 0);
    const totalVentas    = ventasEfectivo + ventasOnline;
    const expectedCash   = parseFloat(activeShift.opening_cash) + ventasEfectivo;

    const fmt = (n) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const fmtDiff = (n) => {
        if (n === 0) return { txt: 'Sin diferencia', color: 'var(--color-success)' };
        return { txt: (n > 0 ? '+' : '') + fmt(n), color: n > 0 ? 'var(--color-gold-light)' : 'var(--color-danger)' };
    };

    const modalHtml = `
        <div style="font-family:var(--font-sans); color:var(--color-text-primary); padding:6px;">
            <div style="background:rgba(212,175,55,0.03); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:15px; margin-bottom:18px;">
                <h4 style="color:var(--color-gold-light); font-family:var(--font-display); font-size:0.8rem; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:12px; border-bottom:1px solid var(--color-border); padding-bottom:6px;">
                    <i class="fas fa-chart-bar" style="margin-right:6px;"></i>Resumen de Ventas del Turno
                </h4>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:0.88rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--color-text-muted);"><i class="fas fa-money-bill-wave" style="width:16px; color:#4ADE80; margin-right:6px;"></i>Ventas Efectivo:</span>
                        <span style="font-weight:700; color:#4ADE80;">${fmt(ventasEfectivo)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:var(--color-text-muted);"><i class="fas fa-credit-card" style="width:16px; color:#60A5FA; margin-right:6px;"></i>Ventas Online (Debito / Credito / Transf.):</span>
                        <span style="font-weight:700; color:#60A5FA;">${fmt(ventasOnline)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--color-border); padding-top:8px; margin-top:2px;">
                        <span style="font-weight:700; color:var(--color-text-primary); font-size:0.95rem;"><i class="fas fa-equals" style="width:16px; color:var(--color-gold-light); margin-right:6px;"></i>Total Ventas del Turno:</span>
                        <span style="font-weight:900; color:var(--color-gold-light); font-size:1.05rem;">${fmt(totalVentas)}</span>
                    </div>
                </div>
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(212,175,55,0.15); border-radius:var(--radius-sm); padding:12px 15px; margin-bottom:18px; font-size:0.83rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:var(--color-text-muted);">Efectivo Inicial Apertura:</span>
                    <span>${fmt(parseFloat(activeShift.opening_cash))}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="color:var(--color-text-muted);">+ Ventas Efectivo:</span>
                    <span style="color:#4ADE80;">${fmt(ventasEfectivo)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:700; border-top:1px solid var(--color-border); padding-top:6px; margin-top:4px;">
                    <span>Efectivo Esperado en Caja:</span>
                    <span style="color:var(--color-gold-light);">${fmt(expectedCash)}</span>
                </div>
            </div>
            <h4 style="color:var(--color-gold-light); margin-bottom:12px; font-family:var(--font-display); text-transform:uppercase; font-size:0.78rem; letter-spacing:0.5px;">
                <i class="fas fa-hand-holding-dollar" style="margin-right:6px;"></i>Valores Contados Fisicamente
            </h4>
            <div style="display:flex; gap:16px; margin-bottom:16px;">
                <div class="form-group" style="flex:1;">
                    <label class="form-label" style="font-size:0.8rem; color:#4ADE80;">Efectivo Contado ($) *</label>
                    <input type="number" id="arqueo-actual-cash" class="form-input" placeholder="0.00"
                        style="font-weight:700; font-size:1.2rem; border-color:#4ADE80; text-align:right; background:rgba(74,222,128,0.04);" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label class="form-label" style="font-size:0.8rem; color:#60A5FA;">Online Contado ($) *</label>
                    <input type="number" id="arqueo-actual-card" class="form-input" placeholder="0.00"
                        style="font-weight:700; font-size:1.2rem; border-color:#60A5FA; text-align:right; background:rgba(96,165,250,0.04);" required>
                </div>
            </div>
            <div style="background:#000; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:14px 18px; margin-bottom:18px;">
                <div style="display:grid; grid-template-columns:1fr 1px 1fr 1px 1fr; gap:12px; align-items:center; text-align:center;">
                    <div>
                        <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">Dif. Efectivo</div>
                        <div id="arqueo-diff-cash" style="font-size:1.2rem; font-weight:900; color:var(--color-gold-light);">-</div>
                    </div>
                    <div style="height:35px; background:var(--color-border);"></div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">Dif. Online</div>
                        <div id="arqueo-diff-card" style="font-size:1.2rem; font-weight:900; color:var(--color-gold-light);">-</div>
                    </div>
                    <div style="height:35px; background:var(--color-border);"></div>
                    <div>
                        <div style="font-size:0.7rem; color:var(--color-gold-light); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px; font-weight:700;">Total Caja</div>
                        <div id="arqueo-total-caja" style="font-size:1.2rem; font-weight:900; color:var(--color-gold-light);">-</div>
                        <div id="arqueo-total-caja-nota" style="font-size:0.65rem; color:var(--color-text-muted); margin-top:2px;"></div>
                    </div>
                </div>
            </div>
            ${isClose ? `
            <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label" style="font-size:0.8rem;">Observaciones de Cierre</label>
                <textarea id="arqueo-notes" class="form-input" placeholder="Ej: Cambio de billetes, notas del turno, etc." style="height:55px; resize:none; font-size:0.85rem; padding:8px 12px;"></textarea>
            </div>
            ` : ''}
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:16px;">
                <button type="button" class="btn btn-secondary" id="arqueo-btn-cancel">Cancelar</button>
                <button type="button" class="btn btn-primary" id="arqueo-btn-submit">
                    ${isClose ? '<i class="fas fa-lock"></i> Confirmar y Cerrar Caja' : '<i class="fas fa-check"></i> Registrar Arqueo'}
                </button>
            </div>
        </div>
    `;

    openModalOverlayCallback(isClose ? "Finalizar y Cerrar Turno de Caja" : "Arqueo Parcial de Valores", modalHtml);

    const actualCashInput = document.getElementById('arqueo-actual-cash');
    const actualCardInput = document.getElementById('arqueo-actual-card');

    const updateArqueoDiffs = () => {
        const actCash = parseFloat(actualCashInput.value) || 0;
        const actCard = parseFloat(actualCardInput.value) || 0;
        const cashDiff  = actCash - expectedCash;
        const cardDiff  = actCard - ventasOnline;
        const totalContado  = actCash + actCard;
        const totalEsperado = expectedCash + ventasOnline;
        const totalDiff = totalContado - totalEsperado;

        const cashEl  = document.getElementById('arqueo-diff-cash');
        const cardEl  = document.getElementById('arqueo-diff-card');
        const totalEl = document.getElementById('arqueo-total-caja');
        const notaEl  = document.getElementById('arqueo-total-caja-nota');

        const applyDiff = (el, diff) => {
            if (!el) return;
            const { txt, color } = fmtDiff(diff);
            el.textContent = txt;
            el.style.color = color;
        };

        applyDiff(cashEl, cashDiff);
        applyDiff(cardEl, cardDiff);
        applyDiff(totalEl, totalDiff);

        if (notaEl) {
            if (cashDiff < 0 && cardDiff > 0 && totalDiff >= 0) {
                notaEl.textContent = 'El online compenso el faltante';
                notaEl.style.color = 'var(--color-success)';
            } else if (totalDiff < 0) {
                notaEl.textContent = 'Faltante total: ' + fmt(Math.abs(totalDiff));
                notaEl.style.color = 'var(--color-danger)';
            } else if (totalDiff > 0) {
                notaEl.textContent = 'Sobrante: ' + fmt(totalDiff);
                notaEl.style.color = 'var(--color-gold-light)';
            } else {
                notaEl.textContent = 'Caja cuadrada';
                notaEl.style.color = 'var(--color-success)';
            }
        }
    };

    actualCashInput.addEventListener('input', updateArqueoDiffs);
    actualCardInput.addEventListener('input', updateArqueoDiffs);

    document.getElementById('arqueo-btn-cancel').addEventListener('click', closeModalOverlayCallback);

    document.getElementById('arqueo-btn-submit').addEventListener('click', async () => {
        const actCash = parseFloat(actualCashInput.value);
        const actCard = parseFloat(actualCardInput.value);

        if (isNaN(actCash) || isNaN(actCard) || actCash < 0 || actCard < 0) {
            showToastCallback('Campos Requeridos', 'Por favor ingresa los montos contados de efectivo y online.', 'warning');
            return;
        }

        if (!isClose) {
            showToastCallback('Arqueo Registrado', 'Los valores declarados fueron registrados correctamente.', 'success');
            closeModalOverlayCallback();
        } else {
            try {
                const notes = document.getElementById('arqueo-notes').value.trim();
                const closedShift = await closeShift(activeShift.id, actCash, actCard, notes);
                const closedShiftNumber = activeShiftNumber;
                showToastCallback('Caja Cerrada', `Turno N${closedShiftNumber} finalizado.`, 'success');
                closeModalOverlayCallback();
                showShiftReportModal(closedShift, { ventasEfectivo, ventasOnline, totalVentas, expectedCash, shiftNumber: closedShiftNumber });
                await checkShiftState();
            } catch (err) {
                console.error(err);
                showToastCallback('Error de Cierre', 'No se pudo cerrar la caja en este momento.', 'danger');
            }
        }
    });
}

function showShiftReportModal(shift, data) {
    const { ventasEfectivo, ventasOnline, totalVentas, expectedCash, shiftNumber } = data;
    const numLabel  = shiftNumber ? `Turno N${shiftNumber}` : 'Turno';
    const actCash   = parseFloat(shift.actual_cash) || 0;
    const actCard   = parseFloat(shift.actual_card) || 0;
    const cashDiff  = actCash - expectedCash;
    const cardDiff  = actCard - ventasOnline;
    const totalContado  = actCash + actCard;
    const totalEsperado = expectedCash + ventasOnline;
    const totalDiff = totalContado - totalEsperado;

    const fmt = (n) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const diffColor = (n) => n === 0 ? 'var(--color-success)' : n > 0 ? 'var(--color-gold-light)' : 'var(--color-danger)';
    const diffTxt   = (n) => n === 0 ? 'Sin diferencia' : (n > 0 ? `Sobrante: +${fmt(n)}` : `Faltante: -${fmt(Math.abs(n))}`);

    let totalCajaNota = '';
    if (cashDiff < 0 && cardDiff > 0 && totalDiff >= 0) {
        totalCajaNota = `<div style="font-size:0.78rem; color:var(--color-success); margin-top:6px;">El online compenso el faltante de efectivo</div>`;
    } else if (totalDiff < 0) {
        totalCajaNota = `<div style="font-size:0.78rem; color:var(--color-danger); margin-top:6px;">Faltante combinado: -${fmt(Math.abs(totalDiff))}</div>`;
    } else if (totalDiff > 0) {
        totalCajaNota = `<div style="font-size:0.78rem; color:var(--color-gold-light); margin-top:6px;">Sobrante combinado: +${fmt(totalDiff)}</div>`;
    }

    const reportHtml = `
        <div style="font-family:var(--font-sans); color:var(--color-text-primary); padding:10px 5px;">
            <div style="text-align:center; margin-bottom:20px;">
                <i class="fas fa-file-invoice-dollar" style="font-size:3rem; color:var(--color-gold-light); margin-bottom:12px; text-shadow:0 0 15px rgba(212,175,55,0.3);"></i>
                <h3 style="font-family:var(--font-display); font-size:1.2rem; margin-bottom:4px;">PLANILLA DE CIERRE</h3>
                <p style="color:var(--color-text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px;">${numLabel} Finalizado</p>
            </div>
            <div style="background:rgba(212,175,55,0.03); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:14px; margin-bottom:14px;">
                <div style="font-size:0.72rem; color:var(--color-gold-light); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Ventas del Turno</div>
                <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:6px;">
                    <span style="color:var(--color-text-muted);">Ventas Efectivo</span>
                    <span style="font-weight:700; color:#4ADE80;">${fmt(ventasEfectivo)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.88rem; margin-bottom:10px;">
                    <span style="color:var(--color-text-muted);">Ventas Online (Deb/Cred/Transf)</span>
                    <span style="font-weight:700; color:#60A5FA;">${fmt(ventasOnline)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:1rem; font-weight:900; border-top:1px dashed var(--color-border); padding-top:8px;">
                    <span>Total Ventas</span>
                    <span style="color:var(--color-gold-light);">${fmt(totalVentas)}</span>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                <div style="background:#000; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:12px; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; margin-bottom:6px;">Diferencia Efectivo</div>
                    <div style="font-size:1.1rem; font-weight:900; color:${diffColor(cashDiff)};">${diffTxt(cashDiff)}</div>
                    <div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:3px;">Esp. ${fmt(expectedCash)} / Cont. ${fmt(actCash)}</div>
                </div>
                <div style="background:#000; border:1px solid var(--color-border); border-radius:var(--radius-sm); padding:12px; text-align:center;">
                    <div style="font-size:0.7rem; color:var(--color-text-muted); text-transform:uppercase; margin-bottom:6px;">Diferencia Online</div>
                    <div style="font-size:1.1rem; font-weight:900; color:${diffColor(cardDiff)};">${diffTxt(cardDiff)}</div>
                    <div style="font-size:0.7rem; color:var(--color-text-muted); margin-top:3px;">Esp. ${fmt(ventasOnline)} / Cont. ${fmt(actCard)}</div>
                </div>
            </div>
            <div style="background:linear-gradient(135deg, rgba(212,175,55,0.08), rgba(0,0,0,0.6)); border:1.5px solid var(--color-border-gold); border-radius:var(--radius-md); padding:16px; text-align:center; margin-bottom:20px;">
                <div style="font-size:0.72rem; color:var(--color-gold-light); font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">
                    Total Caja (Efectivo + Online)
                </div>
                <div style="font-size:1.4rem; font-weight:900; color:${diffColor(totalDiff)};">${diffTxt(totalDiff)}</div>
                <div style="font-size:0.78rem; color:var(--color-text-muted); margin-top:5px;">Esperado ${fmt(totalEsperado)} / Contado ${fmt(totalContado)}</div>
                ${totalCajaNota}
            </div>
            <div style="display:flex; gap:12px; margin-top:16px;">
                <button class="btn btn-secondary" style="padding:10px 20px; font-weight:700; flex:1; border-color:var(--color-border-gold); color:var(--color-gold-light);" id="report-print-btn">
                    <i class="fas fa-print"></i> Imprimir Reporte
                </button>
                <button class="btn btn-primary" style="padding:10px 20px; font-weight:700; flex:1;" id="report-close-btn">
                    Finalizar y Continuar
                </button>
            </div>
        </div>
    `;

    openModalOverlayCallback("Analisis de Cierre de Caja", reportHtml);
    document.getElementById('report-close-btn').addEventListener('click', closeModalOverlayCallback);
    document.getElementById('report-print-btn').addEventListener('click', () => {
        printShiftReport(shift, data);
    });
}

// Función global para imprimir o guardar como PDF la planilla de cierre de caja
function printShiftReport(shift, data) {
    const { ventasEfectivo, ventasOnline, totalVentas, expectedCash, shiftNumber } = data;
    const numLabel  = shiftNumber ? `Turno N°${shiftNumber}` : 'Turno';
    const actCash   = parseFloat(shift.actual_cash) || 0;
    const actCard   = parseFloat(shift.actual_card) || 0;
    const cashDiff  = actCash - expectedCash;
    const cardDiff  = actCard - ventasOnline;
    const totalContado  = actCash + actCard;
    const totalEsperado = expectedCash + ventasOnline;
    const totalDiff = totalContado - totalEsperado;

    const fmt = (n) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
    
    // Crear ventana emergente de impresión
    const printWindow = window.open('', '', 'height=700,width=600');
    if (!printWindow) {
        alert("Por favor habilite las ventanas emergentes (popups) para poder imprimir el reporte.");
        return;
    }
    
    printWindow.document.write('<!DOCTYPE html><html><head><title>Planilla de Cierre - BELIA</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: "Courier New", monospace; color: #000; padding: 30px; text-align: left; background-color: #fff; line-height: 1.4; }');
    printWindow.document.write('.report-header { text-align: center; margin-bottom: 20px; }');
    printWindow.document.write('.report-brand { font-size: 1.6rem; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }');
    printWindow.document.write('.report-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }');
    printWindow.document.write('.report-subtitle { font-size: 0.9rem; color: #555; }');
    printWindow.document.write('.divider { border-top: 1px solid #000; margin: 12px 0; }');
    printWindow.document.write('.divider-dashed { border-top: 1px dashed #000; margin: 12px 0; }');
    printWindow.document.write('.info-table { width: 100%; font-size: 0.9rem; border-collapse: collapse; margin-bottom: 10px; }');
    printWindow.document.write('.info-table td { padding: 4px 0; }');
    printWindow.document.write('.info-table td.label { font-weight: bold; width: 45%; }');
    printWindow.document.write('.section-title { font-size: 1rem; font-weight: bold; margin-top: 15px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 4px; text-transform: uppercase; }');
    printWindow.document.write('.data-table { width: 100%; font-size: 0.9rem; border-collapse: collapse; }');
    printWindow.document.write('.data-table td { padding: 4px 0; }');
    printWindow.document.write('.data-table td.right { text-align: right; }');
    printWindow.document.write('.data-table tr.total-row { font-weight: bold; font-size: 0.95rem; }');
    printWindow.document.write('.data-table tr.total-row td { border-top: 1px dashed #000; padding-top: 6px; }');
    printWindow.document.write('.notes-box { font-size: 0.85rem; font-style: italic; white-space: pre-wrap; background: #f9f9f9; padding: 8px; border: 1px solid #ddd; margin-top: 6px; }');
    printWindow.document.write('@media print { body { padding: 10px; } }');
    printWindow.document.write('</style></head><body>');

    printWindow.document.write(`
        <div class="report-header">
            <div class="report-brand">Belia Leather</div>
            <div class="report-title">Planilla de Cierre de Caja</div>
            <div class="report-subtitle">${numLabel} &mdash; ${shift.status === 'open' ? 'Activo' : 'Cerrado'}</div>
        </div>
        <div class="divider"></div>
        <table class="info-table">
            <tr>
                <td class="label">Responsable:</td>
                <td>${shift.opened_by || 'Administrador'}</td>
            </tr>
            <tr>
                <td class="label">Fecha Apertura:</td>
                <td>${new Date(shift.opened_at).toLocaleString('es-AR')}</td>
            </tr>
            <tr>
                <td class="label">Fecha Cierre:</td>
                <td>${shift.closed_at ? new Date(shift.closed_at).toLocaleString('es-AR') : 'Sin cerrar (Activo)'}</td>
            </tr>
        </table>
        
        <div class="section-title">Resumen de Ventas</div>
        <table class="data-table">
            <tr>
                <td>Ventas Efectivo:</td>
                <td class="right" style="font-weight:bold; color:#000;">${fmt(ventasEfectivo)}</td>
            </tr>
            <tr>
                <td>Ventas Online (Déb/Créd/Transf):</td>
                <td class="right" style="font-weight:bold; color:#000;">${fmt(ventasOnline)}</td>
            </tr>
            <tr class="total-row">
                <td>Total Ventas del Turno:</td>
                <td class="right">${fmt(totalVentas)}</td>
            </tr>
        </table>
        
        <div class="section-title">Auditoría de Valores (Arqueo)</div>
        <table class="data-table">
            <tr>
                <td>Efectivo Inicial Apertura:</td>
                <td class="right">${fmt(parseFloat(shift.opening_cash))}</td>
            </tr>
            <tr>
                <td>+ Ventas Efectivo:</td>
                <td class="right">${fmt(ventasEfectivo)}</td>
            </tr>
            <tr class="total-row" style="font-size:0.9rem; font-weight:normal;">
                <td style="border-top:1px solid #ccc; padding-top:4px;">Efectivo Esperado en Caja:</td>
                <td class="right" style="border-top:1px solid #ccc; padding-top:4px; font-weight:bold;">${fmt(expectedCash)}</td>
            </tr>
            <tr>
                <td>Efectivo Contado Físicamente:</td>
                <td class="right" style="font-weight:bold;">${fmt(actCash)}</td>
            </tr>
            <tr style="font-weight:bold; color:${cashDiff < 0 ? '#d9534f' : '#000'}">
                <td>Diferencia Efectivo:</td>
                <td class="right">${cashDiff > 0 ? '+' : ''}${fmt(cashDiff)}</td>
            </tr>
            
            <tr style="height: 10px;"><td colspan="2"></td></tr>
            
            <tr>
                <td>Online Esperado:</td>
                <td class="right">${fmt(ventasOnline)}</td>
            </tr>
            <tr>
                <td>Online Declarado / Contado:</td>
                <td class="right" style="font-weight:bold;">${fmt(actCard)}</td>
            </tr>
            <tr style="font-weight:bold; color:${cardDiff < 0 ? '#d9534f' : '#000'}">
                <td>Diferencia Online:</td>
                <td class="right">${cardDiff > 0 ? '+' : ''}${fmt(cardDiff)}</td>
            </tr>
            
            <tr style="height: 10px;"><td colspan="2"></td></tr>
            
            <tr class="total-row" style="font-size:1rem; border-top:1px solid #000; border-bottom:1px solid #000;">
                <td style="padding: 6px 0;">DIFERENCIA TOTAL COMBINADA:</td>
                <td class="right" style="padding: 6px 0; color:${totalDiff < 0 ? '#d9534f' : '#000'}">${totalDiff > 0 ? '+' : ''}${fmt(totalDiff)}</td>
            </tr>
        </table>
        
        ${shift.notes ? `
            <div class="section-title">Observaciones de Cierre</div>
            <div class="notes-box">${shift.notes}</div>
        ` : ''}
        
        <div class="divider-dashed" style="margin-top:40px;"></div>
        <div style="text-align:center; font-size:0.75rem; color:#666; font-style:italic;">
            Planilla de control interno de caja - Belia Leather
        </div>
    `);

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}