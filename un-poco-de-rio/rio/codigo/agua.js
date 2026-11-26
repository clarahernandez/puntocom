// Las olas y todo lo que se le pasa al shader en cada cuadro.

// Las olas de la versión domo de solo-agua: dos escalas, sin arrugas finas, que dan
// líneas de luz anchas y limpias. Salen de la semilla: otra semilla = otro dibujo.
function generarOndas() {
  const r = mulberry32(CONFIG.agua.semilla);
  ondas = [];
  for (let i = 0; i < NUM_ONDAS; i++) {
    const grande = i < NUM_ONDAS / 2;
    ondas.push({
      giro: (r() * 2 - 1) * (grande ? 1 : 1.5),    // relativo a la apertura
      k: grande ? 14 + r() * 10 : 30 + r() * 25,
      amp: grande ? 1 : 0.55,
      des: r() * TWO_PI,
    });
  }
  // Normalizar para que "agitación" signifique lo mismo con cualquier semilla
  const energia = Math.sqrt(ondas.reduce((s, o) => s + o.amp * o.amp, 0) / 2);
  for (const o of ondas) o.amp /= energia;
  generarOndasPlaya();   // las de la capa río real (capa-rio-real.js), de la misma semilla
}

// Fase de cada onda: se va sumando cuadro a cuadro según la velocidad de ahora, así
// mover la velocidad (o el revuelo, la escala o la duración) la acelera o la frena
// sin que la imagen salte.
const fasesOndas = [];
function avanzarOndas(o, dt) {
  // En el domo todo se ve más rápido (la imagen es enorme), por eso va más lento
  const vel = o.velocidad * (DOMO ? CONFIG.domo.velocidad : 1);
  ondas.forEach((onda, i) => {
    const vueltasPorSegundo = 1.4 * Math.sqrt(onda.k * CONFIG.agua.escala) * vel / 60;
    fasesOndas[i] = ((fasesOndas[i] || 0) + dt * TWO_PI * vueltasPorSegundo) % TWO_PI;
  });
}

// Pasa al shader las olas: dirección, frecuencia, curvatura, fase y desfase
function pasarOndas(o) {
  const A = CONFIG.agua;
  const dx = [], dy = [], k = [], amp = [], fase = [], des = [];
  ondas.forEach((onda, i) => {
    const ang = radians(A.rumbo) + onda.giro * radians(A.apertura);
    const kk = onda.k * A.escala;
    dx.push(Math.cos(ang));
    dy.push(Math.sin(ang));
    k.push(kk * 0.35);
    amp.push(onda.amp * o.altura);   // más altas cuanto más revuelta (oleaje.js)
    fase.push(fasesOndas[i] || 0);
    des.push(onda.des);
  });
  shaderAgua.setUniform('uCDx', dx);
  shaderAgua.setUniform('uCDy', dy);
  shaderAgua.setUniform('uCK', k);
  shaderAgua.setUniform('uCAmp', amp);
  shaderAgua.setUniform('uCFase', fase);
  shaderAgua.setUniform('uCDes', des);
}

// m: el momento del día (cielo.js); o: el oleaje de ahora (oleaje.js);
// agitacion: cuánto se curva el agua
function dibujarAgua(m, o, agitacion) {
  const A = CONFIG.agua, C = CONFIG.causticas;

  agua.shader(shaderAgua);
  pasarGotas(shaderAgua);
  shaderAgua.setUniform('uRes', [agua.width, agua.height]);
  shaderAgua.setUniform('uDomo', DOMO ? 1 : 0);
  // Las olas siguen el reloj (no el momento del día), así se mueven también en la pausa
  shaderAgua.setUniform('uFase', TWO_PI * estado.reloj / duracionLoop());

  // Olas
  pasarOndas(o);
  shaderAgua.setUniform('uCorriente', A.corriente);
  shaderAgua.setUniform('uOrganico', CONFIG.estilo.organico);
  shaderAgua.setUniform('uProfundidad', o.profundidad);

  // Tormenta
  shaderAgua.setUniform('uGotas', CONFIG.tormenta.gotas);
  shaderAgua.setUniform('uCubierto', estado.nublado);

  // Cómo se ven
  shaderAgua.setUniform('uDCau', 1.5 * Math.max(0, agitacion));
  shaderAgua.setUniform('uNitidez', A.nitidez);
  shaderAgua.setUniform('uDispersion', A.dispersion);
  shaderAgua.setUniform('uCauEscala', C.escala);
  shaderAgua.setUniform('uCauBrillo', C.brillo);
  shaderAgua.setUniform('uCauContraste', C.contraste);
  shaderAgua.setUniform('uCauCapas', C.capas);
  shaderAgua.setUniform('uBorde', CONFIG.estilo.borde);
  // De día el marrón del río, de noche más oscuro; cambia despacio con la altura del sol
  const dia = suave(-0.25, 0.3, m.sol[1]);
  const fNoche = hexARgb(C.fondoNoche);
  shaderAgua.setUniform('uCauFondo', hexARgb(C.fondo).map((v, n) => lerp(fNoche[n], v, dia)));
  // De dónde viene la luz y cuánta hay (cielo.js)
  const luz = direccionDeLaLuz(m);
  shaderAgua.setUniform('uLuzDir', luz.dir);
  shaderAgua.setUniform('uLuzFuerza', luz.fuerza);
  shaderAgua.setUniform('uCrestas', C.crestas);
  shaderAgua.setUniform('uSombra', C.sombra);
  shaderAgua.setUniform('uCauMetal', C.metal * m.metal);
  shaderAgua.setUniform('uCauLuzMetal', luzDelMetal(estado.progreso));
  shaderAgua.setUniform('uCauCielo', C.cielo);
  shaderAgua.setUniform('uCauColCielo', hexARgb(C.colorCielo));
  // La luz siempre al máximo: se estira el color hasta que su canal más alto vale 1
  const fija = hexARgb(C.luz);
  const luzCau = fija.map((v, n) => lerp(v, m.luz[n], C.ciclo));
  const tope = Math.max(...luzCau, 0.001);
  shaderAgua.setUniform('uCauLuz', luzCau.map((v) => v / tope));

  agua.rect(-agua.width / 2, -agua.height / 2, agua.width, agua.height);
}
