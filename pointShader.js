BABYLON.Effect.ShadersStore["customPointVertexShader"] = `
  precision highp float;
  attribute vec3 position;
  attribute vec4 color;
  uniform mat4 viewProjection;
  varying vec4 vColor;
  void main(void) {
    gl_Position = viewProjection * vec4(position, 1.0);
    gl_PointSize = 3.0; // or uniform
    vColor = color;
  }
`;

BABYLON.Effect.ShadersStore["customPointPixelShader"] = `
  precision highp float;
  varying vec4 vColor;
  uniform sampler2D textureSampler;
  void main(void) {
    vec4 texColor = texture2D(textureSampler, gl_PointCoord);
    gl_FragColor = vColor * texColor;
  }
`;
