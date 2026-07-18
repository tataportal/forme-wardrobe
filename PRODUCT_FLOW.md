# Formé — Flujo de producto, aplicación y funciones

## Qué es Formé

Formé es un closet digital y asistente personal de styling. Permite:

- Digitalizar prendas reales.
- Convertir fotos caseras en imágenes limpias de catálogo.
- Organizar el closet con información útil.
- Combinar prendas libremente en un canvas.
- Guardar y duplicar looks.
- Generar variaciones manteniendo piezas elegidas.
- Recibir recomendaciones según contexto y preferencias.
- Planificar qué usar durante la semana.
- Detectar qué prendas se usan, cuáles se repiten y qué falta.

La aplicación tiene dos zonas principales:

1. **Closet:** administrar prendas, looks, perfil y recomendaciones.
2. **Canvas:** construir y editar outfits visualmente.

## Flujo general

**Demo → Login → Perfil → Calibración → Digitalizar closet → Organizar prendas → Crear looks → Recibir recomendaciones → Planificar semana → Aprender del uso**

## 1. Entrada directa al closet demo

No existe una landing intermedia.

La persona entra directamente a un closet de prueba con:

- Básicos Formé.
- Prendas, calzado y accesorios compartidos.
- Looks de demostración.
- Acceso al Canvas.
- Posibilidad de probar el Asistente.

Puede jugar sin registrarse. Cuando intenta subir prendas propias, guardar información personal o construir su closet permanente, aparece:

**Continuar con Google**

## 2. Login y creación de perfil

Después de iniciar sesión se crea su espacio privado.

El perfil contiene progresivamente:

- Nombre.
- Foto de perfil.
- Ubicación y clima habitual.
- Tallas de tops, pantalones y calzado.
- Altura y peso opcionales.
- Medidas exactas opcionales.
- Foto de cuerpo entero opcional.
- Foto del rostro opcional.
- Nivel de cobertura preferido.
- Prendas que evita.
- Calzado que evita.
- Ajustes que evita: ceñido, oversized, escotes y prendas cortas.
- Expresión visual que desea recibir: masculina, femenina o mixta.
- Apertura experimental.

Las fotos y medidas describen proporciones. No califican el cuerpo ni determinan qué debería usar.

## 3. Calibración visual de estilo

La persona realiza un test con las 12 familias:

1. Clásico.
2. Minimalista.
3. Relajado.
4. Sastrero.
5. Preppy.
6. Streetwear.
7. Deportivo.
8. Utilitario.
9. Romántico.
10. Bohemio.
11. Rebelde.
12. Vanguardista.

Las cards aparecen en 9:16 usando la expresión seleccionada.

Cada card puede recibir:

- Afinidad de 0 a 100.
- No es mi estilo.
- Quiero una variación.
- Nunca recomendar algo así.

Cuando rechaza una card, puede indicar qué falló:

- Color.
- Silueta.
- Combinación.
- Formalidad.
- Expresión.
- Ajuste.
- Calzado.
- Prenda específica.

El resultado no es una etiqueta única. Se genera un perfil porcentual:

- Minimalista: 84%.
- Sastrero: 72%.
- Rebelde: 63%.
- Streetwear: 51%.
- Romántico: 18%.
- Experimentación: 34%.

Luego se muestran combinaciones como Minimalista + Rebelde, Sastrero + Streetwear y Preppy + Dark Academia.

La calibración puede repetirse periódicamente para corregir cómo evoluciona el gusto.

## 4. Mi closet

Dentro de Closet existen solamente tres tabs:

- **Mi closet**
- **Looks guardados**
- **Asistente**

### Mis prendas

Es la colección privada del usuario. Incluye:

- Contador de prendas.
- Favoritos.
- Estado de procesamiento.
- Botón Agregar.
- Acceso a la ficha de cada prenda.
- Botón para añadir directamente al Canvas.

### Básicos Formé

Aparecen después de las prendas personales como una biblioteca compartida.

Sirven para:

- Probar el producto antes de subir fotos.
- Completar provisionalmente un outfit.
- Crear combinaciones con básicos transversales.
- Diferenciar claramente qué pertenece al usuario y qué pertenece a Formé.

No son un tab independiente.

## 5. Agregar prendas

El botón **Agregar** vive dentro de Mi closet.

La carga permite:

- Drag and drop.
- Selección desde móvil.
- Carga múltiple.
- Hasta 15 prendas por lote.
- Hasta 20 MB por imagen.
- Vista previa de todas las fotos.
- Corrección del nombre.
- Selección básica del tipo de prenda.
- Eliminar imágenes antes de comenzar.

La persona no necesita completar una ficha técnica durante la carga.

## 6. Procesamiento de imagen

Cada prenda pasa por este flujo:

1. Se guarda la foto original.
2. Se genera una imagen frontal de catálogo.
3. Se conserva forma, color, material, gráficos y detalles exteriores.
4. Se eliminan habitación, persona, hanger, barras y soportes.
5. Se genera el ghost mannequin.
6. Cloudflare recorta el fondo.
7. Se guarda un WebP con transparencia.
8. Se revisa automáticamente el borde.
9. La prenda aparece en Mi closet.

Configuración recomendada:

- **Low** como calidad predeterminada.
- **Batch Low** para lotes sin urgencia.
- **Medium** únicamente para reprocesar una prenda problemática.
- **High** descartado por costo y falta de mejora consistente.

Para outerwear:

- Se conserva la versión cerrada.
- Se crea una versión abierta.
- No deben aparecer etiquetas interiores.
- Abrir la prenda no puede borrar estampados, parches ni cierres.

Los estados visibles son:

- Subiendo.
- En cola.
- Procesando.
- Terminando borde.
- Lista.
- Necesita revisión.

## 7. Ficha de prenda

Al abrir una card se muestra una ficha editable.

Campos:

- Nombre.
- Marca.
- Tipo.
- Color.
- Tono.
- Material.
- Acabado.
- Silueta.
- Tags personalizados.
- Favorito.

Acciones:

- Guardar cambios.
- Añadir al Canvas.
- Eliminar.
- Reprocesar.
- Rehacer en Medium.
- Crear versión abierta.
- Rehacer versión abierta en Medium.

La ficha también conserva:

- Foto original.
- Imagen generada.
- Cutout final.
- Calidad utilizada.
- Estado de borde.
- Notas de procesamiento.

## 8. Filtros del closet

Los filtros permanecen cerrados hasta que la persona los abre.

Permiten filtrar por:

- Categoría.
- Color.
- Tono.
- Material.
- Acabado.
- Silueta.
- Favoritos.
- Tags personalizados.

En móvil aparecen como panel temporal. En desktop funcionan como panel lateral retráctil.

## 9. Canvas

El Canvas es un espacio fullscreen con fondo greige.

Estructura:

- Panel izquierdo retráctil: prendas y categorías.
- Área central: composición del outfit.
- Panel derecho retráctil: looks guardados.
- Barra inferior: Guardar, Duplicar y Mezclar.

### Gestos

- Arrastrar para mover.
- Dos dedos para escalar.
- Dos dedos para rotar.
- Mantener presionado para alternar abierto y cerrado.
- Segundo tap sobre una prenda seleccionada para eliminarla.
- Tap sobre una prenda existente para traerla al frente.

La escala inicial depende de la categoría:

- Tops y outerwear aparecen arriba.
- Bottoms aparecen desde la mitad.
- Calzado aparece al fondo.
- Accesorios usan ubicaciones específicas.
- Cada tipo tiene tamaño inicial proporcional.

## 10. Guardar, duplicar y mezclar

### Guardar

Guarda el estado exacto del Canvas:

- Prendas.
- Posición.
- Escala.
- Rotación.
- Orden de capas.
- Variante abierta y cerrada.

Si se abrió un look existente, Guardar actualiza ese look.

### Duplicar

Crea un look nuevo con el estado actual.

Es la acción correcta para continuar editando sin reemplazar el original.

### Mezclar

Requiere como mínimo:

- Un top.
- Un bottom.

Mantiene esas piezas fijas y produce cinco variaciones cambiando:

- Outerwear.
- Calzado.
- Accesorios.

Las cinco direcciones son:

- Limpio.
- Contraste.
- Statement.
- Pulido.
- Relajado.

Cada variante puede abrirse en el Canvas, editarse y guardarse como un look nuevo.

## 11. Looks guardados

Cada look se presenta como una card visual que respeta exactamente la composición del Canvas.

Funciones:

- Abrir en Canvas.
- Continuar editando.
- Duplicar.
- Eliminar.
- Asignar a un día.
- Usar como referencia para recomendaciones.

El sistema debe distinguir claramente:

- Guardar cambios en el look actual.
- Crear una copia nueva.
- Guardar una recomendación como look.

## 12. Asistente

El Asistente tiene cuatro bloques.

### Recomendaciones

La persona indica:

- Plan: diario, trabajo, cena y evento.
- Dress code: casual, smart, formal y experimental.
- Momento: día y noche.

Recibe cinco looks distintos en cards grandes.

Cada recomendación explica:

- Qué piezas utiliza.
- Por qué combinan.
- Qué proporción está construyendo.
- Qué elemento funciona como base.
- Qué elemento aporta contraste.
- Qué ocasión resuelve.

Acciones:

- Guardar como look.
- Abrir en Canvas.
- Me gusta.
- No es mi estilo.
- Variar.
- Explicar rechazo.

El sistema debe evitar:

- Repetir looks guardados.
- Repetir combinaciones ya vistas.
- Usar constantemente las mismas tres prendas.
- Añadir accesorios sin función.
- Recomendar piezas bloqueadas.

### Análisis del closet

Muestra:

- Cantidad de prendas.
- Categorías cubiertas.
- Colores dominantes.
- Tonos.
- Materiales.
- Acabados.
- Siluetas.
- Piezas más versátiles.
- Prendas poco utilizadas.
- Capacidad real de crear outfits.
- Repetición de combinaciones.

### Qué falta

Detecta huecos funcionales:

- Categorías ausentes.
- Calzado que desbloquearía más looks.
- Colores puente.
- Capas necesarias para el clima.
- Piezas que ampliarían las familias preferidas.

No debe recomendar compras solamente porque una categoría tiene pocas prendas. Debe calcular cuántas combinaciones nuevas desbloquea cada incorporación.

Este bloque abre posteriormente la conexión con marketplace.

### Plan semanal

Permite:

- Ver los siete días.
- Asignar un look guardado.
- Definir ocasión.
- Abrir el look en Canvas.
- Marcarlo como usado.
- Quitar un look del día.
- Completar automáticamente la semana.

Más adelante debe incorporar clima, calendario y nivel de formalidad de cada evento.

## 13. Aprendizaje continuo

Formé aprende de:

- Test inicial.
- Likes y rechazos.
- Motivos de rechazo.
- Looks guardados.
- Looks eliminados.
- Prendas añadidas al Canvas.
- Prendas retiradas.
- Frecuencia de uso.
- Variaciones aceptadas.
- Nivel de experimentación.
- Restricciones explícitas.

Las recomendaciones se calculan considerando:

- Compatibilidad de capas.
- Color.
- Material.
- Volumen.
- Silueta.
- Contexto.
- Clima.
- Preferencias.
- Historial.
- Novedad.
- Repetición.
- Bloqueos absolutos.

## Estado real actual

Ya existe en la base:

- Demo sin login.
- Login y sesión.
- Base de datos por usuario.
- Almacenamiento de imágenes.
- Carga múltiple de 15 prendas.
- Procesamiento Low, Medium y Batch Low.
- Recorte automático.
- Versiones abiertas.
- Ficha editable.
- Filtros.
- Canvas táctil.
- Guardar, duplicar y mezclar.
- Looks guardados.
- Cinco recomendaciones.
- Insights básicos.
- Plan semanal.

Todavía falta convertir en producto real:

- Integrar las 24 cards definitivas de las 12 familias.
- Guardar la calibración en la cuenta.
- Perfil corporal y preferencias.
- Análisis visual profundo de cada prenda.
- Recomendador personalizado más allá de reglas.
- Qué falta basado en combinaciones reales.
- Clima y calendario.
- Seguimiento histórico de uso.
- Marketplace.

Actualmente el recomendador es principalmente un sistema local de reglas basado en metadatos de las prendas. Todavía no existe un estilista de IA que analice profundamente el closet completo y aprenda permanentemente de las respuestas.
