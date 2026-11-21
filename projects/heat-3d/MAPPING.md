# HEAT · Mapping

Pantalla completa muestra la obra limpia y aplica la calibración guardada. Mapping (M) entra en pantalla completa con los controles de calibración. M oculta o muestra panel y guías. Esc vuelve a la vista normal.

Cuatro esquinas ajustan perspectiva. Añadir punto crea hasta 24 controles interiores; Quitar punto elimina el seleccionado. Las flechas mueven el punto enfocado 1 píxel; Shift + flechas, 10. La deformación interior mantiene los bordes fijos. Las configuraciones cruzadas se rechazan.

Escala: 25–200%. Posición X/Y: −75% a +75%. Ver guías muestra u oculta la grilla y los puntos. Restablecer devuelve las cuatro esquinas al contorno completo, elimina los puntos y vuelve a 100% / 0% / 0%.

La calibración se guarda en heat-3d.projection.v2, exclusivamente para HEAT. La entrada de mano y mouse se convierte al espacio de la imagen deformada. Durante la edición del Mapping la emisión de calor no sigue el cursor de calibración.

Validación: cuatro pruebas de geometría; pruebas en Chrome aislado de arrastre, añadir/quitar, flechas y Shift, escala/posición, guías, M, Esc, restablecimiento, recuperación tras recargar, pantalla completa limpia y render OBJ sin errores WebGL.
