// Música electrónica del río: todo con Web Audio, en el mismo Chrome, sin programas aparte.
// Se maneja desde el panel (carpeta "Música") y desde el modo SONIDO del Korg.
//
//   colchón  : un acorde largo y grave que cambia con el momento del día
//   gotas    : cada gota de la lluvia toca una nota (pentatónica de re menor), del lado donde cae
//   pulso    : un golpe grave con cada pulso de luz del puente ("pulsos por minuto") y con cada destello
//   agua     : un filtro que la lleva "bajo el agua" (grave y apagada) o la deja abierta
//   pájaros  : eco para la botonera
//   congelar : agarra un pedacito del agua y lo estira en un sonido continuo
//   espacio  : reverberación de todo lo electrónico
//
// El filtro del agua, el eco de los pájaros y "congelar" trabajan sobre las grabaciones, y Chrome solo
// deja leerlas si se abre con permiso para archivos locales (abrir-para-obs.bat lo hace). Si no, esas
// tres no hacen nada y el agua y los pájaros suenan como siempre; lo demás anda igual.

const MUSICA_DEFECTO = {
  espacio: 0.35,
  colchon: { activo: false, volumen: 0.5, brillo: 0.35 },
  gotas: { activo: false, volumen: 0.6, cantidad: 0.4 },
  pulso: { activo: false, volumen: 0.7, cola: 0.35 },
  agua: { filtro: 1 },
  // conversacion: los pájaros prendidos cantan de a un canto y se contestan (si no, cada uno en loop)
  // charla: cuánto charlan; aTiempo: los cantos caen sobre el pulso (tempo, o el del puente
  // si el golpe del pulso está prendido)
  // saltos: cuánto salta cada canto entre los parlantes (los canales D e I) mientras suena
  pajaros: { eco: 0, conversacion: true, charla: 0.4, aTiempo: false, tempo: 96, saltos: 0.8 },
  congelar: { activo: false, volumen: 0.6, tono: 0.5 },
  // El río: mover = cuánto va y viene el agua entre los parlantes (más rápido con las cáusticas
  // agitadas); canta = el agua suena las notas del acorde del momento, con un grave profundo;
  // conCausticas = el canto acompaña a los ríos (suena cuanto se ve el río real o el marrón, y
  // se calla en las otras escenas); olas = el agua crece y baja como olas que llegan
  // barco = volumen del barco constante (la bocina que suena todo el tiempo, lejos)
  rio: { mover: 0.4, canta: false, volumen: 0.6, profundo: 0.5, conCausticas: true, bocina: 0.7, olas: 0.3, barco: 0,
    // burbujas y chapoteo de las olas (más agua): prendidos y suaves
    burbujas: true, burbujasVol: 0.5, chapoteo: true, chapoteoVol: 0.6 },
};

// Acordes del colchón para cada momento del día (notas MIDI, alrededor de re menor)
const COLCHON_ACORDES = {
  noche: [38, 45, 53, 60, 64],        // re menor 9
  amanecer: [41, 48, 57, 64, 67],     // fa maj9
  'mediodía': [43, 50, 59, 65, 69],   // sol 9
  tarde: [45, 52, 60, 67, 71],        // la menor 7 (9)
  dorada: [36, 43, 52, 59, 62],       // do maj9
  atardecer: [34, 41, 50, 57, 64],    // si bemol maj7 (#11)
};
const GOTAS_ESCALA = [0, 3, 5, 7, 10];   // pentatónica menor, desde re

const Musica = {
  ctx: null,
  archivos: false,
  grabaciones: 'probando…',   // se ve en el panel
  fichas: 0,                  // cuántas notas de gotas pueden sonar ya (no más de ~14 por segundo)
  fase: 0, puenteT: null, destello: 0, faseAves: 0,
  acorde: null,
  aguaWA: null,
  congelando: false, congelarPos: 0, proximoGrano: 0,
};

const midiAFrecuencia = (n) => 440 * Math.pow(2, (n - 69) / 12);

function iniciarMusica() {
  CONFIG.musica = CONFIG.musica || {};
  for (const [k, v] of Object.entries(MUSICA_DEFECTO)) {
    CONFIG.musica[k] = typeof v === 'object' ? Object.assign({}, v, CONFIG.musica[k]) : (CONFIG.musica[k] ?? v);
  }
  // Al abrir, todo lo electrónico arranca apagado (aunque se haya copiado prendido)
  for (const k of ['colchon', 'gotas', 'pulso', 'congelar']) CONFIG.musica[k].activo = false;

  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || new URLSearchParams(location.search).has('silencio')) {
    Musica.grabaciones = 'sin sonido';
    return;
  }
  const ctx = (Musica.ctx = new AC({ latencyHint: 'interactive' }));
  const ganancia = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };

  // Salida: un limitador para que nada sature
  const final = (Musica.final = ctx.createDynamicsCompressor());
  final.threshold.value = -8; final.knee.value = 6; final.ratio.value = 12;
  final.attack.value = 0.003; final.release.value = 0.25;
  final.connect(ctx.destination);

  // Espacio: reverberación con una respuesta inventada (ruido que se apaga en ~3 s)
  const rev = ctx.createConvolver();
  rev.buffer = musicaImpulso(ctx, 3.2);
  Musica.envioEspacio = ganancia(1);
  Musica.espacioSalida = ganancia(CONFIG.musica.espacio);
  Musica.envioEspacio.connect(rev); rev.connect(Musica.espacioSalida); Musica.espacioSalida.connect(final);

  // Eco: retardo con realimentación, cada repetición un poco más oscura
  const retardo = ctx.createDelay(2);
  retardo.delayTime.value = 0.42;
  const oscuro = ctx.createBiquadFilter(); oscuro.type = 'lowpass'; oscuro.frequency.value = 2800;
  const vuelta = ganancia(0.45);
  Musica.envioEco = ganancia(1);
  Musica.envioEco.connect(retardo); retardo.connect(oscuro); oscuro.connect(vuelta); vuelta.connect(retardo);
  oscuro.connect(final);
  const ecoAlEspacio = ganancia(0.4); oscuro.connect(ecoAlEspacio); ecoAlEspacio.connect(Musica.envioEspacio);

  // Un bus por instrumento, con su envío al espacio (y al eco)
  const bus = (espacio, eco = 0, destino = final) => {
    const g = ganancia(0);
    g.connect(destino);
    if (espacio) { const s = ganancia(espacio); g.connect(s); s.connect(Musica.envioEspacio); }
    if (eco) { const s = ganancia(eco); g.connect(s); s.connect(Musica.envioEco); }
    return g;
  };
  Musica.colchonBus = bus(0.6);
  Musica.gotasBus = bus(0.6, 0.3);
  Musica.pulsoBus = bus(0.08);
  Musica.congelarBus = bus(0.7);

  // Agua (si se pudo cargar la grabación): filtro "bajo el agua"
  Musica.aguaFiltro = ctx.createBiquadFilter();
  Musica.aguaFiltro.type = 'lowpass';
  Musica.aguaFiltro.frequency.value = 20000;
  Musica.aguaLado = ctx.createStereoPanner();   // el agua va y viene entre los parlantes
  Musica.aguaOla = ganancia(1);                  // y crece y baja como olas
  Musica.aguaFiltro.connect(Musica.aguaOla);
  Musica.aguaOla.connect(Musica.aguaLado);
  Musica.aguaLado.connect(final);
  const aguaEsp = ganancia(0.12); Musica.aguaFiltro.connect(aguaEsp); aguaEsp.connect(Musica.envioEspacio);

  // Botonera de pájaros: seca, más su envío al eco
  Musica.pajarosBus = ganancia(1);
  Musica.pajarosBus.connect(final);
  Musica.pajarosEco = ganancia(0);
  Musica.pajarosBus.connect(Musica.pajarosEco); Musica.pajarosEco.connect(Musica.envioEco);
  const pajEsp = ganancia(0.1); Musica.pajarosBus.connect(pajEsp); pajEsp.connect(Musica.envioEspacio);

  crearColchon(ctx);
  crearRioQueCanta(ctx, bus);

  // Los navegadores no dejan sonar hasta que la persona toca la página (en OBS arranca solo)
  const despertar = () => ctx.resume().catch(() => {});
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, despertar);
  despertar();
  probarArchivos();
}

// Respuesta de una sala inventada: ruido estéreo que se apaga de a poco
function musicaImpulso(ctx, segundos) {
  const n = Math.floor(ctx.sampleRate * segundos);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  return buf;
}

// ---------- Colchón ----------

function crearColchon(ctx) {
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.Q.value = 0.8;
  filtro.connect(Musica.colchonBus);
  // Un vaivén lento del filtro, para que respire
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoCuanto = ctx.createGain();
  lfo.connect(lfoCuanto); lfoCuanto.connect(filtro.frequency);
  lfo.start();
  const voces = COLCHON_ACORDES.noche.map((nota) => {
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(filtro);
    // Dos sierras apenas desafinadas entre sí: suena ancho
    const oscs = [-8, 8].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiAFrecuencia(nota);
      o.detune.value = cents;
      o.connect(g);
      o.start();
      return o;
    });
    return { oscs };
  });
  Musica.colchon = { filtro, lfoCuanto, voces };
}

function actualizarColchon(ctx, m) {
  const C = CONFIG.musica.colchon, t = ctx.currentTime;
  // (el colchón suena en los ríos y en los sauces; se calla en el puente y la tormenta)
  const esc = escenaVisible('rioReal', 'rioMarron', 'sauces');
  Musica.colchonBus.gain.setTargetAtTime(C.activo ? C.volumen * 0.6 * m * esc : 0, t, 0.8);
  const corte = 150 * Math.pow(2, C.brillo * 6);   // de 150 Hz a ~9600 Hz
  Musica.colchon.filtro.frequency.setTargetAtTime(corte, t, 0.1);
  Musica.colchon.lfoCuanto.gain.setTargetAtTime(corte * 0.35, t, 0.1);
  const acorde = COLCHON_ACORDES[estado.momento];
  if (acorde && acorde !== Musica.acorde) {
    Musica.acorde = acorde;
    Musica.colchon.voces.forEach((v, i) => {
      for (const o of v.oscs) o.frequency.setTargetAtTime(midiAFrecuencia(acorde[i]), t, 2.5);
    });
  }
}

// ---------- Gotas ----------

// La llama gotas.js por cada gota que cae (x, y de 0 a 1; r: tamaño)
function gotaMusical(x, y, r) {
  const ctx = Musica.ctx, G = CONFIG.musica && CONFIG.musica.gotas;
  if (!ctx || !G || !G.activo || ctx.state !== 'running' || Musica.fichas < 1) return;
  Musica.fichas -= 1;
  const nota = 62 + GOTAS_ESCALA[Math.floor(Math.random() * GOTAS_ESCALA.length)] + 12 * Math.floor(Math.random() * 3);
  const f = midiAFrecuencia(nota), t = ctx.currentTime + 0.01;
  const dur = 0.35 + 0.9 * Math.random() * Math.min(1.5, 0.5 + r / 4);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lado = ctx.createStereoPanner();
  lado.pan.value = x * 2 - 1;
  env.connect(lado); lado.connect(Musica.gotasBus);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.25;
  o1.connect(env); o2.connect(g2); g2.connect(env);
  for (const o of [o1, o2]) { o.start(t); o.stop(t + dur + 0.05); }
}

// ---------- Pulso ----------

// largo: 1 = la cola entera (una negra); las semicorcheas suenan más secas
// cuando: en qué instante del reloj del sonido (si no, ya)
function golpePulso(fuerza = 1, largo = 1, cuando = 0) {
  const ctx = Musica.ctx, P = CONFIG.musica.pulso;
  const t = Math.max(cuando, ctx.currentTime + 0.005), cola = (0.12 + P.cola * 0.9) * largo;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(fuerza, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + cola);
  o.connect(g); g.connect(Musica.pulsoBus);
  o.start(t); o.stop(t + cola + 0.05);
}

function actualizarPulso(ctx, m, dt) {
  const P = CONFIG.musica.pulso;
  Musica.pulsoBus.gain.setTargetAtTime(P.activo ? P.volumen * m * escenaVisible('puente') : 0, ctx.currentTime, 0.05);
  if (typeof Puente === 'undefined') return;
  const bpm = CONFIG.puente ? CONFIG.puente.bpm : 0;
  // El pulso lo lleva el reloj del sonido (parejo aunque la imagen se trabe); la luz del puente
  // lo sigue (fasePulso), así golpe y destello van juntos
  const reloj = ctx.currentTime;
  Musica.fase += (reloj - (Musica.ultimoReloj ?? reloj)) * bpm / 60;
  Musica.ultimoReloj = reloj;
  // El ritmo del puente (golpeRitmo, en semicorcheas). Cada golpe se agenda un poquito antes, en
  // el instante justo del reloj del sonido (si se disparara al dibujar cada cuadro, quedaría flojo)
  const ahora16 = Musica.fase * 4, porSeg = bpm / 60 * 4;
  if (Musica.agendado16 === undefined || Math.abs(Musica.agendado16 - ahora16) > 8) Musica.agendado16 = Math.ceil(ahora16) - 1;
  if (P.activo && bpm > 0) {
    const hasta = Math.floor(ahora16 + porSeg * Math.max(0.1, dt * 1.5));
    for (let k = Math.max(Musica.agendado16 + 1, Math.ceil(ahora16)); k <= hasta; k++) {
      const g = golpeRitmo(k + 0.001);
      if (g && g.u < 0.01) golpePulso(0.85 * g.fuerza, Math.min(1, 0.4 + 0.15 * g.dura), ctx.currentTime + (k - ahora16) / porSeg);
      Musica.agendado16 = k;
    }
  } else Musica.agendado16 = Math.floor(ahora16);
  const destello = Puente.destello > Musica.destello + 0.3;   // el destello a mano también suena
  Musica.destello = Puente.destello;
  if (P.activo && destello) golpePulso(1);
}

// En qué tiempo (negras) va el pulso ahora, para la luz del puente. null = no hay sonido andando
function fasePulso() {
  const ctx = Musica.ctx;
  if (!ctx || ctx.state !== 'running' || Musica.ultimoReloj === undefined) return null;
  const bpm = CONFIG.puente ? CONFIG.puente.bpm : 0;
  return Musica.fase + (ctx.currentTime - Musica.ultimoReloj) * bpm / 60;
}

// ---------- Grabaciones por Web Audio (agua y botonera) ----------

// ¿Chrome deja leer los archivos? Solo con el permiso de abrir-para-obs.bat
function probarArchivos() {
  const agua = Sonido.capas.find((c) => c.nombre === 'agua');
  if (!agua) { Musica.grabaciones = 'no encuentro el agua'; return; }
  fetch(agua.archivo).then((r) => r.arrayBuffer()).then(
    () => {
      Musica.archivos = true;
      Musica.grabaciones = 'con efectos (filtro, eco y congelar)';
      Musica.aguaWA = capaWebAudio(agua, Musica.aguaFiltro, false);
      Musica.aguaWA.cargar();
    },
    () => { Musica.grabaciones = 'sin permiso: abrí la obra con abrir-para-obs.bat'; }
  );
}

// Lo que sonido.js necesita para hacer sonar una capa por Web Audio (ver sonandoCapa)
// (pajaro: true = es de la botonera: se guarda en mono, se corta en cantos y puede conversar)
function capaWebAudio(c, destino, pajaro) {
  const ctx = Musica.ctx;
  const wa = { buffer: null, src: null, sonando: false, inicio: 0, cargando: null, cantos: null, gain: ctx.createGain() };
  wa.gain.gain.value = 0;
  wa.gain.connect(destino);
  wa.crudo = ctx.createGain();   // la grabación sin su volumen (de acá canta el río)
  wa.cargar = () => (wa.cargando = wa.cargando || fetch(c.archivo)
    .then((r) => r.arrayBuffer())
    .then((b) => ctx.decodeAudioData(b))
    .then((buf) => {
      wa.buffer = pajaro ? musicaMono(ctx, buf) : buf;
      if (pajaro) wa.cantos = cortarCantos(wa.buffer);
    }));
  wa.arrancar = (desde = 0) => {
    wa.sonando = true;
    return wa.cargar().then(() => {
      // conversando no hay loop: los cantos los dispara actualizarAves
      if (!wa.sonando || wa.src || (wa.cantos && CONFIG.musica.pajaros.conversacion)) return;
      const s = ctx.createBufferSource();
      s.buffer = wa.buffer;
      s.loop = true;
      s.connect(wa.gain);
      s.connect(wa.crudo);
      const desplazo = desde % wa.buffer.duration;
      s.start(0, desplazo);
      wa.src = s;
      wa.inicio = ctx.currentTime - desplazo;
    });
  };
  wa.parar = () => {
    wa.sonando = false;
    if (wa.src) { wa.src.stop(); wa.src.disconnect(); wa.src = null; }
  };
  wa.volumen = (v) => wa.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.03);
  wa.posicion = () => (wa.buffer ? (ctx.currentTime - wa.inicio) % wa.buffer.duration : 0);
  return wa;
}

// Los pájaros se guardan en mono: ocupan la mitad de memoria (y así, más adelante,
// cada uno se puede mandar a un parlante del domo)
function musicaMono(ctx, buf) {
  if (buf.numberOfChannels === 1) return buf;
  const m = ctx.createBuffer(1, buf.length, buf.sampleRate);
  const d = m.getChannelData(0), n = buf.numberOfChannels;
  for (let ch = 0; ch < n; ch++) {
    const s = buf.getChannelData(ch);
    for (let i = 0; i < s.length; i++) d[i] += s[i] / n;
  }
  return m;
}

// Pasa el agua y los pájaros a Web Audio cuando se puede (sin cortar lo que está sonando)
function pasarAWebAudio(ctx) {
  if (!Musica.archivos || ctx.state !== 'running') return;
  const agua = Sonido.capas.find((c) => c.nombre === 'agua');
  if (agua && !agua.wa && Musica.aguaWA.buffer) {
    agua.wa = Musica.aguaWA;
    if (Sonido.activo) {
      const pos = agua.audio.currentTime;
      agua.audio.pause();
      agua.wa.arrancar(pos);
    }
  }
  for (const c of Sonido.capas) {
    if (c.grupo !== 'pájaros' || c.wa) continue;
    c.wa = capaWebAudio(c, Musica.pajarosBus, true);
    // Si ya estaba sonando por su <audio> (se prendió antes de que esto estuviera listo), se pasa
    if (c.encendido || !c.audio.paused) {
      c.wa.cargar().then(() => {
        c.audio.pause();
        if (c.encendido) c.wa.arrancar();
      });
    }
  }
}

// ---------- Pájaros que conversan ----------

// Busca dónde empieza y termina cada canto en una grabación: mide cuánto suena cada 10 ms y
// separa donde hay un silencio de más de 0,35 s (los silencitos entre las sílabas de una misma
// frase no la cortan). Devuelve [inicio, fin] en segundos (los largos, en pedazos de hasta 4 s).
function cortarCantos(buf) {
  const d = buf.getChannelData(0), ventana = Math.floor(buf.sampleRate * 0.01);
  const n = Math.floor(d.length / ventana), nivel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * ventana; j < (i + 1) * ventana; j++) s += d[j] * d[j];
    nivel[i] = Math.sqrt(s / ventana);
  }
  const orden = Float32Array.from(nivel).sort();
  const piso = orden[Math.floor(n * 0.3)], pico = orden[Math.floor(n * 0.995)];
  const umbral = Math.max(piso * 2.5, piso + (pico - piso) * 0.18);
  const cantos = [];
  let ini = -1, quieto = 0;
  const cerrar = (fin) => { if (fin - ini >= 20) cantos.push([Math.max(0, ini - 2) * 0.01, Math.min(fin + 4, n) * 0.01]); ini = -1; };
  for (let i = 0; i < n; i++) {
    if (nivel[i] > umbral) { if (ini < 0) ini = i; quieto = 0; }
    else if (ini >= 0 && ++quieto > 35) { cerrar(i - quieto + 1); quieto = 0; }   // 350 ms de silencio
  }
  if (ini >= 0) cerrar(n);
  const res = [];
  for (const [a, b] of cantos) for (let t = a; t < b; t += 4) res.push([t, Math.min(b, t + 4)]);
  if (!res.length) for (let t = 0; t < buf.duration - 1.3; t += 1.5) res.push([t, t + 1.2]);
  return res;
}

// Un canto suelto, que se mueve un poco de lado mientras suena (y se ve en los sauces)
function cantarAve(c, cuando) {
  const ctx = Musica.ctx, wa = c.wa;
  const [a, b] = wa.cantos[Math.floor(Math.random() * wa.cantos.length)];
  const dur = b - a, t = Math.max(cuando, ctx.currentTime + 0.01);
  const s = ctx.createBufferSource();
  s.buffer = wa.buffer;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.01);
  env.gain.setValueAtTime(1, Math.max(t + 0.02, t + dur - 0.04));
  env.gain.linearRampToValueAtTime(0, t + dur);
  // Saltos: en el planetario el anillo está intercalado (D I D I D I D I), así que pasar de un
  // canal al otro hace saltar el canto entre parlantes vecinos, como un pájaro que se mueve entre
  // los árboles. "saltos" es cuánto (0 = quieto y parejo en todo el anillo). Cada salto tiene un
  // cruce cortito para que no haga clic.
  const lado = ctx.createStereoPanner();
  const ancho = Math.max(0, Math.min(1, CONFIG.musica.pajaros.saltos));
  let p = Math.random() < 0.5 ? -ancho : ancho;
  const p0 = p;
  lado.pan.setValueAtTime(p, t);
  for (let u = t + 0.18 + Math.random() * 0.3; u < t + dur - 0.05 && ancho > 0; u += 0.18 + Math.random() * 0.4) {
    lado.pan.setValueAtTime(p, u);
    p = -p;
    lado.pan.linearRampToValueAtTime(p, u + 0.03);
  }
  const p1 = p;
  s.connect(env); env.connect(lado); lado.connect(wa.gain);
  s.start(t, a, dur + 0.01);
  if (typeof sauceCanto === 'function') sauceCanto(p0, p1, t - ctx.currentTime, dur);
  return t + dur;
}

// La conversación: canta uno y le contesta otro de los prendidos, y así en una ronda de 2 a 5
// turnos; después, un silencio y otra ronda. "charla" acorta los silencios, hace las rondas más
// largas y a veces dos se pisan. Con uno solo prendido, canta solo cada tanto.
function actualizarAves(ctx, dt) {
  const A = CONFIG.musica.pajaros, ahora = ctx.currentTime;
  // El pulso de los pájaros: el del puente si el golpe está prendido, si no el propio
  const conPuente = CONFIG.musica.pulso.activo && CONFIG.puente && CONFIG.puente.bpm > 0;
  const bpm = conPuente ? CONFIG.puente.bpm : Math.max(20, A.tempo);
  Musica.faseAves = conPuente ? Musica.fase : Musica.faseAves + dt * bpm / 60;
  const aves = Sonido.capas.filter((c) => c.grupo === 'pájaros' && c.wa);
  for (const c of aves) {
    const wa = c.wa;
    // Si se cambia entre loop y conversación con pájaros prendidos
    if (wa.sonando && wa.buffer) {
      if (A.conversacion && wa.src) { wa.src.stop(); wa.src.disconnect(); wa.src = null; }
      else if (!A.conversacion && !wa.src) wa.arrancar();
    }
  }
  const listos = A.conversacion ? aves.filter((c) => c.encendido && c.wa.sonando && c.wa.cantos) : [];
  const ch = Musica.charla || (Musica.charla = { proximo: 0, ultimo: null, quedan: 0, cuantos: 0 });
  if (!listos.length) { ch.proximo = 0; ch.ultimo = null; ch.quedan = 0; ch.cuantos = 0; return; }
  // Alguien nuevo se sumó: que arranque enseguida (no espera a que termine el silencio)
  if (listos.length > ch.cuantos) ch.proximo = Math.min(ch.proximo, ahora + 0.3);
  ch.cuantos = listos.length;
  if (ahora < ch.proximo) return;

  // Quién canta: en la ronda le contesta otro (nunca el mismo dos veces seguidas, si hay más)
  const otros = listos.filter((c) => c !== ch.ultimo);
  const quien = (otros.length ? otros : listos)[Math.floor(Math.random() * (otros.length || listos.length))];
  let cuando = ahora;
  if (A.aTiempo) {   // al próximo medio pulso
    const f = Musica.faseAves * 2;
    cuando = ahora + (Math.ceil(f) - f) * 30 / bpm;
  }
  if (ch.quedan <= 0) ch.quedan = 2 + Math.floor(Math.random() * (2 + 3 * A.charla));   // turnos de esta ronda
  const fin = cantarAve(quien, cuando);
  ch.ultimo = quien;
  ch.quedan--;
  // Con mucha charla, a veces otro se mete encima
  const resto = listos.filter((c) => c !== quien);
  if (resto.length && Math.random() < 0.3 * A.charla) {
    cantarAve(resto[Math.floor(Math.random() * resto.length)], cuando + 0.15 + Math.random() * 0.5);
  }
  if (ch.quedan > 0 && listos.length > 1) {
    // La respuesta: enseguida, a veces apenas encima del final
    ch.proximo = fin - 0.15 + Math.random() * (0.9 - 0.6 * A.charla);
  } else {
    // Fin de la ronda: un silencio (largo con poca charla, corto con mucha)
    ch.proximo = fin + (1 + 9 * (1 - A.charla)) * (0.6 + Math.random() * 0.8);
  }
}

// ---------- El río ----------

// El río que canta: el agua (o, si la grabación no se puede leer, un ruido parecido) pasa por
// filtros muy finos afinados en las notas del acorde del momento del día: el agua "suena" esas
// notas. Debajo, un grave profundo en la nota más baja. Las notas tiemblan con la agitación de
// las cáusticas y, con conCausticas, suena cuanto se ve el río marrón.
function crearRioQueCanta(ctx, bus) {
  Musica.rioBus = bus(0.7);
  const lado = ctx.createStereoPanner();   // va al revés que el agua: se cruzan
  lado.connect(Musica.rioBus);
  Musica.rioLado = lado;
  // Ruido de respaldo (por si no hay grabación): rosa, en loop
  const n = ctx.sampleRate * 4, ruido = ctx.createBuffer(1, n, ctx.sampleRate), d = ruido.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
    d[i] = (b0 + b1 + b2 + w * 0.02) * 0.6;
  }
  const fuente = ctx.createBufferSource();
  fuente.buffer = ruido; fuente.loop = true; fuente.start();
  Musica.rioRuido = ctx.createGain();
  fuente.connect(Musica.rioRuido);
  Musica.rioEntrada = ctx.createGain();
  Musica.rioRuido.connect(Musica.rioEntrada);
  Musica.rioVoces = COLCHON_ACORDES.noche.map((nota, i) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 45; f.frequency.value = midiAFrecuencia(nota);
    const g = ctx.createGain(); g.gain.value = 0;
    Musica.rioEntrada.connect(f); f.connect(g); g.connect(lado);
    return { f, g, fase: i * 1.7 };
  });
  // El grave profundo: una sinusoide en la nota más baja del acorde
  const grave = ctx.createOscillator();
  grave.type = 'sine'; grave.frequency.value = midiAFrecuencia(COLCHON_ACORDES.noche[0]);
  Musica.rioGrave = ctx.createGain(); Musica.rioGrave.gain.value = 0;
  grave.connect(Musica.rioGrave); Musica.rioGrave.connect(Musica.rioBus);
  grave.start();
  Musica.rioGraveOsc = grave;
  Musica.faseAgua = 0; Musica.faseRio = 0;

  // Más agua: burbujas y chapoteo (con ruido blanco propio)
  Musica.burbujasBus = bus(0.4, 0.1);
  Musica.chapoteoBus = bus(0.3);
  const nb = ctx.sampleRate, blanco = ctx.createBuffer(1, nb, ctx.sampleRate), db = blanco.getChannelData(0);
  for (let i = 0; i < nb; i++) db[i] = Math.random() * 2 - 1;
  Musica.ruidoBlanco = blanco;

  // El barco constante: la misma bocina, pero sostenida y lejana, en la nota más baja del acorde
  // del momento (una octava arriba), así combina con el colchón y el canto del río
  Musica.barcoBus = bus(0.9, 0.25);
  const lejos = ctx.createBiquadFilter();
  lejos.type = 'lowpass'; lejos.frequency.value = 650;
  lejos.connect(Musica.barcoBus);
  Musica.barcoFiltro = lejos;
  Musica.barcoOsc = [[1, 0.5, 0], [1, 0.5, 9], [1.5, 0.25, 0]].map(([mult, v, cents]) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.detune.value = cents;
    o.frequency.value = midiAFrecuencia(COLCHON_ACORDES.noche[0] + 12) * mult;   // ya afinado al arrancar
    const g = ctx.createGain(); g.gain.value = v * 0.3;
    o.connect(g); g.connect(lejos);
    o.start();
    return { o, mult };
  });
}

function actualizarRio(ctx, m, dt, agitacion) {
  const R = CONFIG.musica.rio, t = ctx.currentTime;
  // Cuán agitadas están las cáusticas (0 a 1): mueve más rápido el agua y hace temblar las notas
  const agit = Math.max(0, Math.min(1, agitacion / 3));
  // El agua va y viene entre los parlantes (con el anillo intercalado, rodea el domo)
  Musica.faseAgua += dt * (0.04 + 0.22 * agit);
  const pan = R.mover * Math.sin(Musica.faseAgua * Math.PI * 2);
  Musica.aguaLado.pan.setTargetAtTime(pan, t, 0.1);
  Musica.rioLado.pan.setTargetAtTime(-pan * 0.7, t, 0.1);
  // Las olas: el agua crece cuando llega a un lado y baja en el medio (el doble de rápido que el
  // vaivén, así cada ida y cada vuelta es una ola)
  const ola = 0.5 - 0.5 * Math.cos(Musica.faseAgua * Math.PI * 4);
  Musica.aguaOla.gain.setTargetAtTime(1 - 0.75 * R.olas * (1 - ola), t, 0.1);
  // De dónde canta: la grabación del agua si se pudo cargar; si no, el ruido de respaldo
  const agua = Musica.aguaWA;
  if (agua && agua.crudo && agua.src && !Musica.rioConAgua) {
    agua.crudo.connect(Musica.rioEntrada);
    Musica.rioRuido.gain.setTargetAtTime(0, t, 1);
    Musica.rioConAgua = true;
  }
  // Cuánto canta
  const cuanto = R.canta ? R.volumen * m * (R.conCausticas ? escenaVisible('rioReal', 'rioMarron') : 1) : 0;
  Musica.rioBus.gain.setTargetAtTime(cuanto, t, 0.8);
  const acorde = COLCHON_ACORDES[estado.momento] || Musica.rioAcorde || COLCHON_ACORDES.noche;
  Musica.rioAcorde = acorde;
  Musica.faseRio += dt * (0.15 + 1.2 * agit);
  Musica.rioVoces.forEach((v, i) => {
    v.f.frequency.setTargetAtTime(midiAFrecuencia(acorde[i]), t, 3);
    // Cada nota respira a su ritmo, más rápido con las cáusticas agitadas (las graves, más fuertes)
    const resp = 0.65 + 0.35 * Math.sin(Musica.faseRio * (0.7 + i * 0.23) + v.fase);
    v.g.gain.setTargetAtTime(14 * resp * (1.25 - i * 0.12), t, 0.15);
  });
  Musica.rioGraveOsc.frequency.setTargetAtTime(midiAFrecuencia(acorde[0]), t, 3);
  Musica.rioGrave.gain.setTargetAtTime(0.25 * R.profundo, t, 0.5);

  // El barco constante: respira despacio (como un barco lejano que el viento acerca y aleja)
  const respira = 0.75 + 0.25 * Math.sin(t * 0.13);
  Musica.barcoBus.gain.setTargetAtTime(R.barco * m * 0.45 * respira * escenaVisible('rioReal', 'rioMarron'), t, 0.3);
  Musica.barcoFiltro.frequency.setTargetAtTime(520 + 220 * Math.sin(t * 0.07), t, 0.5);
  const base = midiAFrecuencia(acorde[0] + 12);
  for (const b of Musica.barcoOsc) b.o.frequency.setTargetAtTime(base * b.mult, t, 3);
}

// Un barco grande que pasa a lo lejos: un toque largo y uno corto, grave, con mucho espacio
function tocarBocina() {
  const ctx = Musica.ctx;
  if (!ctx) return;
  const R = CONFIG.musica.rio;
  const m = Sonido.cfg ? (Sonido.cfg.silencio ? 0 : Sonido.cfg.maestro) : 1;
  const salida = ctx.createGain();
  salida.gain.value = R.bocina * m * 0.5;
  const lejos = ctx.createBiquadFilter();
  lejos.type = 'lowpass'; lejos.frequency.value = 700;
  lejos.connect(salida);
  salida.connect(Musica.final);
  const esp = ctx.createGain(); esp.gain.value = 1.2; salida.connect(esp); esp.connect(Musica.envioEspacio);
  const eco = ctx.createGain(); eco.gain.value = 0.35; salida.connect(eco); eco.connect(Musica.envioEco);
  const toque = (desde, dura) => {
    const t = ctx.currentTime + desde;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.35);
    env.gain.setValueAtTime(1, t + dura);
    env.gain.linearRampToValueAtTime(0, t + dura + 1.2);
    env.connect(lejos);
    for (const [f, v] of [[98, 0.5], [98.7, 0.5], [147, 0.25]]) {   // sol grave, apenas desafinado, y su quinta
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = v * 0.3;
      o.connect(g); g.connect(env);
      o.start(t); o.stop(t + dura + 1.3);
    }
  };
  toque(0, 3);
  toque(4.6, 1.2);
}

// ---------- Más agua: burbujas y chapoteo ----------

// Una burbuja (o un gorgoteo de 2 a 4): un "plic" que sube de tono y se apaga enseguida
function burbujaRio() {
  const ctx = Musica.ctx, t = ctx.currentTime + 0.01;
  const lado = ctx.createStereoPanner();
  lado.pan.value = Math.random() * 1.6 - 0.8;
  lado.connect(Musica.burbujasBus);
  const n = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 3) : 1;
  let t0 = t;
  for (let i = 0; i < n; i++) {
    const f0 = 350 + Math.random() * 900, dur = 0.04 + Math.random() * 0.06;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.6 + Math.random() * 0.8), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(lado);
    o.start(t0); o.stop(t0 + dur + 0.02);
    t0 += 0.04 + Math.random() * 0.08;
  }
}

// Un chapoteo: agua que golpea la orilla (ruido filtrado que sube y se apaga)
function chapoteoRio(fuerza) {
  const ctx = Musica.ctx, t = ctx.currentTime + 0.01;
  const dur = 0.5 + Math.random() * 0.6;
  const s = ctx.createBufferSource();
  s.buffer = Musica.ruidoBlanco;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass'; filtro.Q.value = 0.9;
  filtro.frequency.setValueAtTime(450 + Math.random() * 400, t);
  filtro.frequency.linearRampToValueAtTime(1200 + Math.random() * 800, t + dur * 0.4);
  filtro.frequency.linearRampToValueAtTime(600, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.45 * fuerza, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lado = ctx.createStereoPanner();
  lado.pan.value = Math.random() * 1.4 - 0.7;
  s.connect(filtro); filtro.connect(g); g.connect(lado); lado.connect(Musica.chapoteoBus);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}

function actualizarMasAgua(ctx, m, dt, agit) {
  const R = CONFIG.musica.rio, t = ctx.currentTime;
  const rios = escenaVisible('rioReal', 'rioMarron');
  const revuelo = Math.max(0, Math.min(1, estado.revuelo || 0));
  Musica.burbujasBus.gain.setTargetAtTime(R.burbujas ? R.burbujasVol * m * rios : 0, t, 0.3);
  Musica.chapoteoBus.gain.setTargetAtTime(R.chapoteo ? R.chapoteoVol * m * rios : 0, t, 0.3);
  if (rios < 0.01) return;
  // Burbujas: cada tanto, más seguidas con el agua revuelta
  if (R.burbujas && Math.random() < (0.35 + 1.8 * revuelo + 0.8 * agit) * dt) burbujaRio();
  if (!R.chapoteo) return;
  // Chapoteo: cada vez que llega una ola del vaivén, y algunos sueltos (más con el agua revoltosa)
  const ola = Math.floor(Musica.faseAgua * 2);
  if (Musica.ultimaOla !== undefined && ola !== Musica.ultimaOla) chapoteoRio(0.6 + 0.4 * revuelo);
  Musica.ultimaOla = ola;
  if (Math.random() < (0.12 + 1.2 * revuelo) * dt) chapoteoRio(0.25 + 0.5 * revuelo * Math.random());
}

// ---------- Congelar ----------

function actualizarCongelar(ctx, m) {
  const K = CONFIG.musica.congelar, t = ctx.currentTime;
  const agua = Musica.aguaWA, listo = agua && agua.buffer;
  Musica.congelarBus.gain.setTargetAtTime(K.activo && listo ? K.volumen * m * escenaVisible('rioReal', 'rioMarron') : 0, t, 0.3);
  if (!K.activo || !listo) { Musica.congelando = false; return; }
  if (!Musica.congelando) {
    // Se queda con el pedacito que está sonando ahora
    Musica.congelando = true;
    Musica.congelarPos = Math.min(agua.posicion(), agua.buffer.duration - 0.6);
    Musica.proximoGrano = t;
  }
  if (Musica.proximoGrano < t - 0.2) Musica.proximoGrano = t;   // si la pestaña estuvo quieta
  const velocidad = Math.pow(2, (K.tono - 0.5) * 2);   // una octava abajo a una arriba
  const dur = 0.22;
  while (Musica.proximoGrano < t + 0.12) {
    const inicio = Math.max(Musica.proximoGrano, t);
    const s = ctx.createBufferSource();
    s.buffer = agua.buffer;
    s.playbackRate.value = velocidad;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, inicio);
    g.gain.linearRampToValueAtTime(0.35, inicio + dur / 2);
    g.gain.linearRampToValueAtTime(0, inicio + dur);
    s.connect(g); g.connect(Musica.congelarBus);
    const desde = Math.max(0, Musica.congelarPos + (Math.random() - 0.5) * 0.08);
    s.start(inicio, desde, dur * velocidad + 0.01);
    Musica.proximoGrano += 0.055;
  }
}

// ---------- Cada cuadro ----------

function actualizarMusica(dt, agitacion = 1) {
  const ctx = Musica.ctx;
  if (!ctx) return;
  const M = CONFIG.musica, t = ctx.currentTime;
  // El volumen general y el silencio de la carpeta Sonido valen también para la música
  const m = Sonido.cfg ? (Sonido.cfg.silencio ? 0 : Sonido.cfg.maestro) : 1;
  Musica.espacioSalida.gain.setTargetAtTime(M.espacio, t, 0.1);
  Musica.aguaFiltro.frequency.setTargetAtTime(180 * Math.pow(2, M.agua.filtro * 6.8), t, 0.05);
  Musica.aguaFiltro.Q.setTargetAtTime(0.7 + 3 * (1 - M.agua.filtro), t, 0.05);
  Musica.pajarosEco.gain.setTargetAtTime(M.pajaros.eco * 0.8, t, 0.05);
  Musica.fichas = Math.min(3, Musica.fichas + dt * M.gotas.cantidad * 14);
  Musica.gotasBus.gain.setTargetAtTime(M.gotas.activo ? M.gotas.volumen * m * escenaVisible('tormenta') : 0, t, 0.1);
  actualizarColchon(ctx, m);
  actualizarPulso(ctx, m, dt);
  actualizarCongelar(ctx, m);
  pasarAWebAudio(ctx);
  actualizarAves(ctx, dt);
  actualizarRio(ctx, m, dt, agitacion);
  actualizarMasAgua(ctx, m, dt, Math.max(0, Math.min(1, agitacion / 3)));
}

// ---------- Panel ----------

function musicaPanel(gui) {
  const M = CONFIG.musica;
  const f = gui.addFolder('Música');
  f.add(Musica, 'grabaciones').name('grabaciones').listen().disable();
  f.add(M, 'espacio', 0, 1, 0.01).name('espacio (reverberación)');
  if (Sonido.cfg) {
    if (Sonido.cfg.siguenEscenas === undefined) Sonido.cfg.siguenEscenas = true;
    f.add(Sonido.cfg, 'siguenEscenas').name('los sonidos siguen a las escenas');
  }
  const c = f.addFolder('colchón');
  c.add(M.colchon, 'activo').name('prender colchón').listen();
  c.add(M.colchon, 'volumen', 0, 1, 0.01).name('volumen').listen();
  c.add(M.colchon, 'brillo', 0, 1, 0.01).name('brillo (filtro)').listen();
  const g = f.addFolder('gotas');
  g.add(M.gotas, 'activo').name('las gotas suenan (con lluvia)').listen();
  g.add(M.gotas, 'volumen', 0, 1, 0.01).name('volumen').listen();
  g.add(M.gotas, 'cantidad', 0, 1, 0.01).name('cuántas notas').listen();
  const p = f.addFolder('pulso');
  p.add(M.pulso, 'activo').name('golpe con los pulsos del puente').listen();
  p.add(M.pulso, 'volumen', 0, 1, 0.01).name('volumen').listen();
  p.add(M.pulso, 'cola', 0, 1, 0.01).name('seco ↔ largo').listen();
  const a = f.addFolder('agua');
  a.add(M.agua, 'filtro', 0, 1, 0.01).name('bajo el agua ↔ abierta').listen();
  const pj = f.addFolder('pájaros');
  if (Sonido.cfg) {
    if (Sonido.cfg.todosPajaros === undefined) Sonido.cfg.todosPajaros = 1;
    pj.add(Sonido.cfg, 'todosPajaros', 0, 1, 0.01).name('volumen de todos los pájaros').listen();
  }
  pj.add(M.pajaros, 'eco', 0, 1, 0.01).name('eco de la botonera').listen();
  pj.add(M.pajaros, 'conversacion').name('conversan (si no, cada uno en loop)').listen();
  pj.add(M.pajaros, 'charla', 0, 1, 0.01).name('cuánto charlan').listen();
  pj.add(M.pajaros, 'saltos', 0, 1, 0.01).name('saltos entre parlantes').listen();
  pj.add(M.pajaros, 'aTiempo').name('a tiempo (sobre el pulso)').listen();
  pj.add(M.pajaros, 'tempo', 40, 180, 1).name('pulso propio (por minuto)').listen();
  const ri = f.addFolder('río');
  ri.add(M.rio, 'mover', 0, 1, 0.01).name('el agua va y viene entre parlantes').listen();
  ri.add(M.rio, 'canta').name('el río canta (notas profundas)').listen();
  ri.add(M.rio, 'volumen', 0, 1, 0.01).name('volumen del canto').listen();
  ri.add(M.rio, 'profundo', 0, 1, 0.01).name('grave profundo').listen();
  ri.add(M.rio, 'conCausticas').name('canta solo con los ríos a la vista').listen();
  ri.add(M.rio, 'olas', 0, 1, 0.01).name('olas (el agua crece y baja)').listen();
  ri.add(M.rio, 'burbujas').name('burbujas').listen();
  ri.add(M.rio, 'burbujasVol', 0, 1, 0.01).name('volumen de las burbujas').listen();
  ri.add(M.rio, 'chapoteo').name('chapoteo de las olas').listen();
  ri.add(M.rio, 'chapoteoVol', 0, 1, 0.01).name('volumen del chapoteo').listen();
  ri.add(M.rio, 'barco', 0, 1, 0.01).name('🚢 barco constante (volumen)').listen();
  ri.add(M.rio, 'bocina', 0, 1, 0.01).name('volumen del toque de bocina').listen();
  ri.add({ tocarBarco: tocarBocina }, 'tocarBarco').name('🚢 toque de bocina');
  const k = f.addFolder('congelar');
  k.add(M.congelar, 'activo').name('congelar el río').listen();
  k.add(M.congelar, 'volumen', 0, 1, 0.01).name('volumen').listen();
  k.add(M.congelar, 'tono', 0, 1, 0.01).name('más grave ↔ más agudo').listen();
  f.close();
}
