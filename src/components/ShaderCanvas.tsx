import { useEffect, useRef } from 'react'

const vertexSource = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentSource = `
  precision mediump float;
  uniform vec2 resolution;
  uniform float time;

  float blob(vec2 uv, vec2 center, float radius) {
    float distanceToCenter = length(uv - center);
    return smoothstep(radius, 0.0, distanceToCenter);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    uv.x *= resolution.x / resolution.y;
    vec3 color = vec3(0.043, 0.063, 0.051);
    float drift = sin(time * 0.16) * 0.045;
    float green = blob(uv, vec2(0.74 + drift, 0.72), 0.52);
    float amber = blob(uv, vec2(0.95, 0.22 + drift), 0.34);
    color += vec3(0.12, 0.24, 0.13) * green;
    color += vec3(0.15, 0.10, 0.05) * amber;
    gl_FragColor = vec4(color, 1.0);
  }
`

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Could not create WebGL shader')
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

export function ShaderCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    const gl = canvas?.getContext('webgl', { alpha: false, antialias: false })
    if (!canvas || !gl) {
      return
    }

    let program: WebGLProgram | null = null
    let frame = 0

    try {
      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
      program = gl.createProgram()
      if (!program) {
        throw new Error('Could not create WebGL program')
      }
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Could not link shader')
      }

      const buffer = gl.createBuffer()
      if (!buffer) {
        throw new Error('Could not create WebGL buffer')
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      )
      gl.useProgram(program)
      const position = gl.getAttribLocation(program, 'position')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

      const resolution = gl.getUniformLocation(program, 'resolution')
      const time = gl.getUniformLocation(program, 'time')
      const resize = () => {
        const scale = Math.min(window.devicePixelRatio || 1, 1.5)
        canvas.width = Math.round(canvas.clientWidth * scale)
        canvas.height = Math.round(canvas.clientHeight * scale)
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      const start = performance.now()
      const render = (now: number) => {
        gl.uniform2f(resolution, canvas.width, canvas.height)
        gl.uniform1f(time, (now - start) / 1000)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        frame = window.requestAnimationFrame(render)
      }
      frame = window.requestAnimationFrame(render)

      return () => {
        observer.disconnect()
        window.cancelAnimationFrame(frame)
        gl.deleteBuffer(buffer)
        if (program) gl.deleteProgram(program)
      }
    } catch (error) {
      if (program) gl.deleteProgram(program)
      console.error('Atmospheric background shader failed to initialize.', error)
      return
    }
  }, [])

  return <canvas aria-hidden="true" className="shader-canvas" ref={canvasRef} />
}
