// Motor de sonido del río (rio/).
//
// Cada versión define sus capas en su propio capas-sonido.js (CAPAS_SONIDO) y
// este archivo se ocupa del resto: cargar los audios, arrancarlos, mezclarlos
// con el momento del día y mostrar los volúmenes en el panel.
//
// Cada capa es un objeto:
//   nombre   : cómo se llama en el panel
//   archivo  : ruta del audio, relativa al index.html
//   tipo     : 'loop' (suena todo el tiempo), 'evento' (suena una vez en ciertos momentos)
//              o 'interruptor' (un botón del panel lo prende y lo apaga; mientras está prendido suena en loop)
//   en       : solo para 'evento', opcional: momentos del día (0 a 1) en los que se dispara solo.
//              Además, cada 'evento' tiene un botón "tocar" en el panel, asignable al MIDI.
//   alTocar  : solo para 'evento', opcional: función que reemplaza a tocarSonido en el botón del panel
//   cada     : solo para 'evento', opcional: [mínimo, máximo] de segundos entre disparos al azar
//   cuando   : función (estado, m) → true/false; con 'cada', solo dispara si da true
//              (por ejemplo, solo si hay tormenta: (e) => e.tormenta > 0.6)
//   volumen  : volumen inicial (0 a 1); después se ajusta en el panel
//   nivel    : función (estado, m, agitacion) → 0 a 1 que dice cuánto suena la capa
//              ahora. Es lo que hace que el sonido siga a la imagen. Opcional.
//   suavizado: segundos que tarda en seguir los cambios de nivel (por defecto 0.6)
//   escena   : opcional: función () → 0 a 1, cuánto se ve su escena (el sonido baja con ella)
//   grupo    : opcional: nombre de una subcarpeta del panel donde van su botón y su volumen
//              (por ejemplo la botonera de pájaros)
//
// Los volúmenes se guardan en CONFIG.sonido, así salen con "Copiar ajustes".
//
// Los navegadores no dejan sonar audio hasta que la persona toca la página:
// se activa con el primer clic o tecla (en OBS suele arrancar solo).
// Con ?silencio en la URL no se carga nada de sonido.

const Sonido = {
  capas: [],
  activo: false,
  cfg: null,
  ultimo: 0,
  progresoPrevio: null,
  aviso: null,
};

function iniciarSonido(defs) {
  if (new URLSearchParams(location.search).has('silencio')) return;

  const cfg = (Sonido.cfg = CONFIG.sonido = CONFIG.sonido || {});
  if (cfg.maestro === undefined) cfg.maestro = 1;
  if (cfg.silencio === undefined) cfg.silencio = false;
  cfg.volumenes = cfg.volumenes || {};
  // Volumen de todo un grupo junto (por ejemplo, toda la botonera de pájaros): multiplica
  // al volumen propio de cada uno
  cfg.grupos = cfg.grupos || {};

  for (const def of defs) {
    if (cfg.volumenes[def.nombre] === undefined) cfg.volumenes[def.nombre] = def.volumen ?? 1;
    if (def.grupo && !cfg.grupos[def.grupo]) cfg.grupos[def.grupo] = { volumen: 1 };
    const evento = def.tipo === 'evento';
    const interruptor = def.tipo === 'interruptor';
    const audio = new Audio();
    audio.src = def.archivo;
    audio.preload = 'auto';
    audio.loop = !evento;
    audio.volume = 0;
    Sonido.capas.push({ ...def, evento, interruptor, encendido: false, audio, actual: 0 });
  }

  // Si el navegador deja, arranca solo; si no, con el primer clic o tecla
  arrancarSonido();
  if (!Sonido.activo) {
    Sonido.aviso = document.createElement('div');
    Sonido.aviso.className = 'aviso';
    Sonido.aviso.textContent = 'Hacé clic para activar el sonido';
    document.body.appendChild(Sonido.aviso);
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, arrancarSonido);
  }
}

function arrancarSonido() {
  if (Sonido.activo) return;
  const loops = Sonido.capas.filter((c) => !c.evento && !c.interruptor);
  Promise.all(loops.map((c) => (c.wa ? Promise.resolve(c.wa.arrancar()) : c.audio.play()))).then(
    () => {
      Sonido.activo = true;
      if (Sonido.aviso) Sonido.aviso.remove();
      for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, arrancarSonido);
    },
    () => { /* todavía no hubo gesto: se vuelve a intentar con el próximo */ }
  );
}

// Una capa puede sonar por su <audio> o, si musica.js pudo cargar el archivo, por Web Audio
// (c.wa: así pasa por los efectos, como el filtro del agua o el eco de los pájaros)
function sonandoCapa(c) {
  return c.wa ? c.wa.sonando : !c.audio.paused;
}

// Prende o apaga una capa 'interruptor'. Al prenderla arranca desde el principio; al apagarla
// se va con un fundido corto (ver actualizarSonido) y después se pausa.
function alternarSonido(c) {
  if (!Sonido.activo) return;
  c.encendido = !c.encendido;
  if (c.encendido && !sonandoCapa(c)) {
    if (c.wa) c.wa.arrancar();
    else {
      c.audio.currentTime = 0;
      c.audio.play().catch(() => {});
    }
  }
  if (c.boton) c.boton.name((c.encendido ? '■ apagar ' : '▶ prender ') + c.nombre);
}

// Dispara un sonido puntual desde el principio. Lo usan el botón del panel
// (que se puede asignar a un botón del controlador MIDI) y los momentos "en".
function tocarSonido(c) {
  if (!Sonido.activo) return;
  // Si ya está sonando (un trueno largo y otro rayo encima), no se corta: arranca una copia que
  // suena en paralelo con el volumen del momento. Como mucho, dos copias a la vez.
  const ocupado = !c.audio.paused && !c.audio.ended;
  let a = c.audio;
  if (ocupado) {
    c.copias = (c.copias || []).filter((x) => !x.paused && !x.ended);
    if (c.copias.length >= 2) return;
    a = c.audio.cloneNode();
    a.volume = c.audio.volume;
    c.copias.push(a);
  }
  a.currentTime = 0;
  a.play().catch(() => {});
}

// ¿El momento x (0 a 1) quedó entre el progreso anterior y el actual?
// Contempla el salto al volver a empezar el loop.
function sonidoCruza(previo, actual, x) {
  return previo <= actual ? previo < x && x <= actual : x > previo || x <= actual;
}

// Se llama en cada cuadro. agitacion: cuán movida está el agua ahora.
function actualizarSonido(estado, m, agitacion) {
  if (!Sonido.cfg) return;
  const ahora = performance.now();
  const dt = Math.min(0.1, (ahora - (Sonido.ultimo || ahora)) / 1000);
  Sonido.ultimo = ahora;
  const previo = Sonido.progresoPrevio ?? estado.progreso;
  Sonido.progresoPrevio = estado.progreso;

  const { maestro, silencio, volumenes } = Sonido.cfg;
  for (const c of Sonido.capas) {
    let objetivo = c.nivel ? c.nivel(estado, m, agitacion) : 1;
    if (c.interruptor && !c.encendido) objetivo = 0;
    const nivel = Math.min(Math.max(objetivo, 0), 1);
    const tau = c.suavizado ?? (c.interruptor ? 0.15 : 0.6);
    c.actual += (nivel - c.actual) * (1 - Math.exp(-dt / Math.max(tau, 0.01)));

    if (c.evento && !estado.pausa && (c.en || []).some((x) => sonidoCruza(previo, estado.progreso, x))) {
      tocarSonido(c);
    }
    // Disparo al azar: cada tanto, y solo si se cumple la condición (por ejemplo, que haya tormenta)
    if (c.evento && c.cada && Sonido.activo && !estado.pausa) {
      const espera = () => 1000 * (c.cada[0] + Math.random() * (c.cada[1] - c.cada[0]));
      if (c.proximo === undefined) c.proximo = ahora + espera();
      if (ahora >= c.proximo) {
        if (!c.cuando || c.cuando(estado, m)) tocarSonido(c);
        c.proximo = ahora + espera();
      }
    }
    // Un interruptor apagado se pausa cuando terminó de bajar
    if (c.interruptor && !c.encendido && c.actual < 0.005 && sonandoCapa(c)) (c.wa ? c.wa.parar() : c.audio.pause());
    const grupo = (c.grupo ? Sonido.cfg.grupos[c.grupo].volumen : 1) * (c.escena ? c.escena() : 1);
    const vol = silencio ? 0 : maestro * grupo * volumenes[c.nombre] * (c.evento ? nivel : c.actual);
    if (c.wa) c.wa.volumen(Math.min(Math.max(vol, 0), 1));
    else c.audio.volume = Math.min(Math.max(vol, 0), 1);
  }
}

// Carpeta "Sonido" del panel. Hay que llamarla antes de iniciarMidi, así los
// volúmenes también se pueden asignar a una perilla.
function sonidoPanel(gui) {
  if (!Sonido.cfg) return;
  const f = gui.addFolder('Sonido');
  f.add(Sonido.cfg, 'maestro', 0, 1, 0.01).name('volumen general');
  f.add(Sonido.cfg, 'silencio').name('silencio');
  // Las capas con grupo van en su subcarpeta: arriba los botones y adentro, sus volúmenes
  const grupos = {};
  const carpeta = (c) => {
    if (!c.grupo) return f;
    if (!grupos[c.grupo]) {
      const g = f.addFolder(c.grupo);
      // MIDI: "Sonido/<grupo>/volumen" (por ejemplo, la perilla 1 del Korg para los pájaros)
      g.add(Sonido.cfg.grupos[c.grupo], 'volumen', 0, 1, 0.01).name('volumen de todos');
      grupos[c.grupo] = { botones: g, volumenes: g.addFolder('volúmenes').close() };
    }
    return grupos[c.grupo];
  };
  for (const c of Sonido.capas) {
    const dest = c.grupo ? carpeta(c).volumenes : f;
    dest.add(Sonido.cfg.volumenes, c.nombre, 0, 1, 0.01).name(c.nombre);
  }
  // Un botón por cada sonido puntual (el nombre de la propiedad no puede repetir el del volumen,
  // porque el MIDI identifica cada control por carpeta + propiedad)
  for (const c of Sonido.capas) {
    if (c.interruptor) c.boton = (c.grupo ? carpeta(c).botones : f).add({ ['tocar_' + c.nombre]: () => alternarSonido(c) }, 'tocar_' + c.nombre).name('▶ prender ' + c.nombre);
  }
  for (const c of Sonido.capas) {
    if (c.evento) f.add({ ['tocar_' + c.nombre]: () => (c.alTocar ? c.alTocar() : tocarSonido(c)) }, 'tocar_' + c.nombre).name('▶ tocar ' + c.nombre);
  }
  f.close();
}
