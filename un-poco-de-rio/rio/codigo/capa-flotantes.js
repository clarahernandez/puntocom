// Capa "flotantes": los camalotes, los kayaks y las garcitas, que cruzan la imagen.
// Cada uno tiene su carpeta en el panel (garzas.js, kayaks.js, camalotes.js). Siguen su
// camino aunque la capa esté en 0, así al prenderla el movimiento ya está en marcha.

// Cuánto se agrandan todos los flotantes (lo usan garzas.js, kayaks.js y camalotes.js)
function escalaFlotantes() {
  return (CONFIG.capas && CONFIG.capas.flotantes && CONFIG.capas.flotantes.escala) || 1;
}

registrarCapa({
  id: 'flotantes',
  nombre: 'flotantes (camalotes, kayaks, garcitas)',
  tipo: 'dibujo',
  // escala: agranda a todos juntos (1 = el tamaño de cada carpeta; en el Korg, perilla 6)
  // Apagada de entrada (21/11/2026: se sacaron de la obra; se pueden prender desde el panel)
  defecto: { opacidad: 0, mezcla: 'normal', escala: 1 },
  panel: (g) => g.add(CONFIG.capas.flotantes, 'escala', 1, 4, 0.01).name('agrandar a todos (× tamaño)'),
  actualizar: ({ dt }) => {
    actualizarCamalotes(dt);
    actualizarKayaks(dt);
    actualizarGarzas(dt);
  },
  // Primero los camalotes, después los kayaks y, más arriba, las garcitas volando
  dibujar: () => {
    dibujarCamalotes();
    dibujarKayaks();
    dibujarGarzas();
  },
});
