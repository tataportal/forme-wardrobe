# Formé® — Calibración de estilo V2

## Decisión de producto

La calibración no debe intentar decirle a una persona “qué estilo es”. Debe producir información útil para ordenar y filtrar recomendaciones:

1. qué looks usaría;
2. qué elementos de esos looks acepta o rechaza;
3. qué códigos de presentación quiere ver;
4. qué límites no deben romperse;
5. cuánto quiere experimentar;
6. en qué situaciones necesita vestirse.

El resultado es un punto de partida editable, no una identidad permanente.

---

## Qué está mal en el flujo actual

- Mostrar “Clásico”, “Preppy” o “Romántico” antes de responder introduce sesgo por la etiqueta.
- Una sola imagen no representa una dirección completa. La persona puede estar rechazando un color, un zapato o una prenda concreta.
- “Hombre / Mujer” mezcla identidad personal con el tipo de prendas que se quiere evaluar.
- Empezar todos los sliders en 50% convierte preguntas sin responder en afinidad media.
- “No recomendar” elimina una familia completa cuando el problema puede ser un solo elemento.
- Un porcentaje como “82% clásico” comunica una precisión que el test no tiene.
- No se separan límites absolutos de preferencias suaves.
- No se pregunta por la vida real antes de producir recomendaciones.

---

## Arquitectura final

La calibración tiene cinco momentos:

1. **Punto de partida** — escoger qué códigos de ropa evaluar.
2. **Primera lectura** — reaccionar a doce looks sin ver sus etiquetas.
3. **Confirmación** — validar los resultados extremos con nuevas imágenes.
4. **Límites y contexto** — indicar qué evitar y para qué se viste la persona.
5. **Resultado** — explicar qué entendió Formé y permitir editarlo.

Tiempo objetivo: **3–4 minutos**.

La persona ve 18 looks como máximo: doce iniciales y seis de confirmación.

---

## 0. Entrada

### Pantalla

**Título**

Vamos a encontrar tu punto de partida.

**Texto**

Verás looks completos. Responde pensando en lo que realmente usarías, no solo en lo que te parece bonito.

**Apoyo**

Toma menos de cuatro minutos. Puedes cambiarlo después.

**Acciones**

- Empezar
- Hacerlo después

### Regla

“Hacerlo después” no puede bloquear el closet, el canvas ni el asistente. Las recomendaciones deben indicar que todavía tienen poca información.

---

## 1. Código de presentación

### Pantalla

**Pregunta**

¿Qué tipo de prendas quieres evaluar?

**Texto**

Esto define las imágenes del test. No limita lo que puedes guardar o usar en tu closet.

**Opciones**

- Mayormente masculinas
- Mayormente femeninas
- Ambas

No se pregunta género.

### Cruce por categoría

Si la persona elige “Mayormente masculinas” o “Mayormente femeninas”, se muestra una sola pregunta adicional:

**Pregunta**

¿Hay categorías donde también usas el otro código?

**Opciones múltiples**

- Abrigos y chaquetas
- Tops
- Bottoms
- Calzado
- Ninguna

Esto permite casos como “mayormente masculino, pero también uso abrigos femeninos” sin abrir todas las recomendaciones femeninas.

### Uso del dato

- Define el deck visual de la calibración.
- Ajusta el ranking inicial de prendas.
- Nunca funciona como exclusión absoluta.
- Las restricciones reales se registran más adelante.

---

## 2. Primera lectura

### Qué ve la persona

- Un look completo.
- Progreso: `03 / 12`.
- La pregunta.
- Cinco respuestas visibles.
- Volver.

No se muestra:

- nombre de la familia;
- descripción del estilo;
- porcentaje;
- tags;
- explicación del algoritmo;
- botón “No recomendar”.

### Pregunta

¿Te vestirías así?

### Escala

| Respuesta | Valor interno |
| --- | ---: |
| Nunca | -2 |
| Probablemente no | -1 |
| Tal vez | 0 |
| Sí | 1 |
| Tal cual | 2 |

Opción secundaria: **No estoy seguro**. No suma ni resta.

No se usa un slider de 0 a 100. La precisión debe venir de la repetición y la consistencia, no de pedirle a la persona que invente un número.

### Seguimiento ante rechazo

Si responde “Nunca” o “Probablemente no”:

**Pregunta**

¿Qué no te funciona?

**Selección múltiple**

- Color
- Silueta
- Proporción
- Capa superior
- Top
- Bottom
- Calzado
- Formalidad
- La combinación completa

La respuesta se guarda sin obligar a seleccionar un motivo.

### Comportamiento

- La tarjeta avanza después de responder.
- Volver conserva la respuesta.
- El progreso se guarda automáticamente.
- El orden de las doce familias se aleatoriza por sesión.
- No puede haber una opción preseleccionada.

---

## 3. Confirmación

Una sola imagen puede producir una lectura falsa. Formé debe confirmar los resultados más fuertes.

### Selección automática

Después de las doce respuestas iniciales se eligen:

- las tres direcciones con mayor afinidad;
- las tres direcciones con mayor rechazo.

Se muestra una **segunda variante visual** de cada una: seis looks adicionales.

### Pantalla

Se mantiene exactamente la misma pregunta:

¿Te vestirías así?

No se anuncia que es una validación ni se revela la familia.

### Interpretación

- Si ambas variantes reciben respuestas próximas, la señal es confiable.
- Si difieren dos o más niveles, la familia queda como incierta.
- Cuando existe una contradicción, los motivos específicos pesan más que la etiqueta general.
- Una familia incierta no debe aparecer como una conclusión fuerte.

Ejemplo:

La persona responde “Tal cual” a un look utilitario y “Nunca” a su segunda variante porque rechaza el calzado. Formé aprende afinidad con la construcción utilitaria y rechazo por ese tipo de bota; no elimina Utilitario.

---

## 4. Límites

### Pantalla

**Pregunta**

¿Hay algo que Formé no deba recomendarte?

**Texto**

Separa lo que nunca usarías de lo que simplemente quieres ver menos.

### Dos niveles

**Evitar siempre**

Excluye el elemento de las recomendaciones.

**Mostrar menos**

Reduce su prioridad, pero permite que aparezca cuando el contexto lo justifique.

### Opciones iniciales

- Tacones
- Escotes pronunciados
- Prendas muy ceñidas
- Prendas muy cortas
- Transparencias
- Colores intensos
- Logos o gráficos grandes
- Looks muy formales
- Looks muy deportivos
- Otro

### Regla

Los límites nunca reducen el puntaje de una familia de estilo. Se aplican como filtros sobre prendas y looks.

---

## 5. Vida real

### Pregunta 1

¿Para qué te vistes más seguido?

**Selección múltiple**

- Día a día
- Trabajo
- Estudio
- Cenas y salidas
- Eventos
- Viajes

### Pregunta 2

¿Qué quieres resolver primero?

**Selección única**

- Vestirme más rápido
- Usar más lo que ya tengo
- Encontrar nuevas combinaciones
- Planear mi semana
- Entender qué falta de verdad

La respuesta define la primera acción sugerida al entrar al producto.

---

## 6. Exploración

### Pantalla

**Pregunta**

¿Hasta dónde quieres que te lleve Formé?

**Texto**

Podemos quedarnos cerca de lo que ya haces o probar combinaciones menos familiares.

### Control

Un control continuo, sin porcentaje visible:

- Cerca de lo conocido
- Un poco más
- Quiero explorar

El valor interno puede guardarse en una escala de 0 a 100, pero la interfaz no necesita mostrar precisión numérica.

---

## 7. Resultado

### Título

Tu punto de partida.

### Texto

Esta lectura no te define. Ayuda a Formé a ordenar las primeras recomendaciones y seguirá cambiando con tus decisiones.

### Contenido

#### Dirección principal

El territorio con mayor afinidad y buena consistencia entre sus dos variantes.

#### Direcciones cercanas

Hasta dos territorios secundarios.

#### Formé priorizará

Resumen en lenguaje natural de los atributos aprendidos.

Ejemplo:

> Estructura limpia, pantalones amplios y capas con poco ornamento.

#### Formé evitará

Resumen de límites explícitos.

Ejemplo:

> Tacones y prendas muy ceñidas.

#### Margen de exploración

Una de tres expresiones:

- Cerca de lo conocido
- Abierto a variaciones
- Listo para explorar

### Acciones

- Entrar a mi closet
- Editar respuestas

No se muestran porcentajes de personalidad o compatibilidad.

---

## Sistema visual

### Desktop

Frame base: **1440 px**.

```text
┌──────────────────────────────────────────────────────────┐
│ FORMÉ®                                             03/12 │
│                                                          │
│                                   ¿Te vestirías así?      │
│       LOOK 1:1                    Nunca                   │
│       siempre visible             Probablemente no        │
│       70–72% del ancho            Tal vez                 │
│                                   Sí                      │
│                                   Tal cual                │
│                                                          │
│ ← Volver                                                │
└──────────────────────────────────────────────────────────┘
```

- Look: 70–72% del ancho.
- Control: 28–30%.
- Sin tarjeta, marco, sombra de contenedor ni descripción.
- La fotografía no se recorta.
- El look permanece completo y visible.
- El progreso es texto, no una barra decorativa.
- La respuesta seleccionada puede usar el rojo Formé como único acento.

### Mobile

```text
┌──────────────────────┐
│ FORMÉ®         03/12 │
│                      │
│                      │
│      LOOK 1:1        │
│                      │
│                      │
├──────────────────────┤
│ ¿Te vestirías así?   │
│ Nunca  ·  Tal vez    │
│ Sí  ·  Tal cual      │
│ ← Volver             │
└──────────────────────┘
```

- Imagen arriba, controles abajo.
- La imagen ocupa el máximo espacio disponible sin perder ninguna prenda.
- Los controles se mantienen visibles; no dependen de hover.
- No se utiliza carrusel horizontal para responder.

### Movimiento

- Transición breve entre looks: reemplazo horizontal de 180–220 ms.
- La dirección sigue el avance o retroceso.
- Sin parallax, loader, contador animado ni transición ornamental.
- `prefers-reduced-motion` elimina el desplazamiento y conserva un cambio de opacidad.

---

## Sistema de imágenes

### Cantidad real

Una calibración confiable necesita dos representaciones de cada estilo:

```text
12 estilos
× 2 variantes
× 2 códigos de presentación
= 48 imágenes
```

La persona no ve las 48. Ve un máximo de 18.

### Estructura

```text
masculino/
  classico-a
  classico-b
  ...
  vanguardista-a
  vanguardista-b

femenino/
  classico-a
  classico-b
  ...
  vanguardista-a
  vanguardista-b
```

### Variables controladas

Todas las imágenes deben compartir:

- relación 1:1;
- cámara cenital;
- fondo idéntico;
- iluminación idéntica;
- cuatro componentes: capa superior, top, bottom y calzado;
- prendas completas;
- escala equivalente;
- misma temporada;
- nivel de producción equivalente;
- ausencia de modelo, cuerpo, hanger, branding, texto y escenario.

### Variables que sí cambian

- silueta;
- proporción;
- material;
- construcción;
- nivel de ornamento;
- códigos de formalidad;
- color cuando sea parte real de la dirección.

### Regla de variantes

Las variantes A y B deben comunicar la misma dirección con prendas y paletas distintas.

Ejemplo:

- Utilitario A: field jacket, henley, cargo recto, bota.
- Utilitario B: overshirt técnico, knit fino, pantalón carpenter, sneaker trail.

Si ambas imágenes son casi el mismo look en otro color, no sirven como validación.

### Deck “Ambas”

No requiere un tercer lote.

- Primera lectura: seis imágenes masculinas y seis femeninas, equilibradas y aleatorizadas.
- Confirmación: la segunda variante usa el código opuesto cuando sea posible.
- Los resultados de estilo y presentación se guardan como señales separadas.

---

## Modelo de lectura

Cada imagen tiene:

- familia principal;
- variante;
- código de presentación;
- vector de atributos;
- piezas visibles;
- nivel de formalidad;
- intensidad de color.

### Atributos

- estructura;
- relajación;
- suavidad;
- volumen;
- ornamento;
- tradición;
- tecnicidad;
- utilidad;
- experimentación;
- intensidad cromática.

### Cálculo

1. Convertir la respuesta visual a un valor de `-2` a `2`.
2. Actualizar familia y atributos presentes en la imagen.
3. Aplicar los motivos de rechazo únicamente al atributo o pieza correspondiente.
4. Comparar las variantes A y B.
5. Calcular confianza según consistencia.
6. Aplicar límites como filtros, nunca como penalizaciones de estilo.
7. Conservar la calibración inicial como baseline.
8. Añadir después una capa aprendida a partir de looks guardados, descartados y usados.

No se debe fabricar un porcentaje de exactitud para mostrar al usuario.

---

## Datos

```ts
type PresentationPreference = {
  primary: "masculine" | "feminine" | "both"
  crossCategories: Array<"outerwear" | "tops" | "bottoms" | "footwear">
}

type VisualResponse = {
  imageId: string
  family: StyleFamilyId
  variant: "a" | "b"
  presentation: "masculine" | "feminine"
  value: -2 | -1 | 0 | 1 | 2 | null
  reasons: StyleFeedbackReason[]
}

type StyleCalibrationV2 = {
  version: 2
  completed: boolean
  presentation: PresentationPreference
  responses: VisualResponse[]
  hardAvoids: string[]
  softAvoids: string[]
  contexts: string[]
  primaryGoal: string | null
  exploration: number
  result: {
    primaryFamily: StyleFamilyId | null
    secondaryFamilies: StyleFamilyId[]
    attributes: Record<string, number>
    confidence: Record<StyleFamilyId, "low" | "medium" | "high">
  }
}
```

---

## Estado del lote generado

Las doce imágenes generadas en `public/style-calibration/v1` no son el test final.

- Son un borrador de dirección visual.
- El lote es predominantemente masculino.
- Romántico no coincide con el código de presentación del resto.
- Solo existe una variante por estilo.
- No debe integrarse en el onboarding hasta completar y auditar la matriz de 48 imágenes.

No se generan más imágenes hasta aprobar primero la matriz A/B de ambos códigos.

