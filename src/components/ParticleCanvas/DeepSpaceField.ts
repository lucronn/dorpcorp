import * as BABYLON from "@babylonjs/core";

/** Persistent stars in every direction. Only the camera translates this field;
 * scene remapping never changes its vertices, visibility, or brightness. */
export class DeepSpaceField {
  readonly mesh: BABYLON.Mesh;
  private material: BABYLON.ShaderMaterial;

  constructor(scene: BABYLON.Scene) {
    const count = 7000;
    const positions: number[] = [], colors: number[] = [];
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere: deterministic and evenly populated, including the poles.
      const y = 1 - 2 * (i + 0.5) / count;
      const r = Math.sqrt(1 - y * y), angle = i * 2.399963229728653;
      positions.push(Math.cos(angle) * r * 24000, y * 24000, Math.sin(angle) * r * 24000);
      const brightness = 0.25 + ((i * 73) % 101) / 160;
      colors.push(brightness * (i % 3 === 0 ? 0.78 : 1), brightness * 0.92,
        brightness * (i % 3 === 1 ? 0.75 : 1), i % 17 === 0 ? 2.4 : 1.5);
    }
    this.mesh = new BABYLON.Mesh("deep-space-stars", scene);
    this.mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    this.mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    this.mesh.setIndices(Array.from({ length: count }, (_, i) => i));
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.material = new BABYLON.ShaderMaterial("deep-space-star-light", scene, {
      vertexSource: `precision highp float;
        attribute vec3 position; attribute vec4 color;
        uniform mat4 worldViewProjection; varying vec3 vColor;
        void main() { vColor = color.rgb; gl_PointSize = color.a;
          gl_Position = worldViewProjection * vec4(position, 1.0); }`,
      fragmentSource: `precision highp float; varying vec3 vColor;
        void main() { float r = length(gl_PointCoord - vec2(0.5));
          if (r > 0.5) discard;
          gl_FragColor = vec4(vColor, 1.0 - smoothstep(0.1, 0.5, r)); }`,
    }, { attributes: ["position", "color"], uniforms: ["worldViewProjection"], needAlphaBlending: true });
    this.material.fillMode = BABYLON.Material.PointListDrawMode;
    this.material.alphaMode = BABYLON.Engine.ALPHA_ADD;
    this.material.disableDepthWrite = true;
    this.mesh.material = this.material;
  }

  follow(camera: BABYLON.TargetCamera) {
    this.mesh.position.copyFrom(camera.position);
    this.mesh.computeWorldMatrix(true);
  }

  get ready() { return this.mesh.isReady(true) && this.material.isReady(this.mesh); }
  dispose() { this.mesh.dispose(); this.material.dispose(); }
}
