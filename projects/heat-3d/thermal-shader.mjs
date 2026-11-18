import {heatmapFragmentShader} from './vendor/heatmap.js';
// Adaptation of Paper Heatmap 0.0.82 (Apache-2.0). Original color/blur pipeline retained.
export const fragment=heatmapFragmentShader.replace('uniform float u_contour;',`uniform float u_contour;
uniform vec2 u_heatPoint;
uniform float u_heatActive;
uniform float u_heatRadius;
uniform float u_heatPower;
uniform mediump vec2 u_resolution;`).replace('heat += (.005',`vec2 screenUV = gl_FragCoord.xy / u_resolution;
  screenUV.y = 1. - screenUV.y;
  vec2 delta = screenUV - u_heatPoint;
  delta.x *= u_resolution.x / u_resolution.y;
  float distanceToHand = length(delta);
  float falloff = exp(-2.2 * pow(distanceToHand / u_heatRadius, 2.));
  float wave = .88 + .12 * cos(22. * distanceToHand - u_time * 2.4);
  float silhouette = clamp((1. - shape) * u_innerGlow * 2. + outerBlur * 5. * pow(u_outerGlow, 2.), 0., 1.);
  float handHeat = clamp(falloff * wave * u_heatPower * (silhouette * (.8 + .2 * heat) + u_contour * contour * (1. - shape)), 0., 1.);
  if (u_heatActive >= 0.) heat = mix(heat * .16, handHeat, u_heatActive);
  heat += (.005`);
