# 👑 BELIA CRM - Sistema de Stock y Ventas de Cuero

Bienvenido al **BELIA CRM**, un sistema web premium diseñado específicamente para la gestión de inventario, carga masiva, facturación rápida (Punto de Venta) y seguimiento de clientes VIP de prendas de cuero de alta gama.

El sistema posee una estética de alta costura inspirada en la marca **BELIA** (colores obsidiana profunda, acentos dorados y texturas de cuero satinado) y está integrado de manera fluida y flexible con la nube de **Supabase**.

---

## ✨ Características Principales

1. **Dashboard Financiero y Alertas**:
   - Resumen visual en tiempo real de ingresos totales, volumen de stock y prendas vendidas.
   - Gráfico de rendimiento de ventas acumuladas por día de la semana.
   - Listado de actividad reciente de facturación y alertas automáticas de prendas en stock crítico (menos de 3 unidades).

2. **Gestión de Stock Avanzada**:
   - **Carga Unitaria**: Formulario elegante para agregar prendas indicando talle, color, costo, precio de venta, imágenes de alta definición y detalles de estilo.
   - **Carga Masiva (CSV)**: Importador inteligente por arrastrar y soltar. Posee un analizador CSV que renderiza una **tabla de previsualización interactiva**, permitiendo corregir errores de tipeo y stock directamente desde la grilla antes de guardarlos.

3. **Punto de Venta (POS)**:
   - Carrito interactivo y dinámico con selección rápida de variantes de talle/color según la existencia en tiempo real.
   - Registro veloz y asignación de clientes VIP en el momento de la compra.
   - Descuento de stock automatizado.
   - **Ticket Digital Imprimible**: Generación de recibo elegante imitando impresora térmica con opción de guardado PDF o impresión física con un clic.

4. **Base de Datos CRM**:
   - Mapeo de clientes con notas sobre sus talles preferidos, volúmenes acumulados de gasto y visitas registradas.

5. **Modo Demo Activo (Cero Fricción)**:
   - Si no posees credenciales de base de datos activas, el sistema funciona de inmediato de forma 100% interactiva en **Modo Demo**, guardando la información en el almacenamiento local de tu navegador (`localStorage`) para que puedas probar el flujo completo sin configurar nada.

---

## 🛠️ Configuración con Supabase

Para pasar del Modo Demo al almacenamiento seguro en la nube con Supabase, sigue estos sencillos pasos:

### 1. Crear tu Base de Datos en Supabase
1. Ingresa a [Supabase](https://supabase.com/) y crea un nuevo proyecto gratuito.
2. Una vez creado el proyecto, ve a la pestaña **SQL Editor** en el menú izquierdo de Supabase.
3. Haz clic en **New Query** (Nueva Consulta).
4. Copia el script SQL de inicialización que el sistema te proporciona en la sección de **Configuración** dentro de la app (o encuéntralo en el archivo `supabase-client.js` bajo `SUPABASE_SQL_SETUP`).
5. Pega el script en el editor de Supabase y haz clic en **Run** (Ejecutar). Esto creará instantáneamente las 5 tablas relacionales con sus políticas de seguridad (RLS) necesarias.

### 2. Conectar la Aplicación
1. Ve a **Project Settings** > **API** en Supabase para obtener tu:
   - `Project API URL`
   - `Project API anon key`
2. Abre la aplicación **BELIA CRM** en tu navegador.
3. Dirígete a la sección de **Configuración** desde la barra lateral.
4. Introduce tus claves en el formulario y presiona **Conectar e Inicializar DB**.
5. ¡Listo! El indicador cambiará a **Conectado Supabase** (Verde) y todos los datos comenzarán a sincronizarse en la nube en tiempo real.

---

## 🚀 Cómo Ejecutar el Proyecto Localmente

El proyecto está diseñado como una aplicación web de una sola página (SPA) moderna basada en módulos ES6. No requiere herramientas de compilación complejas (como Webpack o Vite), lo que garantiza que no habrá errores de dependencias de node.

Para correrlo de manera óptima respetando los módulos de Javascript, **debe ser ejecutado bajo un servidor local**:

### Opción 1: Extensión "Live Server" en VS Code (Recomendado)
Si usas Visual Studio Code:
1. Instala la extensión **Live Server** de *Ritwick Dey*.
2. Haz clic derecho en el archivo `index.html` y selecciona **Open with Live Server**.
3. El proyecto se abrirá en tu navegador de inmediato en `http://127.0.0.1:5500/`.

### Opción 2: Usar Node.js (Python u otros) en Terminal
Si tienes Node instalado, puedes levantar un servidor ultrarrápido:
```bash
# Con npm (npx http-server)
npx http-server ./

# O con Python si lo prefieres
python -m http.server 8000
```
Luego abre en tu navegador: `http://localhost:8080` (o el puerto que indique tu consola).

---

## 📁 Estructura de Archivos

- `index.html`: Estructura semántica, sidebar de navegación y vistas de la SPA.
- `styles.css`: Estilos de lujo con diseño adaptativo, glassmorphism y colores de la marca.
- `app.js`: Controlador maestro e inicialización de enrutamientos del sistema.
- `supabase-client.js`: Capa de datos con conector dinámico a Supabase y Modo Demo.
- `sales-pos.js`: Motor del Punto de Venta, lógica de carrito de compras y ticket digital.
- `bulk-uploader.js`: Analizador de CSV con grilla interactiva y arrastrar/soltar.
- `LOGO.jpeg`: Logotipo de la marca integrado a la interfaz.
