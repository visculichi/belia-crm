const { Client } = require('pg');

const SQL_SETUP = `
-- 1. Tabla de Productos (Catálogo)
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

-- Asegurar que existan las nuevas columnas de proveedor en la tabla products existente
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name TEXT;

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

-- Asegurar que exista el SKU y la columna de piel en la tabla inventory
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Eliminar restricción de unicidad para permitir múltiples fotos por variante
ALTER TABLE photo_library DROP CONSTRAINT IF EXISTS photo_library_title_color_key;

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
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    phone TEXT,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar que exista customer_id en la tabla showroom_appointments existente
ALTER TABLE showroom_appointments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;


-- 6. Habilitar lecturas públicas o configurar políticas RLS básicas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE belia_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE showroom_appointments ENABLE ROW LEVEL SECURITY;

-- Borrar políticas previas si ya existen para evitar errores al re-correr el script
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON products;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON inventory;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON customers;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON sales;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON sale_items;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON photo_library;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON cash_shifts;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON belia_users;
DROP POLICY IF EXISTS "Permitir lectura y escritura total para usuarios anónimos" ON showroom_appointments;

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
        first_name: "Valentina",
        last_name: "Rossi",
        email: "vale.rossi@example.com",
        phone: "+54 11 5555 1234",
        notes: "Prefiere chaquetas entalladas. Cliente VIP habitual.",
        total_spent: 810000.00
    },
    {
        first_name: "Mateo",
        last_name: "Benítez",
        email: "mateo@example.com",
        phone: "+54 9 341 555 7890",
        notes: "Compró el bolso de viaje Toscana. Valora el curtido vegetal.",
        total_spent: 290000.00
    },
    {
        first_name: "Sofía",
        last_name: "Martínez",
        email: "sofia.m@example.com",
        phone: "+54 11 4444 8888",
        notes: "Interesada en abrigos de gamuza, talle M.",
        total_spent: 490000.00
    }
];

const DEFAULT_PHOTO_LIBRARY = [
    { title: "Chaqueta Biker de Cuero 'Venezia'", color: "Negro", image_url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=600&auto=format&fit=crop" },
    { title: "Chaqueta Biker de Cuero 'Venezia'", color: "Chocolate", image_url: "https://images.unsplash.com/photo-1548883354-7622d03aca27?q=80&w=600&auto=format&fit=crop" },
    { title: "Tapado Largo 'Imperia' en Gamuza", color: "Camel", image_url: "https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=600&auto=format&fit=crop" },
    { title: "Pantalón Ajustado 'Milano'", color: "Negro", image_url: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=600&auto=format&fit=crop" },
    { title: "Chaleco Biker 'Palermo'", color: "Negro", image_url: "https://images.unsplash.com/photo-1629131726692-1accd0c53db0?q=80&w=600&auto=format&fit=crop" },
    { title: "Bolso de Viaje 'Toscana'", color: "Suela", image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=600&auto=format&fit=crop" }
];

async function main() {
    const config = {
        host: 'aws-1-us-east-2.pooler.supabase.com',
        port: 6543,
        user: 'postgres.wzxuwdvpgjdflrmprwar',
        password: 'GRIDOolazabal4409*',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    };

    const client = new Client(config);

    try {
        console.log('🔄 Conectando a Supabase a través del Pooler IPv4 (aws-1-us-east-2)...');
        await client.connect();
        console.log('✅ Conexión establecida con éxito.');

        console.log('🔄 Ejecutando DDL e inyección de nuevas columnas...');
        await client.query(SQL_SETUP);
        console.log('✅ Tablas y políticas RLS creadas/verificadas exitosamente.');

        // Limpiar catálogo previo para asegurar una recarga limpia 100% en Pesos Argentinos
        console.log('🧹 Limpiando catálogo y stock anteriores para recargar en Pesos Argentinos (ARS)...');
        await client.query('TRUNCATE TABLE products, inventory, customers, sales, sale_items, photo_library, belia_users RESTART IDENTITY CASCADE;');

        console.log('🌱 Semillando base de datos online con productos base, stock inicial y clientes de demostración...');

            const idMap = {};

            // 1. Insertar productos de DEFAULT_PRODUCTS
            for (const p of DEFAULT_PRODUCTS) {
                const queryText = `
                    INSERT INTO products (name, category, description, cost_price, selling_price, image_url, supplier_code, supplier_name)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id;
                `;
                const values = [
                    p.name, p.category, p.description, p.cost_price, p.selling_price, p.image_url, p.supplier_code, p.supplier_name
                ];
                const res = await client.query(queryText, values);
                const newUuid = res.rows[0].id;
                idMap[p.id] = newUuid;
                console.log(`  + Producto registrado: "${p.name}" (UUID: ${newUuid})`);
            }

            // 2. Insertar variantes (DEFAULT_INVENTORY)
            console.log('🌱 Semillando variantes de talle & color (inventario activo)...');
            let seededVariantsCount = 0;
            for (const inv of DEFAULT_INVENTORY) {
                const newProductId = idMap[inv.product_id];
                if (!newProductId) continue;

                const queryText = `
                    INSERT INTO inventory (product_id, size, color, stock, sku, piel)
                    VALUES ($1, $2, $3, $4, $5, $6);
                `;
                const values = [
                    newProductId, inv.size.toUpperCase(), inv.color, inv.stock, inv.sku, inv.piel || 'Vaca'
                ];
                await client.query(queryText, values);
                seededVariantsCount++;
            }
            console.log(`  + Variantes registradas: ${seededVariantsCount} filas creadas.`);

            // 3. Semillar clientes (DEFAULT_CUSTOMERS)
            console.log('🌱 Semillando clientes CRM de prueba...');
            for (const c of DEFAULT_CUSTOMERS) {
                const queryText = `
                    INSERT INTO customers (first_name, last_name, email, phone, notes, total_spent)
                    VALUES ($1, $2, $3, $4, $5, $6);
                `;
                const values = [
                    c.first_name, c.last_name, c.email, c.phone, c.notes, c.total_spent
                ];
                await client.query(queryText, values);
                console.log(`  + Cliente registrado: "${c.first_name} ${c.last_name || ''}"`);
            }

            // 4. Semillar fotos (DEFAULT_PHOTO_LIBRARY)
            console.log('🌱 Semillando base de fotos de cuero...');
            for (const ph of DEFAULT_PHOTO_LIBRARY) {
                const queryText = `
                    INSERT INTO photo_library (title, color, image_url)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (title, color) DO NOTHING;
                `;
                const values = [
                    ph.title, ph.color, ph.image_url
                ];
                await client.query(queryText, values);
            }
            console.log('  + Biblioteca de fotos cargada.');
            
            // 5. Semillar usuarios (belia_users)
            console.log('🌱 Semillando usuarios de acceso...');
            const defaultUsersToInsert = [
                { id: 'u-admin', name: 'Administrador', password: 'admin123', role: 'admin' },
                { id: 'u-setter', name: 'Vendedor / Setter', password: 'setter123', role: 'setter' }
            ];

            for (const u of defaultUsersToInsert) {
                const queryText = `
                    INSERT INTO belia_users (id, name, password, role)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO NOTHING;
                `;
                const values = [u.id, u.name, u.password, u.role];
                await client.query(queryText, values);
            }
            console.log('  + Usuarios de demostración cargados.');
            
            console.log('\n🎉 ¡Base de datos semillada con éxito y completamente operativa online en Supabase!');

    } catch (err) {
        console.error('❌ ERROR CRÍTICO durante la inicialización de Supabase:', err.message || err);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Conexión cerrada con Supabase PostgreSQL.');
    }
}

main();
