# Textos legales de Formé — Perú

Estado: preparado para publicar con Formé como identidad visible del servicio, Perú como país de operación y @tataportal como canal público de contacto. No se expone una persona física ni el correo privado del administrador.

## Pendiente para cerrar esta entrega

1. Aplicar `0017_legal_acceptances.sql` antes del deploy. Los registros anteriores no se marcan como aceptados: el usuario debe hacer una acción explícita.
2. Publicar una sola vez y verificar rutas públicas, enlace desde Ajustes, entrada de cuenta y consentimiento con una cuenta de prueba. Nunca aceptar las condiciones en nombre del dueño real para probar.
3. Revisar/invalidate el caché de imágenes públicas que se haya generado con el encabezado anterior (hasta un día y siete días stale). El nuevo encabezado no revoca copias que ya están en navegadores o intermediarios.

## Funcionamiento implementado

- GET `/auth/google/start` lleva al formulario; POST requiere dos casillas, versión vigente y origen propio.
- La aceptación viaja en un estado OAuth firmado, con caducidad, y luego en la sesión firmada. Google se consulta solo después de aceptar.
- Una sesión existente puede aceptar sin volver a iniciar sesión con Google.
- El servidor registra cuenta, versión y fecha, de forma idempotente, en `user_legal_acceptances`. No se guarda una IP adicional para esta finalidad.
- Las cuentas de producción sin aceptación no acceden a las API de la cuenta; reciben 428 y el cliente abre `/ingresar`. El preview local no registra aceptaciones ficticias.
- La política describe la publicación de prendas que forman parte de un look público, la propiedad del contenido y la licencia de procesamiento limitada a las funciones solicitadas.
- No se automatizó la reasignación de @usuarios ni se cambió ninguno. La cláusula establece la facultad, motivos y contacto; cada aplicación requiere una decisión operativa de Formé.

## Aspectos operativos que los textos no resuelven por sí solos

- Verificar/inscribir los bancos de datos personales y los flujos internacionales que correspondan ante la ANPD. No hay evidencia en el repo de una inscripción. Los nombres descriptivos propuestos deben reconciliarse con los registros reales.
- Confirmar contratos y garantías con proveedores, ubicaciones efectivas, retención y eliminación, y mantener un inventario de encargados/subencargados. `store:false` no garantiza retención cero en OpenAI.
- Establecer plazos concretos y procedimientos de conservación para consultas, trabajos técnicos, evidencias y respaldos. Hoy no hay una tarea automática global de retención ni cierre de cuenta de autoservicio; las solicitudes deben ser atendidas por el responsable.
- Habilitar un Libro de Reclamaciones conforme al régimen aplicable al servicio y un responsable de atención. Un correo de soporte o un enlace a Indecopi no lo sustituyen. Se necesitan datos del proveedor y una operación real de recepción y respuesta; no se creó un formulario que simule esa operación.
- Tener un procedimiento de derechos de datos, incidentes, moderación y notificación de cambios de @usuario. Una cláusula no permite excluir derechos irrenunciables o actuar de forma abusiva.

## Fuentes primarias consultadas el 27/09/2026

- Reglamento vigente, DS 016-2024-JUS, especialmente consentimiento e información (arts. 1–6), transferencias y derechos: https://www3.congreso.gob.pe/Docs/DGP/DIDP/files/ds_016-2024-jus.pdf
- Ley 29733, deber de información y derechos: https://www.leyes.congreso.gob.pe/documentos/leyes/29733.pdf
- Indecopi, Código de Protección y Defensa del Consumidor: https://consumidor.gob.pe/codigo-del-consumidor/
- Indecopi, derechos de autor en fotografías: https://www.gob.pe/institucion/indecopi/informes-publicaciones/4659207-guia-de-derecho-de-autor-para-fotografos
- ANPD, inscripción de bancos de datos: https://www.gob.pe/institucion/anpd/pages/8060-inscribir-banco-de-datos-en-el-registro-nacional-de-proteccion-de-datos-personales
- Indecopi, Libro de Reclamaciones: https://consumidor.gob.pe/libro-de-reclamaciones/
- Proveedores: https://developers.openai.com/api/docs/guides/your-data y https://www.cloudflare.com/privacypolicy/
