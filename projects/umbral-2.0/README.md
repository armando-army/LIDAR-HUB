# UMBRAL 2.0 · Armando Frezze Durand

Versión independiente de UMBRA01 para recibir las posiciones de **LiDAR Studio**. Conserva las ondas WebGL, imagen, máscara, cámara y pantalla completa. UMBRA01 no fue reemplazado.

## Arranque recomendado en Mac

1. Ubicá las carpetas `LIDAR-STUDIO` y `UMBRAL-2.0` una al lado de la otra. Si descargás los ZIP de GitHub, quitá el sufijo `-main` de los nombres de las carpetas.
2. Iniciá LiDAR Studio: `python3 local/launch.py` desde su carpeta. Conectá el C1, aprendé el fondo, calibrá y habilitá salida JSON.
3. En otra ventana de Terminal, desde la carpeta UMBRAL-2.0, ejecutá `python3 local/launch.py`. También podés abrir `Iniciar-UMBRAL-2.command`; si hace falta, aplicá `chmod +x Iniciar-UMBRAL-2.command` una vez.
4. El iniciador registra un enlace a esta obra dentro de `LIDAR-STUDIO/projects/umbral-2.0`, sin copiar ni reemplazar otros proyectos, y abre:

   http://127.0.0.1:8767/projects/umbral-2.0/

Si Studio está en otro lugar: `python3 local/launch.py --studio /ruta/a/LIDAR-STUDIO`.

El iniciador de UMBRAL no abre el USB ni crea otro servidor: el único dueño del sensor es LiDAR Studio. Mantené abiertas ambas ventanas en el mismo navegador y perfil. No alternes `localhost` con `127.0.0.1`. Si sólo querés probar con el mouse, podés servir esta carpeta con cualquier servidor HTTP local.

## Uso

- **Entrada · LiDAR Studio** (tecla L): estado de recepción, contactos, conexión y orientación de esta obra.
- **Abrir LiDAR Studio**: ajustes del sensor, fondo y calibración, fuera de la obra.
- **Zonas**: por defecto 3 × 2 m y 25 cm, con permanencia y repetición recibidas del calibrador. Mantener la mano sobre una zona produce ondas. Admite varios contactos.
- **Seguir la mano continuamente**: las ondas acompañan el movimiento de cada mano.
- **Ocultar círculos / Mostrar círculos**: botón directo en la barra superior y en pantalla completa. Oculta los indicadores con ID sin detener la detección ni las ondas. La elección se conserva al recargar.
- **Mostrar grilla / posiciones**: diagnóstico en la obra. Las zonas respetan el área de proyección; las bandas sin imagen no se estiran para producir contactos falsos.
- **Orientación**: intercambio de ejes y reflejos horizontal/vertical, guardados sólo para UMBRAL 2.0.
- **Cámara**: disponible al desactivar la entrada de manos. El mouse y el dedo siguen funcionando sobre la imagen.
- **Gotas automáticas**: empiezan apagadas para distinguir las ondas causadas por las manos. Podés habilitarlas desde los controles visuales.

En pantalla completa permanece un botón para abrir la entrada. Podés cerrar los controles visuales de máscara con ×. La imagen y máscara cargadas viven en la sesión actual, igual que en UMBRA01.

## Conexión alternativa

Cuando UMBRAL se sirve desde otra dirección, elegí WebSocket en su panel de entrada. En LiDAR Studio elegí salida WebSocket, habilitala y pegá la URL completa que muestra, incluido el token de sesión. Pulsá Reconectar entrada. El token se genera al iniciar el servicio: no se guarda en el código ni en el repositorio. La URL se mantiene sólo en el campo de esta ventana.

La conexión local es la vía recomendada; una web HTTPS puede bloquear WebSocket HTTP local por las reglas del navegador.

## Arquitectura

| Archivo | Función |
| --- | --- |
| index.html | Obra, imagen, máscara y simulación de ondas |
| studio-input.mjs | Recepción de manos, estado y activación de ondas |
| input-core.mjs | Geometría, orientación y parámetros físicos |
| sdk/lidar-client.mjs | Receptor reutilizado de LiDAR Studio y activación por zonas |
| local/launch.py | Enlace local para servir la obra desde LiDAR Studio |

No contiene calibrador USB ni vuelve a aprender el fondo. La configuración artística de esta versión se guarda con una clave propia; no cambia los perfiles de UMBRA01 ni de LiDAR Studio.

## Pruebas

`node --test tests/input.test.mjs`

Se comprueban la correspondencia entre proyección e imagen, bandas laterales, orientación, tamaño físico de las ondas, permanencia y dos manos en zonas diferentes.

### Validación de esta versión

Pasaron 7 pruebas, incluida la recepción por BroadcastChannel y la limpieza de contactos al perder señal. Se verificó por huellas SHA-256 que los archivos de UMBRA01 permanecen intactos. La interfaz se verificó en Chrome sin errores de JavaScript y con entrada activa desde LiDAR Studio. Se liberaron seis pestañas duplicadas del calibrador que ocupaban las conexiones HTTP e impedían cargar la obra. Conservá un único calibrador abierto. Falta confirmar las ondas de esta versión con una mano dentro del área.
