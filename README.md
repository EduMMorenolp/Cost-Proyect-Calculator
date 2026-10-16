# Calculadora de Costos de Desarrollo de Software

Aplicación web estática (HTML + CSS + JavaScript, sin build) que estima el costo y el precio de
venta de un proyecto de software y los visualiza en un dashboard con gráficos. Incluye **dos
modelos de cálculo**:

- **Modo tarifas (mercado):** estima el presupuesto a partir de horas y tarifas por hora según la
  región y el nivel del equipo.
- **Modo costos (costo + margen):** estima el costo interno (sueldos del equipo, costos variables
  del proyecto y costos fijos de la empresa) y calcula el **precio de venta** aplicando un margen
  de ganancia.

Todo el modelo es configurable y el resultado se recalcula en vivo. La interfaz es **bilingüe
(Español / English)**.

## Cómo ejecutarlo

No requiere instalación ni build:

1. Cloná o descargá el repositorio.
2. Abrí `index.html` en el navegador (doble clic o "Abrir con").

Tailwind CSS y Chart.js se cargan por CDN, así que el navegador necesita conexión a internet la
primera vez. Para publicarlo, subí los archivos a **GitHub Pages, Vercel o Netlify** (despliegue
estático).

## Estructura

```
.
├── index.html      Estructura del formulario, dashboard y modales
├── styles.css      Estilos propios (complementan Tailwind)
├── js/
│   ├── i18n.js     Diccionario de textos ES/EN
│   ├── model.js    Parámetros, estado, cálculo y persistencia
│   ├── charts.js   Gráficos con Chart.js (ambos modos)
│   └── app.js      UI, eventos, render de KPIs/gráficos/traza
├── CHANGELOG.md
└── README.md
```

Los scripts se cargan como archivos planos (no módulos ES) para que la app funcione abriendo
`index.html` directamente, sin servidor.

## Modo tarifas (mercado)

```
Horas totales   = horasBase(complejidad) × factorEquipo
factorEquipo    = 1 + (devs − 1) × teamStep%         (tope teamCap%)
Tarifa          = promedio ponderado por perfil sobre la matriz de tarifas de la región
Desarrollo      = horasTotales × tarifa × recargoSO
recargoSO       = 1 + (plataformas − 1) × soStep%    (tope soCap%)
Costo variable  = desarrollo + extras(+ post-venta)
Margen (fijo)   = (desarrollo + extras) × margenContingencia%
Total           = desarrollo + extras + post-venta + margen
```

Salidas: KPIs de costo total, horas, rango presupuestario y tarifa promedio; donut por fase y
categoría; barras por región y por tipo de contrato; y traza paso a paso.

## Modo costos (costo + margen)

```
Personal        = Σ (cantidad × costo mensual × meses × dedicación%)
Costo variable  = personal + costos variables del proyecto
Fijos           = Σ costos fijos mensuales
Fijos asignados = fijos × meses           (método "× meses")
                = fijos × meses × %dedic  (método "por % de dedicación")
                = fijos × meses ÷ N       (método "prorrateado entre N proyectos")
Costo total     = costo variable + fijos asignados + ajustes de costo
Utilidad        = costo total × margenGanancia%
Precio de venta = costo total + utilidad + ajustes de precio
```

Salidas: KPIs de precio de venta, costo total, utilidad ($ y %) y variable/fijo; donut de
composición del costo y del precio; barras de costo vs. utilidad vs. precio; y traza paso a paso.

## Parámetros configurables

Desde el botón **Parámetros** se edita todo el modelo del modo tarifas: matriz de tarifas por
región y perfil, horas base por complejidad, recargos por plataforma, factor de equipo, margen de
contingencia y rango presupuestario. En el **modo costos**, cada fila (roles, costos y ajustes) es
editable y ampliable.

- Persistencia automática en `localStorage`.
- **Restaurar valores** por defecto.
- **Importar / Exportar JSON** para compartir configuraciones.

## Escenarios, exportación e idioma

- **Escenarios:** guardá configuraciones con nombre, recargalas y comparalas en tabla y gráfico.
- **Exportar CSV:** descarga el desglose del presupuesto.
- **Imprimir / PDF:** estilos de impresión para generar un PDF limpio del dashboard.
- **Idioma:** selector ES/EN que re-traduce toda la interfaz.

## Ejemplo de referencia

Con el **modo costos** precargado (2 desarrolladores de $2.500/mes, 1 analista de $3.000/mes,
1 tester de $1.000/mes durante 4 meses; hosting $1.000; reuniones $500; costos fijos de $4.000/mes
y margen del 25%) el resultado es:

| Concepto | Monto |
|---|---|
| Personal | $36.000 |
| Costos variables del proyecto | $1.500 |
| Costos fijos asignados (4 meses) | $16.000 |
| **Costo total** | **$53.500** |
| Utilidad (25%) | $13.375 |
| **Precio de venta** | **$66.875** |

## Tecnologías

- HTML5 + CSS3 (Tailwind CSS por CDN)
- JavaScript (Vanilla)
- Chart.js (por CDN)
