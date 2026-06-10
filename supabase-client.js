function escapeHtmlAttr(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function generateSKU(supplierCode, color, size, piel) {
    const base = (supplierCode || 'IMP').toString().trim().toUpperCase().replace(/\s+/g, '');
    
    // Normalizar y abreviar color
    const colorClean = (color || '').toString().trim().toUpperCase();
    let colAbb = '';
    
    const colorMap = {
        'NEGRO': 'NEG', 'NEGRA': 'NEG',
        'MARRÓN': 'MAR', 'MARRON': 'MAR',
        'GRIS': 'GRI',
        'SUELA': 'SUE',
        'CAMEL': 'CAM',
        'CHOCOLATE': 'CHO',
        'BLANCO': 'BLA', 'BLANCA': 'BLA',
        'ROJO': 'ROJ', 'ROJA': 'ROJ',
        'BORDÓ': 'BOR', 'BORDO': 'BOR', 'BORDEAUX': 'BOR',
        'AZUL': 'AZU',
        'TIZA': 'TIZ',
        'AGRESTE': 'AGR',
        'VENEZIA': 'VNZ',
        'PALERMO': 'PAL',
        'IMPERIA': 'IMP',
        'MILANO': 'MLN',
        'TOSCANA': 'TSC',
        'MARRÓN GASTADO': 'MAG',
        'MARRON GASTADO': 'MAG',
        'GRIS GASTADO': 'GRG',
        'GRISGASTADO': 'GRG',
        'NEGRO GASTADO': 'NGT',
        'NEGRA GASTADO': 'NGT'
    };
    
    if (colorMap[colorClean]) {
        colAbb = colorMap[colorClean];
    } else if (colorClean.includes('GASTADO')) {
        // Fallback dinámico para otros colores con "Gastado" (usa la 1ra y 3ra letra del color base + G)
        const baseColor = colorClean.replace('GASTADO', '').trim();
        const cleanBase = baseColor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, '');
        const letter1 = cleanBase.substring(0, 1) || 'X';
        const letter2 = cleanBase.substring(2, 3) || cleanBase.substring(1, 2) || 'X';
        colAbb = `${letter1}${letter2}G`;
    } else {
        // Remover acentos y tomar las primeras 3 letras
        const cleanNoAccents = colorClean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        colAbb = cleanNoAccents.replace(/[^A-Z0-9]/g, '').substring(0, 3);
        if (colAbb.length < 3) colAbb = (colAbb + 'XXX').substring(0, 3);
    }
    
    const sizeClean = (size || 'U').toString().trim().toUpperCase().replace(/\s+/g, '');
    
    // Si se provee piel, agregar el sufijo correspondiente
    let pielSuffix = '';
    if (piel) {
        const pielClean = piel.toString().trim().toUpperCase();
        if (pielClean === 'OVEJA') {
            pielSuffix = '-OVE';
        } else {
            pielSuffix = '-VAC';
        }
    }
    
    return `${base}-${colAbb}-${sizeClean}${pielSuffix}`;
}

function isUuid(str) {
    if (typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

let cachedCustomPhotos = [];


const DEFAULT_PHOTO_LIBRARY = [
    { id: "photo-1", title: "Chaqueta Biker de Cuero 'Venezia'", color: "Negro", image_url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop" },
    { id: "photo-2", title: "Chaqueta Biker de Cuero 'Venezia'", color: "Chocolate", image_url: "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=600&auto=format&fit=crop" },
    { id: "photo-3", title: "Tapado Largo 'Imperia' en Gamuza", color: "Camel", image_url: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop" },
    { id: "photo-4", title: "Pantalón Ajustado 'Milano'", color: "Negro", image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop" },
    { id: "photo-5", title: "Chaleco Biker 'Palermo'", color: "Negro", image_url: "https://images.unsplash.com/photo-1629131726692-1accd0c53db0?q=80&w=600&auto=format&fit=crop" },
    { id: "photo-6", title: "Bolso de Viaje 'Toscana'", color: "Suela", image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop" }
];

const LEATHER_PHOTO_DATABASE = {
    "Chaquetas": {
        "Negro": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        "Chocolate": "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=600&auto=format&fit=crop",
        "Marrón": "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=600&auto=format&fit=crop",
        "Suela": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        "Camel": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        "Rojo": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        "Blanco": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop"
    },
    "Tapados": {
        "Camel": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop",
        "Negro": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop",
        "Chocolate": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop",
        "Marrón": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop"
    },
    "Pantalones": {
        "Negro": "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop",
        "Marrón": "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop"
    },
    "Chalecos": {
        "Negro": "https://images.unsplash.com/photo-1629131726692-1accd0c53db0?q=80&w=600&auto=format&fit=crop",
        "Marrón": "https://images.unsplash.com/photo-1629131726692-1accd0c53db0?q=80&w=600&auto=format&fit=crop"
    },
    "Accesorios": {
        "Suela": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop",
        "Negro": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop",
        "Marrón": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop"
    }
};

function resolveProductImage(product, color) {
    if (!product) return 'LOGO.jpeg';
    
    // 1. Primero intentar buscar coincidencia en las fotos personalizadas del usuario por nombre de producto y color
    if (cachedCustomPhotos && cachedCustomPhotos.length > 0 && color) {
        const nameLower = (product.name || "").toLowerCase().trim();
        const colorLower = (color || "").toLowerCase().trim();
        
        const match = cachedCustomPhotos.find(p => {
            const pTitleLower = p.title.toLowerCase().trim();
            const pColorLower = p.color.toLowerCase().trim();
            
            // Si el nombre coincide exactamente o es coincidencia parcial, y el color coincide
            const titleMatches = nameLower === pTitleLower || nameLower.includes(pTitleLower) || pTitleLower.includes(nameLower);
            const colorMatches = colorLower === pColorLower || colorLower.includes(pColorLower) || pColorLower.includes(colorLower);
            return titleMatches && colorMatches;
        });

        if (match) {
            return match.image_url;
        }
    }

    // 2. Si no hay foto específica por variante de color en biblioteca, usar la del producto base
    const hasCustomImage = product.image_url && 
                           !product.image_url.includes('placeholder') && 
                           !product.image_url.includes('unsplash.com') && 
                           product.image_url.trim() !== '';
    if (hasCustomImage) {
        return product.image_url;
    }

    // 3. Fallback a la imagen corporativa LOGO.jpeg
    return 'LOGO.jpeg';
}

function getProductImage(productName, category, color) {
    const nameLower = (productName || "").toLowerCase().trim();
    const colorLower = (color || "").toLowerCase().trim();

    // 0. Primero buscar coincidencia en las fotos personalizadas del usuario
    if (cachedCustomPhotos && cachedCustomPhotos.length > 0) {
        const match = cachedCustomPhotos.find(p => {
            const pTitleLower = p.title.toLowerCase().trim();
            const pColorLower = p.color.toLowerCase().trim();
            
            // Si el nombre coincide exactamente o es coincidencia parcial, y el color coincide
            const titleMatches = nameLower === pTitleLower || nameLower.includes(pTitleLower) || pTitleLower.includes(nameLower);
            const colorMatches = colorLower === pColorLower || colorLower.includes(pColorLower) || pColorLower.includes(colorLower);
            return titleMatches && colorMatches;
        });

        if (match) {
            return match.image_url;
        }
    }

    // Fallback absoluto a la imagen corporativa LOGO.jpeg
    return 'LOGO.jpeg';
}

// Configuración y variables de estado del cliente
let supabaseClient = null;
let currentConfig = {
    url: localStorage.getItem('BELIA_SUPABASE_URL') || 'https://wzxuwdvpgjdflrmprwar.supabase.co',
    key: localStorage.getItem('BELIA_SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6eHV3ZHZwZ2pkZmxybXByd2FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzMwMDIsImV4cCI6MjA5NTc0OTAwMn0.vwGg_pfCcKueXp_lWletW4UHQsN1fEYFy5-bEbaVnN8'
};



// ==========================================================================
// MOCK DATA PARA EL MODO DEMO (Productos de Cuero Premium)
// ==========================================================================
const DEFAULT_PRODUCTS = [
    {
        "id": "prod-1",
        "name": "Chaqueta Biker de Cuero 'Venezia'",
        "category": "Chaquetas",
        "description": "Chaqueta clásica estilo biker fabricada con cuero vacuno premium de textura extra suave. Detalles en costuras reforzadas y herrajes dorados cepillados que añaden elegancia.",
        "cost_price": 150000,
        "selling_price": 320000,
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "BL-VNZ",
        "supplier_name": "BELIA Propia"
    },
    {
        "id": "prod-2",
        "name": "Tapado Largo 'Imperia' en Gamuza",
        "category": "Tapados",
        "description": "Tapado largo premium confeccionado en gamuza italiana suave. Color tostado cálido con forrería interna en satén italiano negro brillante.",
        "cost_price": 220000,
        "selling_price": 490000,
        "image_url": "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "BL-IMP",
        "supplier_name": "BELIA Propia"
    },
    {
        "id": "prod-3",
        "name": "Pantalón Ajustado 'Milano'",
        "category": "Pantalones",
        "description": "Pantalón entallado de cuero de cordero genuino, sumamente elástico y cómodo. Ideal para estilizar looks nocturnos con el sello de BELIA.",
        "cost_price": 110000,
        "selling_price": 240000,
        "image_url": "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "BL-MLN",
        "supplier_name": "BELIA Propia"
    },
    {
        "id": "prod-4",
        "name": "Chaleco Biker 'Palermo'",
        "category": "Chalecos",
        "description": "Chaleco de cuero vacuno para una apariencia atrevida e informal. Cierres cruzados YKK de alta resistencia y cinturón desmontable.",
        "cost_price": 90000,
        "selling_price": 195000,
        "image_url": "https://images.unsplash.com/photo-1629131726692-1accd0c53db0?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "BL-PAL",
        "supplier_name": "BELIA Propia"
    },
    {
        "id": "prod-5",
        "name": "Bolso de Viaje 'Toscana'",
        "category": "Accesorios",
        "description": "Bolso Duffle de viaje confeccionado en cuero de grano entero curtido al vegetal. Correa desmontable de alta resistencia y herrajes de bronce macizo.",
        "cost_price": 130000,
        "selling_price": 290000,
        "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "BL-TSC",
        "supplier_name": "BELIA Propia"
    },
    {
        "id": "prod-skull-158",
        "name": "Bota de Cuero 'MANCHESTER'",
        "category": "Calzado",
        "description": "Bota clásica de cuero Manchester con efecto envejecido/vintage de SKULL Custom Leather. Elegante y confortable para el uso diario.",
        "cost_price": 75000,
        "selling_price": 160000,
        "image_url": "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop",
        "supplier_code": "158",
        "supplier_name": "SKULL Custom Leather"
    },
    {
        "name": "Sk 700",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: Sk 700. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 190000,
        "selling_price": 399999,
        "supplier_code": "18",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-18",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Sk harrison",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: Sk harrison. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 190000,
        "selling_price": 399999,
        "supplier_code": "186",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-186",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "St 600",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: St 600. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 185000,
        "selling_price": 369999,
        "supplier_code": "121",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-121",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Sk classic",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: Sk classic. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 180000,
        "selling_price": 359999,
        "supplier_code": "43",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-43",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Sk 900",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: Sk 900. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 180000,
        "selling_price": 359999,
        "supplier_code": "30",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-30",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "St 99",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: St 99. Confeccionado en cuero de vaca. Detalle: Campera Hombre.",
        "cost_price": 180000,
        "selling_price": 349999,
        "supplier_code": "31",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-31",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "MKM",
        "category": "Morrales",
        "description": "Artículo de cuero premium: MKM. Confeccionado en cuero de vaca. Detalle: Morral.",
        "cost_price": 80000,
        "selling_price": 149999,
        "supplier_code": "91",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-91",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "CM",
        "category": "Carteras Mujer",
        "description": "Artículo de cuero premium: CM. Confeccionado en cuero de vaca. Detalle: Cartera Mujer.",
        "cost_price": 50000,
        "selling_price": 99999,
        "supplier_code": "111",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-111",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "SK Belen",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: SK Belen. Confeccionado en cuero de vaca. Detalle: Campera Mujer.",
        "cost_price": 170000,
        "selling_price": 330000,
        "supplier_code": "47",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-47",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "SK Dreams",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: SK Dreams. Confeccionado en cuero de vaca. Detalle: Campera Mujer.",
        "cost_price": 175000,
        "selling_price": 329999,
        "supplier_code": "229",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-229",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Cinturon",
        "category": "Cinturones",
        "description": "Artículo de cuero premium: Cinturon. Confeccionado en cuero de vaca. Detalle: Hombre.",
        "cost_price": 15000,
        "selling_price": 39999,
        "supplier_code": "28",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-28",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Neceser",
        "category": "Neceseres",
        "description": "Artículo de cuero premium: Neceser. Confeccionado en cuero de vaca. Detalle: N4.",
        "cost_price": 60000,
        "selling_price": 110000,
        "supplier_code": "218",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-218",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "TNT",
        "category": "Bolsos",
        "description": "Artículo de cuero premium: TNT. Confeccionado en cuero de vaca. Detalle: Bolso.",
        "cost_price": 100000,
        "selling_price": 189999,
        "supplier_code": "104",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-104",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "R5",
        "category": "Riñoneras",
        "description": "Artículo de cuero premium: R5. Confeccionado en cuero de vaca. Detalle: Riñonera.",
        "cost_price": 80000,
        "selling_price": 139999,
        "supplier_code": "115",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-115",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Chaqueta manga corta",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: Chaqueta manga corta. Confeccionado en cuero de oveja. Detalle: Campera Mujer.",
        "cost_price": 190000,
        "selling_price": 380000,
        "supplier_code": "213",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-213",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Chaleco",
        "category": "Chalecos",
        "description": "Artículo de cuero premium: Chaleco. Confeccionado en cuero de oveja. Detalle: Chaleco mujer.",
        "cost_price": 190000,
        "selling_price": 399999,
        "supplier_code": "214",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-214",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Blusa",
        "category": "Blusas",
        "description": "Artículo de cuero premium: Blusa. Confeccionado en cuero de oveja. Detalle: Blusa mujer.",
        "cost_price": 135000,
        "selling_price": 250000,
        "supplier_code": "215",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-215",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Billetera de mujer",
        "category": "Billeteras Mujer",
        "description": "Artículo de cuero premium: Billetera de mujer. Confeccionado en cuero de vaca. Detalle: Billetera mujer.",
        "cost_price": 17500,
        "selling_price": 34999,
        "supplier_code": "90",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-90",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Dinamita",
        "category": "Bolsos",
        "description": "Artículo de cuero premium: Dinamita. Confeccionado en cuero de vaca. Detalle: Bolso.",
        "cost_price": 110000,
        "selling_price": 219999,
        "supplier_code": "105",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-skull-105",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Cadenas de cuero",
        "category": "Llaveros",
        "description": "Artículo de cuero premium: Cadenas de cuero. Confeccionado en cuero de vaca. Detalle: Llaveros.",
        "cost_price": 10000,
        "selling_price": 22000,
        "supplier_code": "209",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-skull-209",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Gorra",
        "category": "Gorras",
        "description": "Artículo de cuero premium: Gorra. Confeccionado en cuero de vaca. Detalle: Gorra.",
        "cost_price": 40000,
        "selling_price": 84999,
        "supplier_code": "129",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-skull-129",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Billetera hombre B1",
        "category": "Billeteras Hombre",
        "description": "Artículo de cuero premium: Billetera hombre B1. Confeccionado en cuero de vaca. Detalle: Billetera.",
        "cost_price": 17000,
        "selling_price": 29999,
        "supplier_code": "147",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-147",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Mochila lennon",
        "category": "Mochilas",
        "description": "Artículo de cuero premium: Mochila lennon. Confeccionado en cuero de vaca. Detalle: Mochila.",
        "cost_price": 100000,
        "selling_price": 179999,
        "supplier_code": "159",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-159",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Mochila brandon",
        "category": "Mochilas",
        "description": "Artículo de cuero premium: Mochila brandon. Confeccionado en cuero de vaca. Detalle: Mochila.",
        "cost_price": 100000,
        "selling_price": 179999,
        "supplier_code": "166",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-166",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Boris",
        "category": "Camperas Hombre",
        "description": "Artículo de cuero premium: Boris. Confeccionado en cuero de oveja. Detalle: Campera hombre.",
        "cost_price": 250000,
        "selling_price": 600000,
        "supplier_code": "131",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-131",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Gamulan",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: Gamulan. Confeccionado en cuero de vaca. Detalle: Campera mujer.",
        "cost_price": 300000,
        "selling_price": 600000,
        "supplier_code": "226",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-226",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Napalan Dama",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: Napalan Dama. Confeccionado en cuero de vaca. Detalle: Campera mujer.",
        "cost_price": 260000,
        "selling_price": 500000,
        "supplier_code": "227",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-227",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Dama Baby lom",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: Dama Baby lom. Confeccionado en cuero de oveja. Detalle: Campera mujer.",
        "cost_price": 270000,
        "selling_price": 600000,
        "supplier_code": "228",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-228",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Boina",
        "category": "Gorras",
        "description": "Artículo de cuero premium: Boina. Confeccionado en cuero de vaca. Detalle: Gorra.",
        "cost_price": 43000,
        "selling_price": 95000,
        "supplier_code": "145",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-145",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Milano",
        "category": "Calzado",
        "description": "Artículo de cuero premium: Milano. Confeccionado en cuero de vaca. Detalle: Zapatos hombre.",
        "cost_price": 79000,
        "selling_price": 149999,
        "supplier_code": "150",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-skull-150",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "SK Blondie",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: SK Blondie. Confeccionado en cuero de vaca. Detalle: Campera mujer.",
        "cost_price": 170000,
        "selling_price": 329999,
        "supplier_code": "57",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-57",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "SK Princess",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: SK Princess. Confeccionado en cuero de vaca. Detalle: Campera mujer.",
        "cost_price": 175000,
        "selling_price": 359999,
        "supplier_code": "37",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-37",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "SK Cindy",
        "category": "Camperas Mujer",
        "description": "Artículo de cuero premium: SK Cindy. Confeccionado en cuero de vaca. Detalle: Campera mujer.",
        "cost_price": 170000,
        "selling_price": 329000,
        "supplier_code": "58",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-58",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Camisa Amy",
        "category": "Camisas",
        "description": "Artículo de cuero premium: Camisa Amy. Confeccionado en cuero de vaca. Detalle: Camisa mujer.",
        "cost_price": 160000,
        "selling_price": 329000,
        "supplier_code": "48",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-48",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Camisa Over",
        "category": "Camisas",
        "description": "Artículo de cuero premium: Camisa Over. Confeccionado en cuero de oveja. Detalle: Camisa mujer.",
        "cost_price": 195000,
        "selling_price": 399999,
        "supplier_code": "211",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-211",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    },
    {
        "name": "Pollera",
        "category": "Polleras",
        "description": "Artículo de cuero premium: Pollera. Confeccionado en cuero de oveja. Detalle: Pollera.",
        "cost_price": 140000,
        "selling_price": 299999,
        "supplier_code": "210",
        "supplier_name": "SKULL Custom Leather",
        "id": "prod-excel-210",
        "image_url": "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600"
    }
];

const DEFAULT_INVENTORY = [
    {
        "id": "inv-1",
        "product_id": "prod-1",
        "size": "S",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-VNZ-S-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-2",
        "product_id": "prod-1",
        "size": "M",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-VNZ-M-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-3",
        "product_id": "prod-1",
        "size": "L",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-VNZ-L-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-4",
        "product_id": "prod-1",
        "size": "M",
        "color": "Chocolate",
        "stock": 0,
        "sku": "BL-VNZ-M-BRW-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-5",
        "product_id": "prod-2",
        "size": "M",
        "color": "Camel",
        "stock": 0,
        "sku": "BL-IMP-M-CAM-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-6",
        "product_id": "prod-2",
        "size": "L",
        "color": "Camel",
        "stock": 0,
        "sku": "BL-IMP-L-CAM-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-7",
        "product_id": "prod-3",
        "size": "S",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-MLN-S-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-8",
        "product_id": "prod-3",
        "size": "M",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-MLN-M-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-9",
        "product_id": "prod-4",
        "size": "M",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-PAL-M-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-10",
        "product_id": "prod-4",
        "size": "L",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-PAL-L-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-11",
        "product_id": "prod-5",
        "size": "U",
        "color": "Suela",
        "stock": 0,
        "sku": "BL-TSC-U-SLA-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-12",
        "product_id": "prod-5",
        "size": "U",
        "color": "Negro",
        "stock": 0,
        "sku": "BL-TSC-U-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-skull-158-39n",
        "product_id": "prod-skull-158",
        "size": "39",
        "color": "Negro",
        "stock": 0,
        "sku": "SK-MN-39-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-skull-158-40n",
        "product_id": "prod-skull-158",
        "size": "40",
        "color": "Negro",
        "stock": 0,
        "sku": "SK-MN-40-BLK-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-18-neg-u-vaca",
        "product_id": "prod-excel-18",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "18-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-186-neg-u-vaca",
        "product_id": "prod-excel-186",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "186-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-121-neg-u-vaca",
        "product_id": "prod-excel-121",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "121-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-43-neg-u-vaca",
        "product_id": "prod-excel-43",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "43-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-30-neg-u-vaca",
        "product_id": "prod-excel-30",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "30-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-31-neg-u-vaca",
        "product_id": "prod-excel-31",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "31-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-91-mar-u-vaca",
        "product_id": "prod-excel-91",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "91-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-91-neg-u-vaca",
        "product_id": "prod-excel-91",
        "size": "U",
        "color": "Negro",
        "stock": 2,
        "sku": "91-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-111-sue-u-vaca",
        "product_id": "prod-excel-111",
        "size": "U",
        "color": "Suela",
        "stock": 1,
        "sku": "111-SUE-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-47-neg-u-vaca",
        "product_id": "prod-excel-47",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "47-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-229-neg-u-vaca",
        "product_id": "prod-excel-229",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "229-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-28-neg-u-vaca",
        "product_id": "prod-excel-28",
        "size": "U",
        "color": "Negro",
        "stock": 10,
        "sku": "28-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-218-gri-u-vaca",
        "product_id": "prod-excel-218",
        "size": "U",
        "color": "Gris",
        "stock": 1,
        "sku": "218-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-218-cho-u-vaca",
        "product_id": "prod-excel-218",
        "size": "U",
        "color": "Chocolate",
        "stock": 2,
        "sku": "218-CHO-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-87-gri-u-vaca",
        "product_id": "prod-excel-218",
        "size": "U",
        "color": "Gris Gastado",
        "stock": 1,
        "sku": "87-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-87-mar-u-vaca",
        "product_id": "prod-excel-218",
        "size": "U",
        "color": "Marron Gastado",
        "stock": 1,
        "sku": "87-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-104-gri-u-vaca",
        "product_id": "prod-excel-104",
        "size": "U",
        "color": "Gris Gastado",
        "stock": 1,
        "sku": "104-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-104-neg-u-vaca",
        "product_id": "prod-excel-104",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "104-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-104-mar-u-vaca",
        "product_id": "prod-excel-104",
        "size": "U",
        "color": "Marron Gastado",
        "stock": 1,
        "sku": "104-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-115-gri-u-vaca",
        "product_id": "prod-excel-115",
        "size": "U",
        "color": "Gris Gastado",
        "stock": 1,
        "sku": "115-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-115-mar-u-vaca",
        "product_id": "prod-excel-115",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "115-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-115-neg-u-vaca",
        "product_id": "prod-excel-115",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "115-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-213-tiz-u-oveja",
        "product_id": "prod-excel-213",
        "size": "U",
        "color": "Tiza",
        "stock": 1,
        "sku": "213-TIZ-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-214-tiz-u-oveja",
        "product_id": "prod-excel-214",
        "size": "U",
        "color": "Tiza",
        "stock": 1,
        "sku": "214-TIZ-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-215-tiz-u-oveja",
        "product_id": "prod-excel-215",
        "size": "U",
        "color": "Tiza",
        "stock": 1,
        "sku": "215-TIZ-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-90-mar-u-vaca",
        "product_id": "prod-excel-90",
        "size": "U",
        "color": "Marron Y Negra",
        "stock": 4,
        "sku": "90-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-105-gri-u-vaca",
        "product_id": "prod-skull-105",
        "size": "U",
        "color": "Gris",
        "stock": 1,
        "sku": "105-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-105-neg-u-vaca",
        "product_id": "prod-skull-105",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "105-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-105-sue-u-vaca",
        "product_id": "prod-skull-105",
        "size": "U",
        "color": "Suela",
        "stock": 1,
        "sku": "105-SUE-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-209-s/c-u-vaca",
        "product_id": "prod-skull-209",
        "size": "U",
        "color": "S/c",
        "stock": 5,
        "sku": "209-SCX-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-129-cru-u-vaca",
        "product_id": "prod-skull-129",
        "size": "U",
        "color": "Crush",
        "stock": 2,
        "sku": "129-CRU-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-129-neg-u-vaca",
        "product_id": "prod-skull-129",
        "size": "U",
        "color": "Negro",
        "stock": 2,
        "sku": "129-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-129-sue-u-vaca",
        "product_id": "prod-skull-129",
        "size": "U",
        "color": "Suela",
        "stock": 1,
        "sku": "129-SUE-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-147-bor-u-vaca",
        "product_id": "prod-excel-147",
        "size": "U",
        "color": "Bordo",
        "stock": 1,
        "sku": "147-BOR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-147-gri-u-vaca",
        "product_id": "prod-excel-147",
        "size": "U",
        "color": "Gris",
        "stock": 1,
        "sku": "147-GRI-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-147-mar-u-vaca",
        "product_id": "prod-excel-147",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "147-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-147-neg-u-vaca",
        "product_id": "prod-excel-147",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "147-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-212-neg-u-vaca",
        "product_id": "prod-excel-213",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "212-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-159-mar-u-vaca",
        "product_id": "prod-excel-159",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "159-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-159-neg-u-vaca",
        "product_id": "prod-excel-159",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "159-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-166-mar-u-vaca",
        "product_id": "prod-excel-166",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "166-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-131-mar-u-oveja",
        "product_id": "prod-excel-131",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "131-MAR-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-226-neg-u-vaca",
        "product_id": "prod-excel-226",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "226-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-227-agr-u-vaca",
        "product_id": "prod-excel-227",
        "size": "U",
        "color": "Agreste",
        "stock": 1,
        "sku": "227-AGR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-228-mar-u-oveja",
        "product_id": "prod-excel-228",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "228-MAR-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-145-neg-u-vaca",
        "product_id": "prod-excel-145",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "145-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-150-neg-u-vaca",
        "product_id": "prod-skull-150",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "150-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-150-mar-u-vaca",
        "product_id": "prod-skull-150",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "150-MAR-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-150-mar-40-vaca",
        "product_id": "prod-skull-150",
        "size": "40",
        "color": "Marron",
        "stock": 1,
        "sku": "150-MAR-40-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-57-neg-u-vaca",
        "product_id": "prod-excel-57",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "57-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-37-neg-u-vaca",
        "product_id": "prod-excel-37",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "37-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-58-tiz-u-vaca",
        "product_id": "prod-excel-58",
        "size": "U",
        "color": "Tiza",
        "stock": 1,
        "sku": "58-TIZ-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-58-neg-u-vaca",
        "product_id": "prod-excel-58",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "58-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-48-neg-u-vaca",
        "product_id": "prod-excel-48",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "48-NEG-U-VAC",
        "piel": "Vaca"
    },
    {
        "id": "inv-excel-211-neg-u-oveja",
        "product_id": "prod-excel-211",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "211-NEG-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-210-neg-u-oveja",
        "product_id": "prod-excel-210",
        "size": "U",
        "color": "Negro",
        "stock": 1,
        "sku": "210-NEG-U-OVE",
        "piel": "Oveja"
    },
    {
        "id": "inv-excel-210-mar-u-oveja",
        "product_id": "prod-excel-210",
        "size": "U",
        "color": "Marron",
        "stock": 1,
        "sku": "210-MAR-U-OVE",
        "piel": "Oveja"
    }
];

const DEFAULT_CUSTOMERS = [
    {
        id: "cust-1",
        first_name: "Valentina",
        last_name: "Rossi",
        email: "vale.rossi@example.com",
        phone: "+54 11 5555 1234",
        notes: "Prefiere chaquetas entalladas. Cliente VIP habitual.",
        total_spent: 810000.00,
        created_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: "cust-2",
        first_name: "Mateo",
        last_name: "Benítez",
        email: "mateo@example.com",
        phone: "+54 9 341 555 7890",
        notes: "Compró el bolso de viaje Toscana. Valora el curtido vegetal.",
        total_spent: 290000.00,
        created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: "cust-3",
        first_name: "Sofía",
        last_name: "Martínez",
        email: "sofia.m@example.com",
        phone: "+54 11 4444 8888",
        notes: "Interesada en abrigos de gamuza, talle M.",
        total_spent: 490000.00,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
];

const DEFAULT_SALES = [
    {
        id: "sale-1",
        customer_id: "cust-1",
        total_amount: 810000.00,
        payment_method: "Tarjeta",
        sale_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { id: "sitem-1", product_name: "Chaqueta Biker de Cuero 'Venezia'", size: "M", color: "Negro", quantity: 1, unit_price: 320000.00, total_price: 320000.00 },
            { id: "sitem-2", product_name: "Tapado Largo 'Imperia' en Gamuza", size: "M", color: "Camel", quantity: 1, unit_price: 490000.00, total_price: 490000.00 }
        ]
    },
    {
        id: "sale-2",
        customer_id: "cust-2",
        total_amount: 290000.00,
        payment_method: "Transferencia",
        sale_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { id: "sitem-3", product_name: "Bolso de Viaje 'Toscana'", size: "U", color: "Suela", quantity: 1, unit_price: 290000.00, total_price: 290000.00 }
        ]
    }
];

// Inicializar almacenamiento local si está vacío o requiere migración
function initLocalStorageData() {
    let prods = [];
    try {
        const stored = localStorage.getItem('BELIA_DEMO_PRODUCTS');
        prods = stored ? JSON.parse(stored) : [];
    } catch (e) { prods = []; }

    const hasSkull = prods.some(p => p.id === "prod-skull-105");
    const needsSupplierFields = prods.length > 0 && !prods.every(p => p.hasOwnProperty('supplier_code'));

    if (!localStorage.getItem('BELIA_DEMO_PRODUCTS') || !hasSkull || needsSupplierFields) {
        const mergedProds = [...DEFAULT_PRODUCTS];
        prods.forEach(p => {
            const exists = mergedProds.some(mp => mp.id === p.id);
            if (!exists) {
                p.supplier_code = p.supplier_code || "";
                p.supplier_name = p.supplier_name || "Usuario / Externo";
                mergedProds.push(p);
            } else {
                const idx = mergedProds.findIndex(mp => mp.id === p.id);
                if (idx !== -1) {
                    // Preservar cambios del usuario pero asegurar que tenga campos de proveedor
                    mergedProds[idx] = {
                        ...mergedProds[idx],
                        ...p,
                        supplier_code: p.supplier_code || mergedProds[idx].supplier_code || "",
                        supplier_name: p.supplier_name || mergedProds[idx].supplier_name || "BELIA Propia"
                    };
                }
            }
        });
        localStorage.setItem('BELIA_DEMO_PRODUCTS', JSON.stringify(mergedProds));
    }

    let inv = [];
    try {
        const stored = localStorage.getItem('BELIA_DEMO_INVENTORY');
        inv = stored ? JSON.parse(stored) : [];
    } catch (e) { inv = []; }

    const hasSkullInv = inv.some(i => i.id === "inv-excel-105-gri-u-vaca");
    if (!localStorage.getItem('BELIA_DEMO_INVENTORY') || !hasSkullInv) {
        const mergedInv = [...DEFAULT_INVENTORY];
        inv.forEach(i => {
            const exists = mergedInv.some(mi => mi.id === i.id);
            if (!exists) mergedInv.push(i);
        });
        localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(mergedInv));
    }

    if (!localStorage.getItem('BELIA_DEMO_CUSTOMERS')) {
        localStorage.setItem('BELIA_DEMO_CUSTOMERS', JSON.stringify(DEFAULT_CUSTOMERS));
    }
    if (!localStorage.getItem('BELIA_DEMO_SALES')) {
        localStorage.setItem('BELIA_DEMO_SALES', JSON.stringify(DEFAULT_SALES));
    }
    if (!localStorage.getItem('BELIA_CUSTOM_PHOTOS')) {
        localStorage.setItem('BELIA_CUSTOM_PHOTOS', JSON.stringify(DEFAULT_PHOTO_LIBRARY));
    }

    if (!localStorage.getItem('BELIA_DEMO_APPOINTMENTS')) {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        const appt1Date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0).toISOString();
        const appt2Date = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 11, 15, 0).toISOString();

        const defaultAppts = [
            {
                id: 'appt-1',
                client_name: 'Carolina Herrera',
                phone: '1155554444',
                appointment_date: appt1Date,
                inventory_id: 'inv-1',
                notes: 'Quiere probarse el talle S de la campera biker Venezia negra.',
                status: 'pending',
                created_at: new Date().toISOString()
            },
            {
                id: 'appt-2',
                client_name: 'Santiago de la Vega',
                phone: '2214445555',
                appointment_date: appt2Date,
                inventory_id: 'inv-5',
                notes: 'Interés en el tapado Imperia camel, talle M.',
                status: 'pending',
                created_at: new Date().toISOString()
            }
        ];
        localStorage.setItem('BELIA_DEMO_APPOINTMENTS', JSON.stringify(defaultAppts));
    }

    // Cargar caché de fotos personalizadas
    try {
        const stored = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
        cachedCustomPhotos = stored ? JSON.parse(stored) : DEFAULT_PHOTO_LIBRARY;
    } catch (e) {
        cachedCustomPhotos = [];
    }
}
initLocalStorageData();

// ==========================================================================
// GESTIÓN DE LA CONEXIÓN Y MODOS DE EJECUCIÓN
// ==========================================================================

function isDemoMode() {
    return !currentConfig.url || !currentConfig.key || !supabaseClient;
}

function initSupabase() {
    const { url, key } = currentConfig;
    if (url && key && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(url, key);
            console.log("Supabase Client initialized successfully!");
            return true;
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
            supabaseClient = null;
            return false;
        }
    }
    supabaseClient = null;
    return false;
}

function setSupabaseCredentials(url, key) {
    if (url && key) {
        localStorage.setItem('BELIA_SUPABASE_URL', url);
        localStorage.setItem('BELIA_SUPABASE_KEY', key);
        currentConfig.url = url;
        currentConfig.key = key;
        return initSupabase();
    } else {
        localStorage.removeItem('BELIA_SUPABASE_URL');
        localStorage.removeItem('BELIA_SUPABASE_KEY');
        currentConfig.url = '';
        currentConfig.key = '';
        supabaseClient = null;
        return false;
    }
}

function getCredentials() {
    return currentConfig;
}

// Inicialización rápida
if (window.supabase) {
    initSupabase();
} else {
    // Si la librería no cargó todavía, reintentar al cargar la ventana
    window.addEventListener('load', () => {
        if (window.supabase) initSupabase();
    });
}

// Helper para generar IDs aleatorios
function generateId() {
    return 'demo-' + Math.random().toString(36).substr(2, 9);
}

// ==========================================================================
// CAPA DE OPERACIONES (API DEL CLIENTE)
// ==========================================================================

/* --- PRODUCTOS --- */

function sortProductsBySupplierCode(list) {
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => {
        const codeA = String(a.supplier_code || '').trim();
        const codeB = String(b.supplier_code || '').trim();
        
        // Si ambos se pueden interpretar como enteros, ordenar numéricamente
        const numA = parseInt(codeA, 10);
        const numB = parseInt(codeB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        // De lo contrario, usar ordenación natural/alfanumérica
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
}

async function getProducts() {
    if (isDemoMode()) {
        const prod = localStorage.getItem('BELIA_DEMO_PRODUCTS');
        const list = JSON.parse(prod) || [];
        return sortProductsBySupplierCode(list);
    }

    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*');

        if (error) {
            console.warn("Falla al cargar 'products' de Supabase. Usando LocalStorage:", error);
            const prod = localStorage.getItem('BELIA_DEMO_PRODUCTS');
            const list = JSON.parse(prod) || [];
            return sortProductsBySupplierCode(list);
        }
        return sortProductsBySupplierCode(data || []);
    } catch (err) {
        console.warn("Excepción al cargar 'products' de Supabase. Usando LocalStorage:", err);
        const prod = localStorage.getItem('BELIA_DEMO_PRODUCTS');
        const list = JSON.parse(prod) || [];
        return sortProductsBySupplierCode(list);
    }
}

async function saveProduct(product, variants = null) {
    if (!isDemoMode()) {
        try {
            let isEdit = !!product.id && isUuid(product.id);
            let savedProduct = null;
            let dbProductId = isEdit ? product.id : null;

            // Si tiene un ID pero no es un UUID válido (por ejemplo, prod-excel-147),
            // intentar buscar si el producto ya existe en la DB por código de proveedor o por nombre.
            if (product.id && !isUuid(product.id)) {
                const searchCode = (product.supplier_code || "").trim();
                const searchName = (product.name || "").trim();
                
                let matched = null;
                
                if (searchCode) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('supplier_code', searchCode);
                    if (!error && data && data.length > 0) {
                        matched = data;
                    }
                }
                
                if (!matched && searchName) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('name', searchName);
                    if (!error && data && data.length > 0) {
                        matched = data;
                    }
                }
                
                if (matched && matched.length > 0) {
                    isEdit = true;
                    dbProductId = matched[0].id;
                }
            }

            if (isEdit) {
                const { data, error } = await supabaseClient
                    .from('products')
                    .update({
                        name: product.name,
                        category: product.category,
                        description: product.description,
                        cost_price: parseFloat(product.cost_price),
                        selling_price: parseFloat(product.selling_price),
                        image_url: product.image_url,
                        supplier_code: product.supplier_code || "",
                        supplier_name: product.supplier_name || ""
                    })
                    .eq('id', dbProductId)
                    .select();
                
                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error(`No se encontró el producto con ID ${dbProductId} en la base de datos para actualizar.`);
                }
                savedProduct = data[0];
            } else {
                const { data, error } = await supabaseClient
                    .from('products')
                    .insert([{
                        name: product.name,
                        category: product.category,
                        description: product.description,
                        cost_price: parseFloat(product.cost_price),
                        selling_price: parseFloat(product.selling_price),
                        image_url: product.image_url,
                        supplier_code: product.supplier_code || "",
                        supplier_name: product.supplier_name || ""
                    }])
                    .select();
                
                if (error) throw error;
                savedProduct = data[0];
            }

            const productId = savedProduct.id;

            // Guardar variantes en Supabase si se proveen
            if (variants !== null && variants !== undefined) {
                if (isEdit) {
                    const { error: delError } = await supabaseClient
                        .from('inventory')
                        .delete()
                        .eq('product_id', productId);
                    
                    if (delError) throw delError;
                }

                const insertVariants = variants.map(v => ({
                    product_id: productId,
                    size: v.size.toUpperCase(),
                    color: v.color,
                    stock: parseInt(v.stock) || 0,
                    sku: v.sku || generateSKU(product.supplier_code, v.color, v.size, v.piel),
                    piel: v.piel || 'Vaca'
                }));

                if (insertVariants.length > 0) {
                    const { error: invError } = await supabaseClient
                        .from('inventory')
                        .insert(insertVariants);
                    
                    if (invError) throw invError;
                }
            }

            return savedProduct;
        } catch (supabaseError) {
            console.warn("Falla de escritura en Supabase. Aplicando guardado local en LocalStorage:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Se guardó localmente. Detalle: ${detail}. Recuerda ejecutar el script SQL en tu Supabase.`, "warning");
            }
        }
    }

    // --- CÓDIGO DE RESPALDO LOCAL ---
    const products = await getProducts();
    const inventory = await getInventory();

    const isEdit = !!product.id;
    const productId = product.id || generateId();
    
    const newProduct = {
        id: productId,
        name: product.name,
        category: product.category,
        description: product.description || '',
        cost_price: parseFloat(product.cost_price),
        selling_price: parseFloat(product.selling_price),
        image_url: product.image_url || 'LOGO.jpeg',
        supplier_code: product.supplier_code || "",
        supplier_name: product.supplier_name || "BELIA Propia",
        created_at: product.created_at || new Date().toISOString()
    };

    if (isEdit) {
        const idx = products.findIndex(p => p.id === productId);
        if (idx !== -1) products[idx] = newProduct;
    } else {
        products.unshift(newProduct);
    }

    // Procesar variantes localmente si se proveen
    let filteredInventory = [...inventory];
    if (variants !== null && variants !== undefined) {
        filteredInventory = inventory.filter(i => i.product_id !== productId);
        variants.forEach(v => {
            filteredInventory.push({
                id: v.id || generateId(),
                product_id: productId,
                size: v.size.toUpperCase(),
                color: v.color,
                stock: parseInt(v.stock) || 0,
                sku: v.sku || generateSKU(product.supplier_code, v.color, v.size, v.piel),
                piel: v.piel || 'Vaca'
            });
        });
    }

    localStorage.setItem('BELIA_DEMO_PRODUCTS', JSON.stringify(products));
    localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(filteredInventory));
    return newProduct;
}

async function deleteProduct(productId) {
    if (!isDemoMode()) {
        try {
            let dbProductId = productId;
            if (!isUuid(productId)) {
                const localProds = await getProducts();
                const prod = localProds.find(p => p.id === productId);
                if (prod) {
                    const { data: dbProd, error: findError } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('name', prod.name);
                    
                    if (!findError && dbProd && dbProd.length > 0) {
                        dbProductId = dbProd[0].id;
                    }
                }
            }

            if (isUuid(dbProductId)) {
                const { error } = await supabaseClient
                    .from('products')
                    .delete()
                    .eq('id', dbProductId);
                
                if (error) throw error;
                return true;
            } else {
                console.warn(`deleteProduct: No se pudo resolver un UUID para el ID de producto "${productId}".`);
            }
        } catch (supabaseError) {
            console.warn("Falla al eliminar en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `No se pudo eliminar en Supabase. Detalle: ${detail}. Borrado local aplicado.`, "warning");
            }
        }
    }

    // Respaldo Local
    const products = await getProducts();
    const inventory = await getInventory();

    const filteredProds = products.filter(p => p.id !== productId);
    const filteredInv = inventory.filter(i => i.product_id !== productId);

    localStorage.setItem('BELIA_DEMO_PRODUCTS', JSON.stringify(filteredProds));
    localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(filteredInv));
    return true;
}

/* --- BASE DE FOTOS PERSONALIZADA --- */

async function getCustomPhotos() {
    if (isDemoMode()) {
        const photos = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
        const list = JSON.parse(photos) || [];
        cachedCustomPhotos = list.sort((a, b) => a.title.localeCompare(b.title));
        return cachedCustomPhotos;
    }

    try {
        const { data, error } = await supabaseClient
            .from('photo_library')
            .select('*')
            .order('title', { ascending: true });

        if (error) {
            console.warn("Falla al cargar 'photo_library' de Supabase (posiblemente falta ejecutar el SQL):", error);
            // Fallback a localStorage para que el CRM no deje de funcionar
            const photos = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
            const list = JSON.parse(photos) || [];
            cachedCustomPhotos = list.sort((a, b) => a.title.localeCompare(b.title));
            return cachedCustomPhotos;
        }
        cachedCustomPhotos = data || [];
        return cachedCustomPhotos;
    } catch (err) {
        console.warn("Excepción al cargar 'photo_library' de Supabase:", err);
        const photos = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
        const list = JSON.parse(photos) || [];
        cachedCustomPhotos = list.sort((a, b) => a.title.localeCompare(b.title));
        return cachedCustomPhotos;
    }
}

async function saveCustomPhoto(title, color, url) {
    if (!title || !color || !url) return null;
    const formattedTitle = title.trim();
    const formattedColor = color.trim();
    const formattedUrl = url.trim();

    // Guardado local de respaldo (siempre guardar localmente por si falla la conexión o falta la tabla)
    let localResult = null;
    try {
        const photos = localStorage.getItem('BELIA_CUSTOM_PHOTOS') ? JSON.parse(localStorage.getItem('BELIA_CUSTOM_PHOTOS')) : [];
        const existingIdx = photos.findIndex(p => p.title.toLowerCase() === formattedTitle.toLowerCase() && p.color.toLowerCase() === formattedColor.toLowerCase());
        const newPhoto = {
            id: existingIdx !== -1 ? photos[existingIdx].id : generateId(),
            title: formattedTitle,
            color: formattedColor,
            image_url: formattedUrl,
            created_at: existingIdx !== -1 ? photos[existingIdx].created_at : new Date().toISOString()
        };
        if (existingIdx !== -1) {
            photos[existingIdx] = newPhoto;
        } else {
            photos.push(newPhoto);
        }
        localStorage.setItem('BELIA_CUSTOM_PHOTOS', JSON.stringify(photos));
        if (isDemoMode()) {
            cachedCustomPhotos = photos;
            return newPhoto;
        }
        localResult = newPhoto;
    } catch (e) {
        console.error("Error saving local custom photo backup:", e);
    }

    // Si no es demo mode, intentar guardar en Supabase
    try {
        const { data: existing, error: findError } = await supabaseClient
            .from('photo_library')
            .select('id')
            .eq('title', formattedTitle)
            .eq('color', formattedColor)
            .maybeSingle();

        if (findError) throw findError;

        let result = null;
        if (existing) {
            const { data, error } = await supabaseClient
                .from('photo_library')
                .update({ image_url: formattedUrl })
                .eq('id', existing.id)
                .select();
            if (error) throw error;
            result = data[0];
        } else {
            const { data, error } = await supabaseClient
                .from('photo_library')
                .insert([{ title: formattedTitle, color: formattedColor, image_url: formattedUrl }])
                .select();
            if (error) throw error;
            result = data[0];
        }

        // Sincronizar cache local en memoria
        await getCustomPhotos();
        return result;
    } catch (e) {
        console.warn("No se pudo persistir en Supabase. Usando respaldo de LocalStorage:", e);
        const detail = e?.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        if (typeof showToast === 'function') {
            showToast("Modo Respaldo", `Foto registrada localmente. Detalle del error: ${detail}`, "warning");
        }
        // Sincronizar cache en memoria local
        const stored = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
        cachedCustomPhotos = stored ? JSON.parse(stored) : [];
        return localResult;
    }
}

async function deleteCustomPhoto(photoId) {
    // Borrado local
    try {
        const photos = localStorage.getItem('BELIA_CUSTOM_PHOTOS') ? JSON.parse(localStorage.getItem('BELIA_CUSTOM_PHOTOS')) : [];
        const filtered = photos.filter(p => p.id !== photoId);
        localStorage.setItem('BELIA_CUSTOM_PHOTOS', JSON.stringify(filtered));
        if (isDemoMode()) {
            cachedCustomPhotos = filtered;
            return true;
        }
    } catch (e) {
        console.error("Error deleting local custom photo backup:", e);
    }

    try {
        const { error } = await supabaseClient
            .from('photo_library')
            .delete()
            .eq('id', photoId);

        if (error) throw error;
        await getCustomPhotos();
        return true;
    } catch (e) {
        console.warn("No se pudo eliminar en Supabase (tabla ausente o conexión offline). Borrado local aplicado:", e);
        const detail = e?.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
        if (typeof showToast === 'function') {
            showToast("Modo Respaldo", `Foto eliminada localmente. Detalle del error: ${detail}`, "warning");
        }
        // Sincronizar caché de fotos desde memoria local
        const stored = localStorage.getItem('BELIA_CUSTOM_PHOTOS');
        cachedCustomPhotos = stored ? JSON.parse(stored) : [];
        return true;
    }
}

/* --- INVENTARIO / VARIANTES --- */

async function getInventory() {
    if (isDemoMode()) {
        const inv = localStorage.getItem('BELIA_DEMO_INVENTORY');
        return JSON.parse(inv) || [];
    }

    try {
        const { data, error } = await supabaseClient
            .from('inventory')
            .select('*');

        if (error) {
            console.warn("Falla al cargar 'inventory' de Supabase. Usando LocalStorage:", error);
            const inv = localStorage.getItem('BELIA_DEMO_INVENTORY');
            return JSON.parse(inv) || [];
        }
        return data || [];
    } catch (err) {
        console.warn("Excepción al cargar 'inventory' de Supabase. Usando LocalStorage:", err);
        const inv = localStorage.getItem('BELIA_DEMO_INVENTORY');
        return JSON.parse(inv) || [];
    }
}

async function updateInventoryStock(inventoryId, newStock) {
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('inventory')
                .update({ stock: Math.max(0, parseInt(newStock)) })
                .eq('id', inventoryId)
                .select();

            if (error) throw error;
            return data[0];
        } catch (supabaseError) {
            console.warn("Falla de stock en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Stock modificado localmente. Detalle: ${detail}`, "warning");
            }
        }
    }

    // Respaldo Local
    const inventory = await getInventory();
    const idx = inventory.findIndex(i => i.id === inventoryId);
    if (idx !== -1) {
        inventory[idx].stock = Math.max(0, parseInt(newStock));
        localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(inventory));
        return inventory[idx];
    }
    throw new Error("Variant not found in local inventory");
}

async function clearProductStock(productId) {
    if (!isDemoMode()) {
        try {
            let dbProductId = productId;
            if (!isUuid(productId)) {
                const localProds = await getProducts();
                const prod = localProds.find(p => p.id === productId);
                if (prod) {
                    const { data: dbProd, error: findError } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('name', prod.name);
                    
                    if (!findError && dbProd && dbProd.length > 0) {
                        dbProductId = dbProd[0].id;
                    }
                }
            }

            if (isUuid(dbProductId)) {
                const { error } = await supabaseClient
                    .from('inventory')
                    .update({ stock: 0 })
                    .eq('product_id', dbProductId);
                
                if (error) throw error;
                return true;
            }
        } catch (supabaseError) {
            console.warn("Falla al vaciar stock en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Stock vaciado localmente. Detalle: ${detail}`, "warning");
            }
        }
    }

    // Respaldo Local / Modo Demo
    const inventory = await getInventory();
    inventory.forEach(item => {
        if (item.product_id === productId) {
            item.stock = 0;
        }
    });
    localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(inventory));
    return true;
}

/* --- CLIENTES --- */

async function getCustomers() {
    if (isDemoMode()) {
        const cust = localStorage.getItem('BELIA_DEMO_CUSTOMERS');
        return JSON.parse(cust) || [];
    }

    try {
        const { data, error } = await supabaseClient
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn("Falla al cargar 'customers' de Supabase. Usando LocalStorage:", error);
            const cust = localStorage.getItem('BELIA_DEMO_CUSTOMERS');
            return JSON.parse(cust) || [];
        }
        return data || [];
    } catch (err) {
        console.warn("Excepción al cargar 'customers' de Supabase. Usando LocalStorage:", err);
        const cust = localStorage.getItem('BELIA_DEMO_CUSTOMERS');
        return JSON.parse(cust) || [];
    }
}

async function saveCustomer(customer) {
    if (!isDemoMode()) {
        try {
            let isEdit = !!customer.id && isUuid(customer.id);
            let dbCustomerId = isEdit ? customer.id : null;
            let data, error;

            // Si tiene ID pero no es UUID, buscar el cliente por nombre y apellido en Supabase
            if (customer.id && !isUuid(customer.id)) {
                const searchFirst = (customer.first_name || "").trim();
                const searchLast = (customer.last_name || "").trim();
                
                const { data: matched, error: findError } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('first_name', searchFirst)
                    .eq('last_name', searchLast);
                
                if (!findError && matched && matched.length > 0) {
                    isEdit = true;
                    dbCustomerId = matched[0].id;
                }
            }

            if (isEdit) {
                ({ data, error } = await supabaseClient
                    .from('customers')
                    .update({
                        first_name: customer.first_name,
                        last_name: customer.last_name,
                        email: customer.email,
                        phone: customer.phone,
                        notes: customer.notes
                    })
                    .eq('id', dbCustomerId)
                    .select());
            } else {
                ({ data, error } = await supabaseClient
                    .from('customers')
                    .insert([{
                        first_name: customer.first_name,
                        last_name: customer.last_name,
                        email: customer.email,
                        phone: customer.phone,
                        notes: customer.notes
                    }])
                    .select());
            }

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("No se pudo persistir el registro del cliente en la base de datos.");
            }
            return data[0];
        } catch (supabaseError) {
            console.warn("Falla al guardar cliente en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Cliente guardado localmente. Detalle: ${detail}. Recuerda sincronizar Supabase.`, "warning");
            }
        }
    }

    // Respaldo Local
    const customers = await getCustomers();
    const isEdit = !!customer.id;
    const customerId = customer.id || generateId();

    const newCustomer = {
        id: customerId,
        first_name: customer.first_name,
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        notes: customer.notes || '',
        total_spent: customer.total_spent || 0.00,
        created_at: customer.created_at || new Date().toISOString()
    };

    if (isEdit) {
        const idx = customers.findIndex(c => c.id === customerId);
        if (idx !== -1) customers[idx] = newCustomer;
    } else {
        customers.unshift(newCustomer);
    }

    localStorage.setItem('BELIA_DEMO_CUSTOMERS', JSON.stringify(customers));
    return newCustomer;
}

async function deleteCustomer(customerId) {
    if (!isDemoMode()) {
        try {
            let dbCustomerId = customerId;
            if (!isUuid(customerId)) {
                const localCusts = await getCustomers();
                const cust = localCusts.find(c => c.id === customerId);
                if (cust) {
                    const { data: dbCust, error: findError } = await supabaseClient
                        .from('customers')
                        .select('id')
                        .eq('first_name', cust.first_name)
                        .eq('last_name', cust.last_name || "");
                    
                    if (!findError && dbCust && dbCust.length > 0) {
                        dbCustomerId = dbCust[0].id;
                    }
                }
            }

            if (isUuid(dbCustomerId)) {
                const { error } = await supabaseClient
                    .from('customers')
                    .delete()
                    .eq('id', dbCustomerId);
                
                if (error) throw error;
                return true;
            } else {
                console.warn(`deleteCustomer: No se pudo resolver un UUID para el ID de cliente "${customerId}".`);
            }
        } catch (supabaseError) {
            console.warn("Falla al eliminar cliente en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `No se pudo eliminar el cliente de Supabase. Detalle: ${detail}. Borrado local aplicado.`, "warning");
            }
        }
    }

    // Respaldo Local
    const customersList = await getCustomers();
    const filteredCusts = customersList.filter(c => c.id !== customerId);
    localStorage.setItem('BELIA_DEMO_CUSTOMERS', JSON.stringify(filteredCusts));
    return true;
}

/* --- VENTAS --- */

async function getSales() {
    if (isDemoMode()) {
        const sales = localStorage.getItem('BELIA_DEMO_SALES');
        return JSON.parse(sales) || [];
    }

    try {
        const { data, error } = await supabaseClient
            .from('sales')
            .select(`
                id,
                customer_id,
                total_amount,
                payment_method,
                sale_date,
                shift_id,
                sale_items (
                    id,
                    inventory_id,
                    quantity,
                    unit_price,
                    total_price,
                    inventory (
                        size,
                        color,
                        products (
                            name
                        )
                    )
                )
            `)
            .order('sale_date', { ascending: false });

        if (error) {
            console.warn("Falla al cargar 'sales' de Supabase. Usando LocalStorage:", error);
            const sales = localStorage.getItem('BELIA_DEMO_SALES');
            return JSON.parse(sales) || [];
        }

        // Reformatear respuesta para que coincida con la estructura del front
        return (data || []).map(sale => ({
            id: sale.id,
            customer_id: sale.customer_id,
            total_amount: parseFloat(sale.total_amount) || 0,
            payment_method: sale.payment_method,
            sale_date: sale.sale_date,
            shift_id: sale.shift_id,
            items: (sale.sale_items || []).map(item => ({
                id: item.id,
                product_name: item.inventory?.products?.name || "Prenda de cuero",
                size: item.inventory?.size || "U",
                color: item.inventory?.color || "Negro",
                quantity: parseInt(item.quantity) || 0,
                unit_price: parseFloat(item.unit_price) || 0,
                total_price: parseFloat(item.total_price) || 0
            }))
        }));
    } catch (err) {
        console.warn("Excepción al cargar 'sales' de Supabase. Usando LocalStorage:", err);
        const sales = localStorage.getItem('BELIA_DEMO_SALES');
        return JSON.parse(sales) || [];
    }
}

async function saveSale(saleData) {
    const activeShift = await getActiveShift();
    const shiftId = activeShift ? activeShift.id : null;
    const amtCash = parseFloat(saleData.amount_cash) || 0;
    const amtCard = parseFloat(saleData.amount_card) || 0;

    if (!isDemoMode()) {
        try {
            // 1. Insertar la cabecera de la venta
            let saleInsertData = {
                customer_id: saleData.customer_id || null,
                total_amount: parseFloat(saleData.total_amount),
                payment_method: saleData.payment_method,
                amount_cash: amtCash,
                amount_card: amtCard,
                shift_id: shiftId
            };

            let saleHead, saleError;
            ({ data: saleHead, error: saleError } = await supabaseClient
                .from('sales')
                .insert([saleInsertData])
                .select());

            // Si falla por columnas faltantes (amount_cash/amount_card), reintenta sin ellas
            if (saleError && (saleError.message || '').includes('amount_')) {
                console.warn('[BELIA] Columnas amount_cash/amount_card no existen en Supabase. Reintentando sin ellas...');
                const fallbackData = {
                    customer_id: saleData.customer_id || null,
                    total_amount: parseFloat(saleData.total_amount),
                    payment_method: saleData.payment_method,
                    shift_id: shiftId
                };
                ({ data: saleHead, error: saleError } = await supabaseClient
                    .from('sales')
                    .insert([fallbackData])
                    .select());
            }

            if (saleError) throw saleError;
            const insertedSale = saleHead[0];

            // 2. Insertar los ítems de venta
            const itemRecords = saleData.items.map(item => ({
                sale_id: insertedSale.id,
                inventory_id: item.inventory_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.unit_price * item.quantity
            }));

            const { error: itemsError } = await supabaseClient
                .from('sale_items')
                .insert(itemRecords);

            if (itemsError) throw itemsError;

            // 3. Descontar stock e interactuar con base de datos en Supabase
            for (const item of saleData.items) {
                const { data: currentStockRecord, error: fetchError } = await supabaseClient
                    .from('inventory')
                    .select('stock')
                    .eq('id', item.inventory_id)
                    .single();
                
                if (fetchError) throw fetchError;
                
                const newStockVal = Math.max(0, currentStockRecord.stock - item.quantity);

                const { error: updateError } = await supabaseClient
                    .from('inventory')
                    .update({ stock: newStockVal })
                    .eq('id', item.inventory_id);

                if (updateError) throw updateError;
            }

            // 4. Actualizar total de gasto de cliente
            if (saleData.customer_id) {
                const { data: custRecord, error: fetchCustError } = await supabaseClient
                    .from('customers')
                    .select('total_spent')
                    .eq('id', saleData.customer_id)
                    .single();

                if (!fetchCustError && custRecord) {
                    const newTotalSpent = (parseFloat(custRecord.total_spent) || 0) + parseFloat(saleData.total_amount);
                    await supabaseClient
                        .from('customers')
                        .update({ total_spent: newTotalSpent })
                        .eq('id', saleData.customer_id);
                }
            }

            return insertedSale;
        } catch (supabaseError) {
            console.warn("Falla al guardar venta en Supabase. Aplicando localmente:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Venta registrada localmente. Detalle: ${detail}`, "warning");
            }
        }
    }


    // Respaldo Local
    const sales = await getSales();
    const customers = await getCustomers();
    const inventory = await getInventory();
    const products = await getProducts();

    const saleId = generateId();
    const saleItems = [];

    // Reducir stock local y preparar detalles
    for (const item of saleData.items) {
        const invIdx = inventory.findIndex(inv => inv.id === item.inventory_id);
        if (invIdx === -1) throw new Error("Variant stock error!");
        
        // Deducción
        inventory[invIdx].stock = Math.max(0, inventory[invIdx].stock - item.quantity);
        
        const prod = products.find(p => p.id === inventory[invIdx].product_id);
        const pName = prod ? prod.name : "Prenda";

        saleItems.push({
            id: generateId(),
            product_name: pName,
            size: inventory[invIdx].size,
            color: inventory[invIdx].color,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity
        });
    }

    const newSale = {
        id: saleId,
        customer_id: saleData.customer_id || null,
        total_amount: parseFloat(saleData.total_amount),
        payment_method: saleData.payment_method,
        amount_cash: amtCash,
        amount_card: amtCard,
        shift_id: shiftId,
        sale_date: new Date().toISOString(),
        items: saleItems
    };

    sales.unshift(newSale);

    // Sumar al total gastado del cliente si corresponde
    if (saleData.customer_id) {
        const custIdx = customers.findIndex(c => c.id === saleData.customer_id);
        if (custIdx !== -1) {
            customers[custIdx].total_spent = (parseFloat(customers[custIdx].total_spent) || 0) + parseFloat(saleData.total_amount);
        }
    }

    localStorage.setItem('BELIA_DEMO_SALES', JSON.stringify(sales));
    localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(inventory));
    
    return newSale;
}

// ==========================================================================
// CONTROL DE TURNOS Y CAJA (CASH SHIFTS SYSTEM)
// ==========================================================================

async function getActiveShift() {
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('cash_shifts')
                .select('*')
                .eq('status', 'open')
                .maybeSingle();

            if (error) throw error;
            return data;
        } catch (err) {
            console.warn("Excepción al consultar cash_shifts de Supabase. Usando LocalStorage:", err);
        }
    }

    const shifts = JSON.parse(localStorage.getItem('BELIA_DEMO_SHIFTS')) || [];
    return shifts.find(s => s.status === 'open') || null;
}

async function openShift(openingCash) {
    const cashVal = parseFloat(openingCash) || 0;
    const userName = localStorage.getItem('BELIA_USER_NAME') || 'Administrador';

    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('cash_shifts')
                .insert([{
                    opened_by: userName,
                    opening_cash: cashVal,
                    status: 'open'
                }])
                .select();

            if (error) throw error;
            return data[0];
        } catch (err) {
            console.warn("Falla al abrir turno en Supabase. Usando local:", err);
        }
    }

    // Modo Demo
    const shifts = JSON.parse(localStorage.getItem('BELIA_DEMO_SHIFTS')) || [];
    const newShift = {
        id: generateId(),
        opened_by: userName,
        opened_at: new Date().toISOString(),
        closed_at: null,
        opening_cash: cashVal,
        expected_cash: cashVal,
        expected_card: 0,
        actual_cash: 0,
        actual_card: 0,
        cash_difference: 0,
        card_difference: 0,
        status: 'open',
        notes: ''
    };

    shifts.unshift(newShift);
    localStorage.setItem('BELIA_DEMO_SHIFTS', JSON.stringify(shifts));
    return newShift;
}

async function closeShift(shiftId, actualCash, actualCard, notes = '') {
    const actCash = parseFloat(actualCash) || 0;
    const actCard = parseFloat(actualCard) || 0;

    // 1. Calcular totales del turno
    let shiftSales = [];
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('sales')
                .select('total_amount, payment_method, amount_cash, amount_card')
                .eq('shift_id', shiftId);

            if (error) throw error;
            shiftSales = data || [];
        } catch (err) {
            console.warn("Falla al cargar ventas del turno en Supabase, recurriendo a LocalStorage para totales:", err);
            const allSales = JSON.parse(localStorage.getItem('BELIA_DEMO_SALES')) || [];
            shiftSales = allSales.filter(s => s.shift_id === shiftId);
        }
    } else {
        const allSales = JSON.parse(localStorage.getItem('BELIA_DEMO_SALES')) || [];
        shiftSales = allSales.filter(s => s.shift_id === shiftId);
    }

    const totalSoldCash = shiftSales.reduce((sum, s) => sum + (parseFloat(s.amount_cash) || 0), 0);
    const totalSoldCard = shiftSales.reduce((sum, s) => sum + (parseFloat(s.amount_card) || 0), 0);

    // 2. Obtener el turno
    let shift = null;
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('cash_shifts')
                .select('*')
                .eq('id', shiftId)
                .single();

            if (error) throw error;
            shift = data;
        } catch (err) {
            console.warn("Falla al cargar turno en Supabase:", err);
        }
    }

    if (!shift) {
        const shifts = JSON.parse(localStorage.getItem('BELIA_DEMO_SHIFTS')) || [];
        shift = shifts.find(s => s.id === shiftId);
    }

    if (!shift) throw new Error("Turno no encontrado!");

    const expCash = parseFloat(shift.opening_cash) + totalSoldCash;
    const expCard = totalSoldCard;
    const cashDiff = actCash - expCash;
    const cardDiff = actCard - expCard;

    const closedAt = new Date().toISOString();

    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('cash_shifts')
                .update({
                    closed_at: closedAt,
                    expected_cash: expCash,
                    expected_card: expCard,
                    actual_cash: actCash,
                    actual_card: actCard,
                    cash_difference: cashDiff,
                    card_difference: cardDiff,
                    status: 'closed',
                    notes: notes
                })
                .eq('id', shiftId)
                .select();

            if (error) throw error;
            return data[0];
        } catch (err) {
            console.warn("Falla al cerrar turno en Supabase. Guardando localmente:", err);
        }
    }

    // Local
    const shifts = JSON.parse(localStorage.getItem('BELIA_DEMO_SHIFTS')) || [];
    const idx = shifts.findIndex(s => s.id === shiftId);
    if (idx !== -1) {
        shifts[idx] = {
            ...shifts[idx],
            closed_at: closedAt,
            expected_cash: expCash,
            expected_card: expCard,
            actual_cash: actCash,
            actual_card: actCard,
            cash_difference: cashDiff,
            card_difference: cardDiff,
            status: 'closed',
            notes: notes
        };
        localStorage.setItem('BELIA_DEMO_SHIFTS', JSON.stringify(shifts));
        return shifts[idx];
    }

    throw new Error("Turno no encontrado localmente para cerrar.");
}

async function getCashShifts() {
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('cash_shifts')
                .select('*')
                .order('opened_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn("Falla al consultar cash_shifts de Supabase. Usando LocalStorage:", err);
        }
    }

    return JSON.parse(localStorage.getItem('BELIA_DEMO_SHIFTS')) || [];
}

/* --- USUARIOS Y PERMISOS --- */

async function getUsers() {
    if (isDemoMode()) {
        const users = localStorage.getItem('BELIA_USERS');
        if (!users) {
            const defaultUsers = [
                { id: 'u-admin', name: 'Administrador', password: 'admin123', role: 'admin' },
                { id: 'u-setter', name: 'Vendedor / Setter', password: 'setter123', role: 'setter' }
            ];
            localStorage.setItem('BELIA_USERS', JSON.stringify(defaultUsers));
            return defaultUsers;
        }
        return JSON.parse(users) || [];
    }

    try {
        const { data, error } = await supabaseClient
            .from('belia_users')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.warn("Falla al cargar 'belia_users' de Supabase. Usando LocalStorage:", error);
            const users = localStorage.getItem('BELIA_USERS');
            return JSON.parse(users) || [];
        }
        return data || [];
    } catch (err) {
        console.warn("Excepción al cargar 'belia_users' de Supabase. Usando LocalStorage:", err);
        const users = localStorage.getItem('BELIA_USERS');
        return JSON.parse(users) || [];
    }
}

async function saveUser(user) {
    if (!isDemoMode()) {
        try {
            const isEdit = !!user.id;
            let data, error;

            if (isEdit) {
                ({ data, error } = await supabaseClient
                    .from('belia_users')
                    .update({
                        name: user.name,
                        password: user.password,
                        role: user.role
                    })
                    .eq('id', user.id)
                    .select());
            } else {
                const userId = 'u-' + Date.now();
                ({ data, error } = await supabaseClient
                    .from('belia_users')
                    .insert([{
                        id: userId,
                        name: user.name,
                        password: user.password,
                        role: user.role
                    }])
                    .select());
            }

            if (error) throw error;
            return data[0];
        } catch (supabaseError) {
            console.warn("Falla al guardar usuario en Supabase. Aplicando localmente:", supabaseError);
        }
    }

    // Respaldo Local
    const users = await getUsers();
    const isEdit = !!user.id;
    const userId = user.id || 'u-' + Date.now();

    const newUser = {
        id: userId,
        name: user.name,
        password: user.password,
        role: user.role,
        created_at: user.created_at || new Date().toISOString()
    };

    if (isEdit) {
        const idx = users.findIndex(u => u.id === userId);
        if (idx !== -1) users[idx] = newUser;
    } else {
        users.push(newUser);
    }

    localStorage.setItem('BELIA_USERS', JSON.stringify(users));
    return newUser;
}

async function deleteUser(userId) {
    if (!isDemoMode()) {
        try {
            const { error } = await supabaseClient
                .from('belia_users')
                .delete()
                .eq('id', userId);
            
            if (error) throw error;
            return true;
        } catch (supabaseError) {
            console.warn("Falla al eliminar usuario en Supabase. Aplicando localmente:", supabaseError);
        }
    }

    // Respaldo Local
    const usersList = await getUsers();
    const filteredUsers = usersList.filter(u => u.id !== userId);
    localStorage.setItem('BELIA_USERS', JSON.stringify(filteredUsers));
    return true;
}

async function importInventoryBatch(productsList, variantsMap) {
    let importedCount = 0;
    if (!isDemoMode()) {
        try {
            for (const item of productsList) {
                const searchCode = (item.supplier_code || "").trim();
                const searchName = (item.name || "").trim();
                let productId = null;
                
                // Buscar producto existente en Supabase por código de proveedor o por nombre
                let matched = null;
                if (searchCode) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('supplier_code', searchCode);
                    if (!error && data && data.length > 0) matched = data;
                }
                if (!matched && searchName) {
                    const { data, error } = await supabaseClient
                        .from('products')
                        .select('id')
                        .eq('name', searchName);
                    if (!error && data && data.length > 0) matched = data;
                }
                
                if (matched && matched.length > 0) {
                    productId = matched[0].id;
                    // Actualizar el producto existente
                    const { error: updateError } = await supabaseClient
                        .from('products')
                        .update({
                            category: item.category || 'Otros',
                            description: item.description || '',
                            cost_price: parseFloat(item.cost_price) || 0,
                            selling_price: parseFloat(item.selling_price) || 0,
                            image_url: item.image_url || null,
                            supplier_name: item.supplier_name || ""
                        })
                        .eq('id', productId);
                    
                    if (updateError) throw updateError;
                } else {
                    // Insertar producto nuevo
                    const { data: savedProduct, error: prodError } = await supabaseClient
                        .from('products')
                        .insert([{
                            name: item.name,
                            category: item.category || 'Otros',
                            description: item.description || '',
                            cost_price: parseFloat(item.cost_price) || 0,
                            selling_price: parseFloat(item.selling_price) || 0,
                            image_url: item.image_url || null,
                            supplier_code: item.supplier_code || "",
                            supplier_name: item.supplier_name || ""
                        }])
                        .select();

                    if (prodError) throw prodError;
                    productId = savedProduct[0].id;
                }

                // Borrar variantes previas para este producto
                const { error: delError } = await supabaseClient
                    .from('inventory')
                    .delete()
                    .eq('product_id', productId);
                
                if (delError) throw delError;

                const itemVariants = variantsMap[item.name] || [];
                const insertVariants = itemVariants.map(v => ({
                    product_id: productId,
                    size: v.size.toUpperCase(),
                    color: v.color,
                    stock: parseInt(v.stock) || 0,
                    sku: v.sku || generateSKU(item.supplier_code, v.color, v.size, v.piel),
                    piel: v.piel || 'Vaca'
                }));

                if (insertVariants.length > 0) {
                    const { error: invError } = await supabaseClient
                        .from('inventory')
                        .insert(insertVariants);
                    
                    if (invError) throw invError;
                }
                importedCount++;
            }
            return { count: importedCount };
        } catch (supabaseError) {
            console.warn("Falla de importación por lote en Supabase. Aplicando respaldo local:", supabaseError);
            const detail = supabaseError?.message || (typeof supabaseError === 'object' ? JSON.stringify(supabaseError) : String(supabaseError));
            if (typeof showToast === 'function') {
                showToast("Modo Respaldo", `Importación falló en Supabase. Detalle: ${detail}. Guardando localmente.`, "warning");
            }
        }
    }

    // Respaldo Local
    const products = await getProducts();
    const inventory = await getInventory();

    for (const item of productsList) {
        const productId = generateId();

        const newProduct = {
            id: productId,
            name: item.name,
            category: item.category || 'Otros',
            description: item.description || '',
            cost_price: parseFloat(item.cost_price) || 0,
            selling_price: parseFloat(item.selling_price) || 0,
            image_url: item.image_url || 'LOGO.jpeg',
            supplier_code: item.supplier_code || "",
            supplier_name: item.supplier_name || "SKULL Custom Leather",
            created_at: new Date().toISOString()
        };

        products.unshift(newProduct);

        const itemVariants = variantsMap[item.name] || [];
        itemVariants.forEach(v => {
            inventory.push({
                id: generateId(),
                product_id: productId,
                size: v.size.toUpperCase(),
                color: v.color,
                stock: parseInt(v.stock) || 0,
                sku: v.sku || generateSKU(item.supplier_code, v.color, v.size, v.piel),
                piel: v.piel || 'Vaca'
            });
        });
    }

    localStorage.setItem('BELIA_DEMO_PRODUCTS', JSON.stringify(products));
    localStorage.setItem('BELIA_DEMO_INVENTORY', JSON.stringify(inventory));
    return { count: productsList.length };
}

async function seedSupabaseDatabase() {
    if (isDemoMode()) {
        throw new Error("Supabase no está conectado. Configura las credenciales primero.");
    }

    try {
        const idMap = {};
        
        // 1. Insertar productos de DEFAULT_PRODUCTS
        for (const p of DEFAULT_PRODUCTS) {
            // Verificar si ya existe por nombre para evitar duplicaciones
            const { data: existing, error: checkErr } = await supabaseClient
                .from('products')
                .select('id')
                .eq('name', p.name)
                .maybeSingle();
            
            if (checkErr) {
                console.error("Error check existing product:", checkErr);
                continue;
            }

            let productId;
            if (existing) {
                productId = existing.id;
                console.log(`Product already exists: ${p.name} with ID ${productId}`);
            } else {
                const { data: inserted, error: insErr } = await supabaseClient
                    .from('products')
                    .insert([{
                        name: p.name,
                        category: p.category,
                        description: p.description,
                        cost_price: p.cost_price,
                        selling_price: p.selling_price,
                        image_url: p.image_url,
                        supplier_code: p.supplier_code || "",
                        supplier_name: p.supplier_name || ""
                    }])
                    .select();
                
                if (insErr) {
                    console.error("Error seeding product:", p.name, insErr);
                    throw insErr;
                }
                productId = inserted[0].id;
                console.log(`Seeded new product: ${p.name} with ID ${productId}`);
            }
            idMap[p.id] = productId;
        }

        // 2. Insertar variantes (DEFAULT_INVENTORY) mapeando product_id
        const variantsToInsert = [];
        for (const inv of DEFAULT_INVENTORY) {
            const newProductId = idMap[inv.product_id];
            if (!newProductId) continue;

            // Verificar si la variante ya existe
            const { data: existingInv, error: checkInvErr } = await supabaseClient
                .from('inventory')
                .select('id')
                .eq('product_id', newProductId)
                .eq('size', inv.size.toUpperCase())
                .eq('color', inv.color)
                .eq('piel', inv.piel || 'Vaca')
                .maybeSingle();
            
            if (checkInvErr || existingInv) {
                console.log(`Variant size ${inv.size} color ${inv.color} skin ${inv.piel || 'Vaca'} already exists for product ${newProductId}`);
                continue;
            }

            variantsToInsert.push({
                product_id: newProductId,
                size: inv.size.toUpperCase(),
                color: inv.color,
                stock: inv.stock,
                sku: inv.sku,
                piel: inv.piel || 'Vaca'
            });
        }

        if (variantsToInsert.length > 0) {
            const { error: insInvErr } = await supabaseClient
                .from('inventory')
                .insert(variantsToInsert);
            
            if (insInvErr) {
                console.error("Error seeding inventory variants:", insInvErr);
                throw insInvErr;
            }
            console.log(`Seeded ${variantsToInsert.length} inventory variants to Supabase.`);
        }

        // 3. Semillar clientes (DEFAULT_CUSTOMERS)
        const customersToInsert = [];
        for (const cust of DEFAULT_CUSTOMERS) {
            const { data: existingCust, error: checkCustErr } = await supabaseClient
                .from('customers')
                .select('id')
                .eq('email', cust.email)
                .maybeSingle();
            
            if (checkCustErr || existingCust) continue;

            customersToInsert.push({
                first_name: cust.first_name,
                last_name: cust.last_name,
                email: cust.email,
                phone: cust.phone,
                notes: cust.notes,
                total_spent: cust.total_spent
            });
        }

        if (customersToInsert.length > 0) {
            const { error: insCustErr } = await supabaseClient
                .from('customers')
                .insert(customersToInsert);
            
            if (insCustErr) {
                console.error("Error seeding customers:", insCustErr);
                throw insCustErr;
            }
        }

        // 4. Semillar fotos (DEFAULT_PHOTO_LIBRARY)
        const photosToInsert = [];
        for (const photo of DEFAULT_PHOTO_LIBRARY) {
            const { data: existingPhoto, error: checkPhotoErr } = await supabaseClient
                .from('photo_library')
                .select('id')
                .eq('title', photo.title)
                .eq('color', photo.color)
                .maybeSingle();
            
            if (checkPhotoErr || existingPhoto) continue;

            photosToInsert.push({
                title: photo.title,
                color: photo.color,
                image_url: photo.image_url
            });
        }

        if (photosToInsert.length > 0) {
            const { error: insPhotoErr } = await supabaseClient
                .from('photo_library')
                .insert(photosToInsert);
            
            if (insPhotoErr) {
                console.error("Error seeding photos:", insPhotoErr);
                throw insPhotoErr;
            }
        }

        // 5. Semillar usuarios (belia_users)
        const defaultUsersToInsert = [
            { id: 'u-admin', name: 'Administrador', password: 'admin123', role: 'admin' },
            { id: 'u-setter', name: 'Vendedor / Setter', password: 'setter123', role: 'setter' }
        ];

        for (const u of defaultUsersToInsert) {
            const { data: existingUser, error: checkUserErr } = await supabaseClient
                .from('belia_users')
                .select('id')
                .eq('id', u.id)
                .maybeSingle();

            if (checkUserErr || existingUser) continue;

            const { error: insUserErr } = await supabaseClient
                .from('belia_users')
                .insert([u]);

            if (insUserErr) {
                console.error("Error seeding default user:", u.name, insUserErr);
                throw insUserErr;
            }
        }

        return { success: true, count: Object.keys(idMap).length };
    } catch (err) {
        console.error("Critical error seeding Supabase database:", err);
        throw err;
    }
}

// Analizar desglose detallado de pagos de una venta (Efectivo, Débito, Crédito, Transferencia)
function getSalePaymentBreakdown(sale) {
    const breakdown = {
        efectivo: 0,
        debito: 0,
        credito: 0,
        transferencia: 0,
        total: parseFloat(sale.total_amount) || 0
    };

    const method = sale.payment_method || '';

    if (method.startsWith('Dividido:')) {
        const regex = /([^:+]+)\((\d+(?:\.\d+)?)\)/g;
        let match;
        const methodStr = method.substring(9);
        while ((match = regex.exec(methodStr)) !== null) {
            const mName = match[1].trim().toLowerCase();
            const mAmount = parseFloat(match[2]) || 0;

            if (mName.includes('efectivo')) {
                breakdown.efectivo += mAmount;
            } else if (mName.includes('débito') || mName.includes('debito')) {
                breakdown.debito += mAmount;
            } else if (mName.includes('crédito') || mName.includes('credito')) {
                breakdown.credito += mAmount;
            } else if (mName.includes('transferencia')) {
                breakdown.transferencia += mAmount;
            }
        }
    } else {
        const mName = method.toLowerCase();
        if (mName.includes('efectivo')) {
            breakdown.efectivo = breakdown.total;
        } else if (mName.includes('débito') || mName.includes('debito')) {
            breakdown.debito = breakdown.total;
        } else if (mName.includes('crédito') || mName.includes('credito')) {
            breakdown.credito = breakdown.total;
        } else if (mName.includes('transferencia')) {
            breakdown.transferencia = breakdown.total;
        }
    }

    return breakdown;
}

/* --- CITAS DE SHOWROOM Y RESERVAS --- */

async function getAppointments() {
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('showroom_appointments')
                .select('*')
                .order('appointment_date', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn("Falla al consultar showroom_appointments de Supabase. Usando LocalStorage:", err);
        }
    }

    return JSON.parse(localStorage.getItem('BELIA_DEMO_APPOINTMENTS')) || [];
}

async function saveAppointment(appt) {
    const isEdit = !!appt.id;
    
    // Validar y redondear hora a múltiplos de 5 minutos si es necesario
    if (appt.appointment_date) {
        const d = new Date(appt.appointment_date);
        const mins = d.getMinutes();
        if (mins % 5 !== 0) {
            const roundedMins = Math.round(mins / 5) * 5;
            d.setMinutes(roundedMins);
            appt.appointment_date = d.toISOString();
        }
    }

    if (!isDemoMode()) {
        try {
            if (isEdit) {
                const { data, error } = await supabaseClient
                    .from('showroom_appointments')
                    .update({
                        client_name: appt.client_name,
                        phone: appt.phone,
                        appointment_date: appt.appointment_date,
                        inventory_id: appt.inventory_id || null,
                        notes: appt.notes,
                        status: appt.status || 'pending'
                    })
                    .eq('id', appt.id)
                    .select();

                if (error) throw error;
                return data[0];
            } else {
                const { data, error } = await supabaseClient
                    .from('showroom_appointments')
                    .insert([{
                        client_name: appt.client_name,
                        phone: appt.phone,
                        appointment_date: appt.appointment_date,
                        inventory_id: appt.inventory_id || null,
                        notes: appt.notes,
                        status: 'pending'
                    }])
                    .select();

                if (error) throw error;
                return data[0];
            }
        } catch (err) {
            console.warn("Falla al guardar cita en Supabase. Usando LocalStorage:", err);
        }
    }

    // Modo Demo
    const appts = JSON.parse(localStorage.getItem('BELIA_DEMO_APPOINTMENTS')) || [];
    if (isEdit) {
        const idx = appts.findIndex(a => a.id === appt.id);
        if (idx !== -1) {
            appts[idx] = {
                ...appts[idx],
                client_name: appt.client_name,
                phone: appt.phone,
                appointment_date: appt.appointment_date,
                inventory_id: appt.inventory_id || null,
                notes: appt.notes,
                status: appt.status || 'pending'
            };
            localStorage.setItem('BELIA_DEMO_APPOINTMENTS', JSON.stringify(appts));
            return appts[idx];
        }
    } else {
        const newAppt = {
            id: generateId(),
            client_name: appt.client_name,
            phone: appt.phone,
            appointment_date: appt.appointment_date,
            inventory_id: appt.inventory_id || null,
            notes: appt.notes,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        appts.push(newAppt);
        localStorage.setItem('BELIA_DEMO_APPOINTMENTS', JSON.stringify(appts));
        return newAppt;
    }
}

async function completeAppointment(id) {
    if (!isDemoMode()) {
        try {
            const { data, error } = await supabaseClient
                .from('showroom_appointments')
                .update({ status: 'completed' })
                .eq('id', id)
                .select();

            if (error) throw error;
            return data[0];
        } catch (err) {
            console.warn("Falla al completar cita en Supabase. Usando LocalStorage:", err);
        }
    }

    const appts = JSON.parse(localStorage.getItem('BELIA_DEMO_APPOINTMENTS')) || [];
    const idx = appts.findIndex(a => a.id === id);
    if (idx !== -1) {
        appts[idx].status = 'completed';
        localStorage.setItem('BELIA_DEMO_APPOINTMENTS', JSON.stringify(appts));
        return appts[idx];
    }
}

async function deleteAppointment(id) {
    if (!isDemoMode()) {
        try {
            const { error } = await supabaseClient
                .from('showroom_appointments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.warn("Falla al eliminar cita en Supabase. Usando LocalStorage:", err);
        }
    }

    const appts = JSON.parse(localStorage.getItem('BELIA_DEMO_APPOINTMENTS')) || [];
    const filtered = appts.filter(a => a.id !== id);
    localStorage.setItem('BELIA_DEMO_APPOINTMENTS', JSON.stringify(filtered));
    return true;
}

async function sendFormSubmitEmail(appt, email) {
    if (!email) return false;
    
    // Buscar detalles de stock
    let details = "Solo interés general / Sin prenda reservada";
    if (appt.inventory_id) {
        const storedInv = localStorage.getItem('BELIA_DEMO_INVENTORY');
        const invList = storedInv ? JSON.parse(storedInv) : [];
        const inv = invList.find(i => i.id === appt.inventory_id);
        if (inv) {
            const storedProds = localStorage.getItem('BELIA_DEMO_PRODUCTS');
            const prodList = storedProds ? JSON.parse(storedProds) : [];
            const prod = prodList.find(p => p.id === inv.product_id);
            if (prod) {
                details = `${prod.name} (${inv.color} - Talle ${inv.size} - Piel ${inv.piel || 'Vaca'})`;
            }
        }
    }

    const dateFormatted = new Date(appt.appointment_date).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    const payload = {
        _subject: "Nueva Cita Agendada en Showroom - BELIA CRM",
        "Nombre del Cliente": appt.client_name,
        "Celular": appt.phone || "No provisto",
        "Fecha y Hora": dateFormatted,
        "Prenda Reservada / Interés": details,
        "Observaciones": appt.notes || "Ninguna",
        "_honey": ""
    };

    try {
        const res = await fetch(`https://formsubmit.co/ajax/${email}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data.success === 'true' || data.success === true;
    } catch (err) {
        console.error("Error al enviar FormSubmit:", err);
        return false;
    }
}

// SQL DE CONFIGURACIÓN DE SUPABASE
const SUPABASE_SQL_SETUP = `-- 1. Tabla de Productos (Catálogo)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    cost_price NUMERIC(10,2) NOT NULL,
    selling_price NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    supplier_code TEXT,
    supplier_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Variantes e Inventario (Stock por Talle y Color)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    sku TEXT UNIQUE,
    piel TEXT DEFAULT 'Vaca' NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas necesarias
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS piel TEXT DEFAULT 'Vaca';

-- 3. Tabla de Clientes (CRM)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    total_spent NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3.1 Tabla de Turnos / Caja Chica
CREATE TABLE IF NOT EXISTS cash_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opened_by TEXT DEFAULT 'Administrador',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    opening_cash NUMERIC(10,2) NOT NULL,
    expected_cash NUMERIC(10,2) DEFAULT 0.00,
    expected_card NUMERIC(10,2) DEFAULT 0.00,
    actual_cash NUMERIC(10,2) DEFAULT 0.00,
    actual_card NUMERIC(10,2) DEFAULT 0.00,
    cash_difference NUMERIC(10,2) DEFAULT 0.00,
    card_difference NUMERIC(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'open' NOT NULL,
    notes TEXT
);

-- 4. Tabla de Ventas (Cabecera)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    amount_cash NUMERIC(10,2) DEFAULT 0.00,
    amount_card NUMERIC(10,2) DEFAULT 0.00,
    shift_id UUID REFERENCES cash_shifts(id) ON DELETE SET NULL,
    sale_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabla de Detalles de Ventas (Renglones)
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL
);

-- 5.1 Tabla de Base de Fotos de Clientes
CREATE TABLE IF NOT EXISTS photo_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    color TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(title, color)
);

-- 5.2 Tabla de Usuarios y Accesos
CREATE TABLE IF NOT EXISTS belia_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5.3 Tabla de Citas de Showroom
CREATE TABLE IF NOT EXISTS showroom_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    phone TEXT,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Habilitar lecturas públicas o configurar políticas RLS básicas
-- Para facilitar el desarrollo rápido, habilitar acceso sin credenciales restrictivas:
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE belia_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON photo_library FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON cash_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON belia_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir lectura y escritura total para usuarios anónimos" ON showroom_appointments FOR ALL USING (true) WITH CHECK (true);
`;
