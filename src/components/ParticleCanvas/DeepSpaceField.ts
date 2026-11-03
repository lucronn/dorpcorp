import * as BABYLON from "@babylonjs/core";

/** Persistent distant stars plus a sparse, world-anchored foreground field.
 * The latter supplies translation parallax even while the composition is hidden.
 * Remapping never changes either field; wrapping happens beyond the visible fade. */
export class DeepSpaceField {
  readonly mesh: BABYLON.Mesh;
  private material: BABYLON.ShaderMaterial;

  constructor(scene: BABYLON.Scene) {
    const count = 7000;
    const positions: number[] = [], colors: number[] = [], parallax: number[] = [];
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere: deterministic and evenly populated, including the poles.
      const y = 1 - 2 * (i + 0.5) / count;
      const r = Math.sqrt(1 - y * y), angle = i * 2.399963229728653;
      positions.push(Math.cos(angle) * r * 24000, y * 24000, Math.sin(angle) * r * 24000);
      const brightness = 0.45 + ((i * 73) % 101) / 110;
      colors.push(brightness * (i % 3 === 0 ? 0.78 : 1), brightness * 0.92,
        brightness * (i % 3 === 1 ? 0.75 : 1), i % 17 === 0 ? 3.0 : 1.8);
      parallax.push(0);
    }
    for (let i = 0; i < 1200; i++) {
      // Deterministic lattice jitter, independent of the mutable particle pool.
      for (const multiplier of [73, 239, 599]) positions.push(((i * multiplier + 31) % 1201) / 1201 * 12000 - 6000);
      colors.push(0.9, 1.05, 1.35, i % 9 === 0 ? 3.5 : 2.4);
      parallax.push(1);
    }
    this.mesh = new BABYLON.Mesh("deep-space-stars", scene);
    this.mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    this.mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    this.mesh.setVerticesData("parallax", parallax, false, 1);
    this.mesh.setIndices(Array.from({ length: parallax.length }, (_, i) => i));
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.material = new BABYLON.ShaderMaterial("deep-space-star-light", scene, {
      vertexSource: `precision highp float;
        attribute vec3 position; attribute vec4 color; attribute float parallax;
        uniform mat4 worldViewProjection; uniform vec3 uCameraPos;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec3 nearby = mod(position - uCameraPos + vec3(6000.0), vec3(12000.0)) - vec3(6000.0);
          float distanceToStar = length(nearby);
          vAlpha = mix(1.0, smoothstep(180.0, 650.0, distanceToStar) *
            (1.0 - smoothstep(4200.0, 5800.0, distanceToStar)), parallax);
          // Nearby stars grow during forward thrust; distant stars stay fixed.
          // Bound the sprites so close passes always leave open space visible.
          float perspectiveSize = clamp(2200.0 / max(distanceToStar, 1.0), 0.7, 2.6);
          vColor = color.rgb; gl_PointSize = min(7.0, color.a * mix(1.0, perspectiveSize, parallax));
          gl_Position = worldViewProjection * vec4(mix(position, nearby, parallax), 1.0); }`,
      fragmentSource: `precision highp float; varying vec3 vColor; varying float vAlpha;
        void main() { float r = length(gl_PointCoord - vec2(0.5));
          if (r > 0.5) discard;
          gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.1, 0.5, r))); }`,
    }, { attributes: ["position", "color", "parallax"], uniforms: ["worldViewProjection", "uCameraPos"], needAlphaBlending: true });
    this.material.fillMode = BABYLON.Material.PointListDrawMode;
    this.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
  }

  follow(camera: BABYLON.TargetCamera) {
    this.material.setVector3("uCameraPos", camera.position);
    this.mesh.position.copyFrom(camera.position);
    this.mesh.computeWorldMatrix(true);
  }

  get ready() { return this.mesh.isReady(true) && this.material.isReady(this.mesh); }
  dispose() { this.mesh.dispose(); this.material.dispose(); }
}
