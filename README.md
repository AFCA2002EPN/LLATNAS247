# Sistema de Gestión de Taller

Proyecto frontend inicial para un dashboard administrativo de taller automotriz.

## Estructura

- `index.html`: estructura principal de la interfaz.
- `styles.css`: estilos y diseño del dashboard.
- `script.js`: interacciones ligeras.
- `assets/images/`: recursos gráficos, incluido un placeholder del logo.

## Ejecutar

Desde la carpeta del proyecto:

```bash
python -m http.server 8000
```

Luego abre en el navegador:

```text
http://localhost:8000
```

## Personalización

Cuando tengas los logos o assets finales, reemplaza los archivos dentro de `assets/images/` y ajusta rutas si es necesario.

## Consentimientos

La interfaz solicita aprobacion de Cliente y Asesor de ventas, y muestra Instalador de enllantaje o Instalador de alineacion segun los servicios seleccionados. El boton `Notificar` prepara un correo mediante `mailto:` y `Aprobar` sirve como vista previa local.

Para enviar notificaciones reales y aceptar desde un enlace del correo se necesita un backend que genere enlaces unicos, guarde el estado de cada aprobacion y valide la identidad del responsable. El frontend estatico no puede recibir ni persistir esas aprobaciones por si solo.
