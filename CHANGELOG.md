# Changelog

Todas las entradas siguen una categoría fija (`Added`, `Changed`, `Fixed`, `Removed`, `Maintenance`),
con el título en negrita, una descripción que se entiende sin abrir el código y la fecha al final.

## [Unreleased]

## [1.2.0] - 2026-10-16

- **Added**: **Modo costos (costo + margen)**. Segundo motor de cálculo que estima el costo interno del proyecto (personal por rol, costos variables, costos fijos de la empresa y ajustes) y calcula el precio de venta aplicando un margen de ganancia; incluye selector de modo en el formulario y persiste la elección. [2026-10-16]
  * **Files (Archivos)**: js/model.js, js/app.js, js/charts.js, index.html, styles.css. [2026-10-16]
- **Added**: **Equipo por rol en modo costos**. Tabla editable y ampliable donde cada fila define Rol, Cantidad, Costo mensual, Meses y Dedicación %, y calcula su subtotal automáticamente. [2026-10-16]
  * **Files (Archivos)**: js/app.js, js/model.js. [2026-10-16]
- **Added**: **Costos variables y fijos editables en modo costos**. Listas ampliables de conceptos y montos para costos variables del proyecto y costos fijos mensuales de la empresa, con selector de método de asignación (x meses, por % de dedicación o prorrateado entre N proyectos). [2026-10-16]
  * **Files (Archivos)**: js/app.js, js/model.js. [2026-10-16]
- **Added**: **Ajustes adicionales genéricos en modo costos**. Lista ampliable de factores (Concepto, tipo % o monto, valor y si aplica a costo o precio) para modelar pila tecnológica, urgencia o tipo de software sin hardcodearlos. [2026-10-16]
  * **Files (Archivos)**: js/app.js, js/model.js. [2026-10-16]
- **Added**: **KPIs, gráficos y traza del modo costos**. Tarjetas de Precio de Venta, Costo Total, Utilidad y Variable/Fijo; gráficos de composición del costo, composición del precio y Costo vs. Utilidad vs. Precio; y traza paso a paso del cálculo. [2026-10-16]
  * **Files (Archivos)**: js/app.js, js/charts.js. [2026-10-16]
- **Added**: **Documentación del proyecto**. Se agrega README.md con descripción, estructura, cómo ejecutar y el detalle de ambos modelos de cálculo. [2026-10-16]
  * **Files (Archivos)**: README.md. [2026-10-16]

## [1.1.0] - 2026-10-16

- **Added**: **Panel de parámetros del modelo editable**. Todas las constantes del modo tarifas (matriz de tarifas por región y perfil, horas base por complejidad, recargos por plataforma, factor de equipo, margen de contingencia y rango presupuestario) pasan a ser configurables desde un modal, con persistencia en localStorage, restauración de valores por defecto e importación/exportación en JSON. [2026-10-16]
  * **Files (Archivos)**: index.html, js/app.js, js/model.js, styles.css. [2026-10-16]
- **Added**: **Panel "Cómo se calculó"**. Traza paso a paso del cálculo (horas base, factor de equipo, tarifa ponderada, recargo por SO, extras, post-venta y margen) con los valores en vivo. [2026-10-16]
  * **Files (Archivos)**: js/app.js. [2026-10-16]
- **Added**: **Escenarios guardables y comparables**. Permite guardar configuraciones con nombre, recargarlas y compararlas en tabla y gráfico, persistidas en localStorage. [2026-10-16]
  * **Files (Archivos)**: js/app.js. [2026-10-16]
- **Added**: **Exportación a CSV e impresión a PDF**. Botón de exportación de la estimación a CSV y estilos de impresión para generar un PDF limpio del dashboard. [2026-10-16]
  * **Files (Archivos)**: js/app.js, styles.css. [2026-10-16]
- **Added**: **Interfaz bilingüe ES/EN**. Diccionario i18n completo con selector de idioma que re-traduce toda la interfaz y persiste la elección. [2026-10-16]
  * **Files (Archivos)**: js/i18n.js, js/app.js, index.html. [2026-10-16]
- **Changed**: **Desglose por fase en el gráfico circular**. El donut pasa de categorías agrupadas a mostrar Análisis, Diseño, Implementación, Pruebas/QA, Extras, Post-venta y Margen por separado. [2026-10-16]
  * **Files (Archivos)**: js/charts.js, js/app.js. [2026-10-16]
- **Changed**: **Código separado en archivos por responsabilidad**. La lógica se divide en js/i18n.js, js/model.js, js/charts.js y js/app.js manteniendo compatibilidad con la apertura directa del archivo (sin servidor). [2026-10-16]
  * **Files (Archivos)**: index.html, js/i18n.js, js/model.js, js/charts.js, js/app.js. [2026-10-16]
- **Added**: **Accesibilidad y validaciones**. Roles y ARIA en el selector de modo, los sliders y los modales, foco gestionado al abrir/cerrar, aria-live en el costo total y avisos en vivo cuando las fases no suman 100% o cuando faltan datos. [2026-10-16]
  * **Files (Archivos)**: index.html, js/app.js. [2026-10-16]
- **Fixed**: **Margen del Precio Fijo en el gráfico comparativo**. El margen de contingencia se calcula siempre para la comparativa, aunque el contrato activo sea Por Horas, evitando que ambas barras quedaran iguales. [2026-10-16]
  * **Files (Archivos)**: js/model.js. [2026-10-16]

## [1.0.0] - 2026-10-16

- **Added**: **Calculadora de costos de desarrollo de software (modo tarifas)**. Aplicación web estática de una sola página que estima presupuesto y horas a partir de la región del equipo, la composición por nivel (Junior/Mid/Senior), la complejidad del proyecto, la cobertura de sistemas operativos, las funciones adicionales, la distribución por fases y los servicios posteriores, con lógica de contrato a Precio Fijo o Por Horas. [2026-10-16]
  * **Files (Archivos)**: index.html, styles.css, app.js. [2026-10-16]
- **Added**: **Dashboard con KPIs y gráficos**. Tarjetas de costo total, horas, rango presupuestario y tarifa promedio, más gráfico circular por categoría, barras por región y barras por tipo de contrato, con cálculo dinámico al modificar cualquier campo. [2026-10-16]
  * **Files (Archivos)**: index.html, app.js. [2026-10-16]
