// El shader completo: lo común, las cáusticas y main().
// Necesita cargados antes comun.js y causticas.js.

const FRAG = GLSL_COMUN + GLSL_CAUSTICAS + `
void main() {
  vec3 col = causticas();

  // Un poquito de grano para que no se vean escalones en el proyector
  col += (hash(gl_FragCoord.xy + fract(uFase * 7.0)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;
