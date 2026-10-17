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

Tailwind CSS, Chart.js y ExcelJS se cargan por CDN, así que el navegador necesita conexión a
internet la primera vez. Para publicarlo, subí los archivos a **GitHub Pages, Vercel o Netlify**
(despliegue estático).

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

## Métodos de estimación de esfuerzo

En el **modo tarifas** el esfuerzo (horas) se estima con el método que elijas:

- **Complejidad clásica:** horas base por complejidad (pequeño / mediano / grande).
- **Por catálogo:** arquetipo base + funcionalidades seleccionadas, con factor no lineal acumulado.
- **COCOMO básico:** `PM = a × KLOC^b × EAF`, con modo orgánico/semiacoplado/empotrado y 6
  conductores de costo.
- **Puntos de función:** `AFP = UFP × (0.65 + 0.01 × ΣGSC)` convertidos a horas.
- **Puntos de historia:** puntos ÷ velocidad × horas por sprint.
- **Horas manuales:** carga directa.

En el **modo costos** el equipo se define por roles con cantidad, costo mensual (o por hora) y
meses de dedicación.

## Riesgo, cronograma y TCO

- **Estimación de 3 puntos (PERT):** optimista / realista / pesimista → valor esperado
  `(O + 4R + P) / 6` y rango mínimo-máximo.
- **Buffer de riesgo:** porcentaje por nivel (sin buffer / bajo / medio / alto).
- **Cronograma:** duración a partir del esfuerzo y el tamaño del equipo, con hitos por fase.
- **TCO:** mantenimiento anual, hosting y APIs → costo operativo anual y costo total a N años.
- **Engagement:** staff augmentation / equipo dedicado / outsourcing con overhead configurable.

## Parámetros configurables

Desde el botón **Parámetros** se edita todo el modelo del modo tarifas: matriz de tarifas por
región y perfil, horas base por complejidad, recargos por plataforma, factor de equipo, margen de
contingencia y rango presupuestario. En el **modo costos**, cada fila (roles, costos y ajustes) es
editable y ampliable.

- Persistencia automática en `localStorage`.
- **Restaurar valores** por defecto.
- **Importar / Exportar JSON** para compartir configuraciones.

## Gráficos, escenarios, reportes e idioma

- **Bloque de gráficos navegable:** siempre tres gráficos por conjunto, con flechas laterales y
  puntos indicadores para alternar entre **Composición**, **Detalle / Equipo** y **Previsión**
  (según el modo).
- **Escenarios:** guardá configuraciones con nombre y fecha, recargalas y comparalas en tabla
  (con la diferencia **Δ** contra la versión anterior) y en gráfico; podés **imprimir/PDF** toda la
  comparación.
- **Reporte / Propuesta:** genera una propuesta imprimible (marca, fecha, precio, desglose y TCO).
- **Exportar Excel:** libro `.xlsx` con hojas (Resumen, Desglose, Fases/Roles, Equipo, Escenarios,
  Supuestos), estilos, formato de moneda y los gráficos embebidos. Fallback a CSV si la librería no
  está disponible.
- **Exportar CSV:** desglose del presupuesto con título y fecha.
- **Imprimir / PDF:** estilos de impresión para generar un PDF limpio del dashboard.
- **Compartir:** copia una URL con el estado y los parámetros; al abrirla se restaura esa config.
- **Idioma:** selector ES/EN que re-traduce toda la interfaz.

## Bloques del formulario

Desde el botón **Bloques** se abre un modal central para gestionar las secciones del formulario del
modo activo. Cada bloque puede quedar en uno de tres estados:

- **Visible:** se muestra y cuenta normalmente (valor por defecto).
- **Oculto:** se esconde la sección, pero sus valores **siguen contando** en el cálculo.
- **Quitar:** solo disponible en bloques de monto; la sección se excluye por completo del resultado
  (por ejemplo, sin *Roles* el personal deja de sumar). Los bloques de configuración solo pueden
  ocultarse.

Al quitar bloques, el panel muestra un aviso con los nombres excluidos y la exportación a Excel deja
de generar las hojas correspondientes. El estado de los bloques se guarda junto con el resto de la
configuración.

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
- ExcelJS (por CDN, exportación a Excel)
