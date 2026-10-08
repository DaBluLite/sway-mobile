/** Shared SkSL source. Native uses it directly; the web adapter translates vector types to GLSL. */
export const AURA_SHADER = `
uniform float2 resolution;
uniform float time;
uniform float intensity;
uniform float spread;
uniform float radius;

float roundedBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, float2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

float3 greenPalette(float phase) {
  // Tailwind v3 green-800, green-600, green-400 and green-200, in sRGB.
  float3 forest = float3(0.086275, 0.396078, 0.203922);
  float3 green = float3(0.086275, 0.639216, 0.290196);
  float3 fresh = float3(0.290196, 0.870588, 0.501961);
  float3 mint = float3(0.733333, 0.968627, 0.815686);
  float f = 0.5 + 0.5 * sin(phase);
  float3 c = mix(forest, green, smoothstep(0.0, 0.4, f));
  c = mix(c, fresh, smoothstep(0.3, 0.75, f));
  return mix(c, mint, smoothstep(0.75, 1.0, f));
}

half4 main(float2 xy) {
  // Hard boundary ensures absolutely no light in the upper half.
  if (xy.y <= resolution.y * 0.5) return half4(0.0);
  float2 center = resolution * 0.5;
  float r = min(radius, min(resolution.x, resolution.y) * 0.49);
  float sd = roundedBox(xy - center, center - float2(2.5), r);
  float d = max(-sd, 0.0);
  float fade = smoothstep(resolution.y * 0.5, resolution.y * 0.68, xy.y);
  float outer = 1.0 - smoothstep(0.0, 2.5, sd);
  float2 p = xy / min(resolution.x, resolution.y);
  float wave = sin(p.x * 7.0 + p.y * 5.0 - time * 0.8)
    + 0.45 * sin(p.x * 13.0 - p.y * 9.0 + time * 1.1)
    + 0.22 * sin(p.x * 27.0 + p.y * 17.0 - time * 0.5);
  float breath = 0.72 + 0.28 * sin(time * 0.65 + p.x * 4.0 - p.y * 3.0);
  float width = spread * (0.72 + 0.2 * wave);
  float coreWidth = 1.35 + 0.5 * (0.5 + 0.5 * sin(p.x * 10.0 + p.y * 8.0 - time));
  float core = exp(-pow((d - 0.65 - wave * 0.28) / coreWidth, 2.0));
  float halo = exp(-d / max(width * 0.44, 1.0));
  float mist = exp(-pow(d / max(width, 1.0), 1.5));
  float ribbons = 0.5 + 0.5 * sin(d * 0.18 + wave * 2.0 - time * 0.65);
  float bloom = halo * 0.48 + mist * (0.07 + ribbons * 0.11) * breath;
  float strength = (core * 0.95 + bloom) * fade * outer * intensity;
  float alpha = clamp(strength, 0.0, 0.98);
  float3 c = greenPalette(p.x * 4.0 - p.y * 6.0 + wave * 0.6 - time * 0.6);
  c = mix(c, float3(0.862745, 0.988235, 0.905882), core * 0.55);
  // Skia and the browser both expect premultiplied alpha.
  return half4(c * alpha, alpha);
}
`;

export const WEB_FRAGMENT_SHADER = `precision highp float;\nuniform float pixelRatio;\n${AURA_SHADER
  .replaceAll('float2', 'vec2').replaceAll('float3', 'vec3').replaceAll('half4', 'vec4')
  .replace('vec4 main(vec2 xy)', 'vec4 aura(vec2 xy)')}
void main() { gl_FragColor = aura(vec2(gl_FragCoord.x / pixelRatio, resolution.y - gl_FragCoord.y / pixelRatio)); }`;

export const AURA_PRESETS = {
  stillwater: { name: 'Stillwater', description: 'A quiet, slow-moving glow.', intensity: 0.7, spread: 46, speed: 0.35 },
  flow: { name: 'Flow', description: 'Soft waves. A little more life.', intensity: 1.05, spread: 64, speed: 0.8 },
  borealis: { name: 'Borealis', description: 'Bright ribbons of northern light.', intensity: 1.45, spread: 90, speed: 1.4 },
} as const;

export type AuraPreset = keyof typeof AURA_PRESETS;
export function safeNumber(value: number, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
