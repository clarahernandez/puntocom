// Capa "río marrón": las cáusticas, la luz dentro del agua sobre el fondo marrón del río.
// El shader está en shaders/causticas.js y lo que se le pasa en agua.js (dibujarAgua).

registrarCapa({
  id: 'rioMarron',
  nombre: 'río marrón (cáusticas)',
  tipo: 'shader',
  grupo: 'rio',
  defecto: { opacidad: 1, mezcla: 'normal' },
  dibujarShader: ({ m, o, agitacion }) => dibujarAgua(m, o, agitacion),
});
