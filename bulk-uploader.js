/* ==========================================================================
   BELIA CRM - LÓGICA DE CARGA MASIVA DE INVENTARIO (BULK UPLOADER)
   ========================================================================== */

// Variables de estado del uploader
let parsedRows = [];
let onImportSuccessCallback = null;

// ==========================================================================
// PARSER CSV INTEGRADO (JavaScript Puro, Robusto)
// ==========================================================================
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                row[row.length - 1] += '"';
                i++; // Saltear comilla escapada
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push("");
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++; // Saltear retorno de carro completo
            }
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += char;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    return lines;
}

// ==========================================================================
// INICIALIZACIÓN DE COMPORTAMIENTOS DEL PANEL
// ==========================================================================
function initBulkUploader(showToast, onSuccess) {
    onImportSuccessCallback = onSuccess;

    const dragArea = document.getElementById('bulk-drag-area');
    const fileInput = document.getElementById('bulk-file-input');
    const btnDownloadTemplate = document.getElementById('btn-download-template');
    const btnConfirmImport = document.getElementById('btn-confirm-bulk-import');
    const btnCancelImport = document.getElementById('btn-cancel-bulk-import');
    const previewContainer = document.getElementById('bulk-preview-container');

    if (!dragArea) return;

    // Descarga de Plantilla CSV
    btnDownloadTemplate.addEventListener('click', () => {
        downloadCSVTemplate();
    });

    // Eventos de Arrastre (Drag and Drop)
    dragArea.addEventListener('click', () => fileInput.click());

    dragArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragArea.classList.add('dragover');
    });

    dragArea.addEventListener('dragleave', () => {
        dragArea.classList.remove('dragover');
    });

    dragArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dragArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleUploadedFile(files[0], showToast, previewContainer, btnConfirmImport);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleUploadedFile(e.target.files[0], showToast, previewContainer, btnConfirmImport);
        }
    });

    // Acciones del Panel de Previsualización
    btnCancelImport.addEventListener('click', () => {
        clearBulkUpload(previewContainer, btnConfirmImport);
        showToast('Acción Cancelada', 'Se limpiaron los datos cargados.', 'info');
    });

    btnConfirmImport.addEventListener('click', async () => {
        if (parsedRows.length === 0) return;

        // Comprobar si hay errores antes de proceder
        const hasErrors = parsedRows.some(row => row.errors.length > 0);
        if (hasErrors) {
            showToast('Errores Detectados', 'Por favor, corrige los registros marcados en rojo antes de importar.', 'danger');
            return;
        }

        try {
            btnConfirmImport.disabled = true;
            btnConfirmImport.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';

            // Agrupar variantes por producto único
            const productsList = [];
            const variantsMap = {};

            parsedRows.forEach(item => {
                const existingProd = productsList.find(p => p.name === item.nombre);
                
                if (!existingProd) {
                    productsList.push({
                        name: item.nombre,
                        category: item.categoria,
                        description: item.descripcion,
                        cost_price: item.precioCosto,
                        selling_price: item.precioVenta,
                        image_url: item.imagenUrl,
                        supplier_code: item.supplier_code || "",
                        supplier_name: item.supplier_name || "SKULL Custom Leather"
                    });
                    variantsMap[item.nombre] = [];
                }

                variantsMap[item.nombre].push({
                    size: item.talle,
                    color: item.color,
                    stock: item.stock,
                    sku: item.sku,
                    piel: item.piel
                });
            });

            // Llamar a la capa de datos
            const result = await importInventoryBatch(productsList, variantsMap);
            
            // Auto-aprendizaje Masivo: Registrar todas las imágenes personalizadas en la biblioteca de fotos
            for (const item of parsedRows) {
                if (item.imagenUrl && !item.imagenUrl.includes('placeholder') && item.imagenUrl.trim() !== '') {
                    if (typeof saveCustomPhoto === 'function') {
                        await saveCustomPhoto(item.nombre, item.color, item.imagenUrl);
                    }
                }
            }
            
            showToast('¡Importación Exitosa!', `Se importaron ${result.count} productos de cuero correctamente.`, 'success');
            clearBulkUpload(previewContainer, btnConfirmImport);
            
            if (onImportSuccessCallback) {
                onImportSuccessCallback();
            }
        } catch (error) {
            console.error(error);
            showToast('Error de Base de Datos', 'No se pudo completar la inserción en Supabase.', 'danger');
        } finally {
            btnConfirmImport.disabled = false;
            btnConfirmImport.textContent = 'Confirmar e Importar al Stock';
        }
    });
}

// Procesar el Archivo (CSV o PDF)
function handleUploadedFile(file, showToast, previewContainer, btnConfirmImport) {
    const fileNameLower = file.name.toLowerCase();
    const isCSV = fileNameLower.endsWith('.csv');
    const isPDF = fileNameLower.endsWith('.pdf');

    if (!isCSV && !isPDF) {
        showToast('Formato Inválido', 'Solo se admiten archivos en formato .csv o .pdf', 'danger');
        return;
    }

    if (isCSV) {
        handleCSVFile(file, showToast, previewContainer, btnConfirmImport);
    } else {
        handlePDFFile(file, showToast, previewContainer, btnConfirmImport);
    }
}

// Procesar el Archivo CSV
function handleCSVFile(file, showToast, previewContainer, btnConfirmImport) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        try {
            const rawRows = parseCSV(text);
            if (rawRows.length < 2) {
                showToast('Archivo Vacío', 'El CSV cargado no contiene registros suficientes.', 'warning');
                return;
            }

            // Mapear Cabeceras
            const headers = rawRows[0].map(h => h.trim().toLowerCase());
            const dataRows = rawRows.slice(1);

            parsedRows = dataRows.map((row, idx) => {
                const getVal = (colNames) => {
                    for (const name of colNames) {
                        const colIdx = headers.indexOf(name.toLowerCase());
                        if (colIdx !== -1) return row[colIdx]?.trim();
                    }
                    return '';
                };

                const nombre = getVal(['Nombre', 'Name', 'Producto']);
                const categoria = getVal(['Categoria', 'Category', 'Rubro']) || 'Accesorios';
                const descripcion = getVal(['Descripcion', 'Description', 'Detalle']);
                const talle = getVal(['Talle', 'Size', 'Medida']) || 'M';
                const color = getVal(['Color', 'Tono']) || 'Negro';
                const pielRaw = getVal(['Piel', 'TipoPiel', 'Skin', 'Cuero']);
                const piel = (pielRaw && (pielRaw.toLowerCase().includes('oveja') || pielRaw.toLowerCase().includes('cordero'))) ? 'Oveja' : 'Vaca';
                const stockStr = getVal(['Stock', 'Cantidad', 'Cant']);
                const precioCostoStr = getVal(['PrecioCosto', 'Costo', 'Cost']);
                const precioVentaStr = getVal(['PrecioVenta', 'Precio', 'Price']);
                const imagenUrlRaw = getVal(['ImagenURL', 'Imagen', 'Image']);
                const imagenUrl = (!imagenUrlRaw || imagenUrlRaw.includes('placeholder')) ? getProductImage(nombre, categoria, color) : imagenUrlRaw;
                const supplier_code = getVal(['CodigoProveedor', 'SupplierCode', 'CodigoArticulo', 'Codigo']);
                const sku = getVal(['SKU', 'CodigoVariant', 'SkuVariante']) || generateSKU(supplier_code, color, talle, piel);
                const supplier_name = getVal(['Proveedor', 'Supplier', 'Marca']) || 'SKULL Custom Leather';

                // Validaciones
                const errors = [];
                if (!nombre) errors.push("Nombre de prenda requerido.");
                
                const stock = parseInt(stockStr);
                if (isNaN(stock) || stock < 0) errors.push("Stock debe ser un entero positivo.");

                const precioCosto = parseFloat(precioCostoStr);
                if (isNaN(precioCosto) || precioCosto < 0) errors.push("Costo debe ser un número válido.");

                const precioVenta = parseFloat(precioVentaStr);
                if (isNaN(precioVenta) || precioVenta < 0) errors.push("Precio venta debe ser un número válido.");

                return {
                    lineIndex: idx + 2,
                    nombre,
                    categoria,
                    descripcion,
                    talle,
                    color,
                    piel,
                    stock: isNaN(stock) ? 0 : stock,
                    precioCosto: isNaN(precioCosto) ? 0 : precioCosto,
                    precioVenta: isNaN(precioVenta) ? 0 : precioVenta,
                    imagenUrl,
                    sku,
                    supplier_code,
                    supplier_name,
                    errors
                };
            }).filter(item => item.nombre || item.stock || item.precioVenta); // Filtrar líneas vacías

            if (parsedRows.length === 0) {
                showToast('Sin datos', 'No se encontraron registros válidos en el archivo.', 'warning');
                return;
            }

            // Renderizar la Previsualización
            renderPreviewTable(previewContainer);
            previewContainer.style.display = 'block';
            btnConfirmImport.style.display = 'inline-flex';

            showToast('Archivo Cargado', `Se leyeron ${parsedRows.length} registros. Revisa la tabla de validación.`, 'success');
        } catch (err) {
            console.error(err);
            showToast('Error de Lectura', 'Hubo un inconveniente al analizar el archivo CSV.', 'danger');
        }
    };
    reader.readAsText(file);
}

// Procesar el Remito o Factura en PDF (Lectura y Parseo Inteligente)
function handlePDFFile(file, showToast, previewContainer, btnConfirmImport) {
    const reader = new FileReader();
    reader.onload = async function (e) {
        const arrayBuffer = e.target.result;
        try {
            // Inicializar PDF.js
            if (typeof pdfjsLib === 'undefined') {
                showToast('Librería ausente', 'Cargando lector de PDF. Por favor, reintenta en un instante.', 'warning');
                return;
            }

            // Configurar el worker de PDF.js
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            let lines = [];
            
            // Recorrer todas las páginas del PDF
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const items = textContent.items;

                if (!items || items.length === 0) continue;

                // Agrupar items por línea basándose en su coordenada Y (transform[5])
                const linesMap = {};
                items.forEach(item => {
                    if (!item.str.trim()) return;
                    const y = Math.round(item.transform[5] * 10) / 10;
                    // Buscar si ya existe una línea Y similar dentro de una tolerancia de 3px
                    let foundKey = Object.keys(linesMap).find(key => Math.abs(parseFloat(key) - y) < 3);
                    if (!foundKey) {
                        foundKey = y.toString();
                        linesMap[foundKey] = [];
                    }
                    linesMap[foundKey].push(item);
                });

                // Ordenar verticalmente las líneas (Y decreciente, de arriba a abajo)
                const sortedYKeys = Object.keys(linesMap).sort((a, b) => parseFloat(b) - parseFloat(a));

                // Formatear cada línea concatenando sus elementos ordenados de izquierda a derecha (X creciente)
                sortedYKeys.forEach(yKey => {
                    const lineItems = linesMap[yKey].sort((a, b) => a.transform[4] - b.transform[4]);
                    const lineStr = lineItems.map(item => item.str).join(' ').trim();
                    if (lineStr) lines.push(lineStr);
                });
            }

            console.log("PDF Lines extracted:", lines);

            // Analizar las líneas buscando las filas del remito
            // Expresión regular para filas de Dux Software
            // Ejemplo: "150 - MILANO 39 MARRON 1,00 79.000,00 0,00 79.000,00"
            const itemRegex = /^([0-9a-zA-Z\-]+)\s*-\s*(.+?)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)$/;
            
            // Lista de colores conocidos en el catálogo para guiar el tokenizador
            const KNOWN_COLORS = ["NEGRO", "MARRON", "MARRÓN", "VINTAGE", "GRIS", "SUELA", "CRUSH", "CAMEL", "CHOCOLATE", "BLANCO", "ROJO", "BORDO", "BORDEAUX", "AZUL", "VENEZIA"];

            const rawRows = [];

            lines.forEach(line => {
                const match = line.match(itemRegex);
                if (match) {
                    const code = match[1].trim();
                    const rawDesc = match[2].trim();
                    const qtyStr = match[3].trim();
                    const costStr = match[4].trim();

                    // Convertir cantidad a entero
                    const stock = parseInt(qtyStr.replace(',', '.')) || 0;

                    // Convertir precio costo en Pesos Argentinos (ARS) de forma íntegra
                    let rawCost = parseFloat(costStr.replace(/\./g, '').replace(',', '.')) || 0;

                    // Tokenizar descripción para separar Nombre, Talle y Color
                    const tokens = rawDesc.split(/\s+/);
                    let talle = 'M';
                    let color = 'Negro';
                    let piel = 'Vaca';
                    const nameTokens = [];

                    tokens.forEach(tok => {
                        const cleanTok = tok.trim().toUpperCase();
                        
                        // Si es un talle numérico (35 a 46 para calzado) o talle de ropa (S, M, L, XL, etc.)
                        if ((/^\d+$/.test(cleanTok) && parseInt(cleanTok) >= 30 && parseInt(cleanTok) <= 48) || 
                            ["S", "M", "L", "XL", "XXL", "U", "UNI", "XS", "XXS"].includes(cleanTok)) {
                            talle = cleanTok;
                        } 
                        // Si es un color conocido
                        else if (KNOWN_COLORS.includes(cleanTok)) {
                            color = tok; // Mantener capitalización original
                        } 
                        // Si es tipo de piel
                        else if (cleanTok === 'OVEJA' || cleanTok === 'CORDERO') {
                            piel = 'Oveja';
                        }
                        else if (cleanTok === 'VACA' || cleanTok === 'VACUNO') {
                            piel = 'Vaca';
                        }
                        // Si no es un guion de relleno
                        else if (tok !== '-') {
                            nameTokens.push(tok);
                        }
                    });

                    let nombre = nameTokens.join(' ').trim();
                    
                    // Si el nombre quedó vacío o muy corto, usar la descripción completa
                    if (!nombre) nombre = rawDesc;

                    rawRows.push({
                        supplier_code: code,
                        nombre: nombre,
                        talle: talle,
                        color: color,
                        piel: piel,
                        stock: stock,
                        precioCosto: rawCost
                    });
                }
            });

            if (rawRows.length === 0) {
                showToast('Remito no reconocido', 'No se detectó el formato de tabla de remito en el PDF.', 'warning');
                return;
            }

            // Mapear con la base de datos de productos existente para completar campos ausentes (categorías, descripciones, precio de venta real)
            let dbProducts = [];
            if (typeof getProducts === 'function') {
                dbProducts = await getProducts();
            }

            parsedRows = rawRows.map((item, idx) => {
                // Intentar buscar coincidencia en la base de datos por código de proveedor o por coincidencia parcial de nombre
                const matchedDb = dbProducts.find(p => 
                    (p.supplier_code && p.supplier_code.toLowerCase().trim() === item.supplier_code.toLowerCase().trim()) ||
                    (p.name.toLowerCase().includes(item.nombre.toLowerCase()) || item.nombre.toLowerCase().includes(p.name.toLowerCase()))
                );

                const nombreFinal = matchedDb ? matchedDb.name : item.nombre;
                const categoria = matchedDb ? matchedDb.category : (item.nombre.toLowerCase().includes('bota') || item.nombre.toLowerCase().includes('zapato') ? 'Calzado' : (item.nombre.toLowerCase().includes('gorra') ? 'Gorras' : 'Accesorios'));
                const descripcion = matchedDb ? matchedDb.description : `Importado automáticamente de remito proveedor con código ${item.supplier_code}`;
                
                // Si el producto existe en DB, usar su precio de venta real. Si no existe, sugerir un margen de 2.2x
                const precioVenta = matchedDb ? matchedDb.selling_price : (item.precioCosto * 2.2);
                
                // Si no existe, sugerir marca proveedora "SKULL Custom Leather" si el código coincide con los preexistentes
                const supplier_name = matchedDb ? matchedDb.supplier_name : (['105', '129', '209', '150', '158'].includes(item.supplier_code) ? 'SKULL Custom Leather' : 'Proveedor Externo');

                const sku = generateSKU(item.supplier_code, item.color, item.talle, item.piel);

                const errors = [];
                if (!nombreFinal) errors.push("Nombre de prenda requerido.");
                if (item.stock <= 0) errors.push("Stock debe ser mayor a 0.");

                return {
                    lineIndex: idx + 1,
                    nombre: nombreFinal,
                    categoria,
                    descripcion,
                    talle: item.talle,
                    color: item.color,
                    piel: item.piel,
                    stock: item.stock,
                    precioCosto: item.precioCosto,
                    precioVenta: Math.round(precioVenta * 100) / 100,
                    imagenUrl: matchedDb ? matchedDb.image_url : getProductImage(nombreFinal, categoria, item.color),
                    sku: sku,
                    supplier_code: item.supplier_code,
                    supplier_name,
                    errors
                };
            });

            // Renderizar la Previsualización
            renderPreviewTable(previewContainer);
            previewContainer.style.display = 'block';
            btnConfirmImport.style.display = 'inline-flex';

            showToast('Remito PDF Procesado', `Se reconocieron ${parsedRows.length} variantes de stock listas para ingresar.`, 'success');
        } catch (err) {
            console.error("Critical error parsing PDF:", err);
            showToast('Error de Lectura', 'No se pudo procesar el PDF. Asegúrate de que no sea una imagen escaneada sin texto.', 'danger');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Limpiar Previsualización
function clearBulkUpload(previewContainer, btnConfirmImport) {
    parsedRows = [];
    previewContainer.style.display = 'none';
    btnConfirmImport.style.display = 'none';
    document.getElementById('bulk-file-input').value = '';
}

// Renderizar Tabla de Vista Previa
function renderPreviewTable(container) {
    const tableBody = container.querySelector('#bulk-preview-body');
    tableBody.innerHTML = '';

    parsedRows.forEach((row, index) => {
        const tr = document.createElement('tr');
        if (row.errors.length > 0) {
            tr.classList.add('row-has-error');
        }

        tr.innerHTML = `
            <td style="font-weight:700; color:var(--color-gold-light)">#${row.lineIndex}</td>
            <td>
                <input type="text" class="form-input cell-edit" data-field="nombre" data-index="${index}" value="${escapeHtmlAttr(row.nombre)}" style="padding: 6px 10px; font-size: 0.85rem;">
                ${row.errors.filter(e => e.includes('Nombre')).map(e => `<span class="cell-error-message">${e}</span>`).join('')}
            </td>
            <td>
                <input type="text" class="form-input cell-edit" data-field="categoria" data-index="${index}" value="${escapeHtmlAttr(row.categoria)}" style="padding: 6px 10px; font-size: 0.85rem;">
            </td>
            <td>
                <input type="text" class="form-input cell-edit" data-field="talle" data-index="${index}" value="${escapeHtmlAttr(row.talle)}" style="padding: 6px 10px; font-size: 0.85rem; width:60px; text-align:center;">
            </td>
            <td>
                <input type="text" class="form-input cell-edit" data-field="color" data-index="${index}" value="${escapeHtmlAttr(row.color)}" style="padding: 6px 10px; font-size: 0.85rem; width:80px;">
            </td>
            <td>
                <select class="form-input cell-edit" data-field="piel" data-index="${index}" style="padding: 6px 10px; font-size: 0.85rem; width:100px;">
                    <option value="Vaca" ${row.piel === 'Vaca' ? 'selected' : ''}>Vaca</option>
                    <option value="Oveja" ${row.piel === 'Oveja' ? 'selected' : ''}>Oveja</option>
                </select>
            </td>
            <td>
                <input type="number" class="form-input cell-edit" data-field="stock" data-index="${index}" value="${escapeHtmlAttr(row.stock)}" style="padding: 6px 10px; font-size: 0.85rem; width:70px; text-align:center;">
                ${row.errors.filter(e => e.includes('Stock')).map(e => `<span class="cell-error-message">${e}</span>`).join('')}
            </td>
            <td>
                <input type="number" step="0.01" class="form-input cell-edit" data-field="precioCosto" data-index="${index}" value="${escapeHtmlAttr(row.precioCosto)}" style="padding: 6px 10px; font-size: 0.85rem; width:95px;">
                ${row.errors.filter(e => e.includes('Costo')).map(e => `<span class="cell-error-message">${e}</span>`).join('')}
            </td>
            <td>
                <input type="number" step="0.01" class="form-input cell-edit" data-field="precioVenta" data-index="${index}" value="${escapeHtmlAttr(row.precioVenta)}" style="padding: 6px 10px; font-size: 0.85rem; width:95px;">
                ${row.errors.filter(e => e.includes('Precio venta')).map(e => `<span class="cell-error-message">${e}</span>`).join('')}
            </td>
            <td style="text-align: center;">
                <button class="btn btn-danger btn-row-delete" data-index="${index}" style="padding: 6px 10px; font-size:0.75rem;"><i class="fas fa-trash"></i></button>
            </td>
        `;

        tableBody.appendChild(tr);
    });

    // Escuchar cambios de edición interactiva
    container.querySelectorAll('.cell-edit').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            let value = e.target.value.trim();

            // Actualizar valor en memoria
            if (field === 'stock') value = parseInt(value) || 0;
            else if (field === 'precioCosto' || field === 'precioVenta') value = parseFloat(value) || 0;

            parsedRows[idx][field] = value;

            // Si cambia color, talle o piel, regenerar el SKU de la variante
            if (field === 'color' || field === 'talle' || field === 'piel') {
                parsedRows[idx].sku = generateSKU(parsedRows[idx].supplier_code, parsedRows[idx].color, parsedRows[idx].talle, parsedRows[idx].piel);
            }

            // Re-validar fila
            validateRow(parsedRows[idx]);

            // Re-renderizar (para actualizar estados visuales de error de forma reactiva)
            renderPreviewTable(container);
        });
    });

    // Escuchar eliminaciones de filas
    container.querySelectorAll('.btn-row-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            parsedRows.splice(idx, 1);
            renderPreviewTable(container);
            
            if (parsedRows.length === 0) {
                clearBulkUpload(container, document.getElementById('btn-confirm-bulk-import'));
            }
        });
    });
}

// Validar Fila Individual
function validateRow(row) {
    row.errors = [];
    if (!row.nombre) row.errors.push("Nombre de prenda requerido.");
    if (isNaN(row.stock) || row.stock < 0) row.errors.push("Stock debe ser un entero positivo.");
    if (isNaN(row.precioCosto) || row.precioCosto < 0) row.errors.push("Costo debe ser un número válido.");
    if (isNaN(row.precioVenta) || row.precioVenta < 0) row.errors.push("Precio venta debe ser un número válido.");
}

// Descargar Archivo Plantilla CSV
function downloadCSVTemplate() {
    const csvContent = 
`Nombre,Categoria,Descripcion,Talle,Color,Piel,Stock,PrecioCosto,PrecioVenta,ImagenURL,Codigo
Chaqueta Biker Venezia,Chaquetas,Chaqueta de cuero de oveja premium,M,Negro,Oveja,10,150000.00,320000.00,https://images.unsplash.com/photo-1551028719-00167b16eac5,BL-VNZ
Chaqueta Biker Venezia,Chaquetas,Chaqueta de cuero de oveja premium,L,Negro,Oveja,5,150000.00,320000.00,https://images.unsplash.com/photo-1551028719-00167b16eac5,BL-VNZ
Tapado Imperia,Tapados,Tapado largo de gamuza italiana,S,Camel,Vaca,4,220000.00,490000.00,https://images.unsplash.com/photo-1544022613-e87ca75a784a,BL-IMP
Tapado Imperia,Tapados,Tapado largo de gamuza italiana,M,Camel,Vaca,6,220000.00,490000.00,https://images.unsplash.com/photo-1544022613-e87ca75a784a,BL-IMP
Pantalón Milano,Pantalones,Pantalón de cuero entallado,M,Negro,Vaca,8,110000.00,240000.00,https://images.unsplash.com/photo-1594633312681-425c7b97ccd1,BL-MLN
Bolso Toscana,Accesorios,Bolso Duffle cuero flor,U,Suela,Vaca,12,130000.00,290000.00,https://images.unsplash.com/photo-1553062407-98eeb64c6a62,BL-TSC`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_carga_masiva_belia.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
