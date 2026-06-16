// WebGL renderer untuk preview crop — meniru transform GPU CapCut/Premiere.
//
// Frame video di-decode native oleh Go (libav) dan dikirim sebagai JPEG.
// Di sini frame jadi texture, lalu shader memetakan tiap pixel output ke
// koordinat texture source berdasarkan region crop. Karena transform terjadi
// di fragment shader (per-pixel, GPU), hasilnya sub-pixel akurat dan TIDAK
// PERNAH gepeng — scaling selalu uniform terhadap source.

const VERT_SRC = `
attribute vec2 a_pos;       // posisi quad [-1,1]
varying vec2 v_uv;          // uv [0,1] output
void main() {
  // a_pos [-1,1] → uv [0,1], flip Y (texture origin top-left)
  v_uv = vec2((a_pos.x + 1.0) * 0.5, 1.0 - (a_pos.y + 1.0) * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_cropOrigin;  // pojok kiri-atas crop region (normalized source 0-1)
uniform vec2 u_cropSize;    // lebar/tinggi crop region (normalized source 0-1)
void main() {
  // Map uv output (0-1 di zone) → koordinat texture source di dalam crop region.
  vec2 src = u_cropOrigin + v_uv * u_cropSize;
  gl_FragColor = texture2D(u_tex, src);
}
`

export interface CropRegion {
  x: number // 0-1 normalized
  y: number
  w: number
  h: number
}

export class GLRenderer {
  private gl: WebGLRenderingContext
  private prog: WebGLProgram
  private tex: WebGLTexture
  private locCropOrigin: WebGLUniformLocation | null
  private locCropSize: WebGLUniformLocation | null
  private hasFrame = false

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, antialias: true })
    if (!gl) throw new Error('WebGL tidak tersedia')
    this.gl = gl

    this.prog = this.buildProgram(VERT_SRC, FRAG_SRC)
    gl.useProgram(this.prog)

    // Full-screen quad (2 segitiga).
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW)
    const locPos = gl.getAttribLocation(this.prog, 'a_pos')
    gl.enableVertexAttribArray(locPos)
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0)

    this.locCropOrigin = gl.getUniformLocation(this.prog, 'u_cropOrigin')
    this.locCropSize = gl.getUniformLocation(this.prog, 'u_cropSize')

    this.tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  private buildProgram(vsrc: string, fsrc: string): WebGLProgram {
    const gl = this.gl
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('shader compile: ' + gl.getShaderInfoLog(s))
      }
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsrc))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsrc))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('program link: ' + gl.getProgramInfoLog(prog))
    }
    return prog
  }

  // setFrame mengunggah frame baru (ImageBitmap dari JPEG) sebagai texture.
  setFrame(bitmap: ImageBitmap | HTMLImageElement | HTMLVideoElement) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap as any)
    this.hasFrame = true
  }

  // draw merender frame saat ini dengan crop region tertentu ke ukuran canvas.
  draw(crop: CropRegion, outW: number, outH: number) {
    const gl = this.gl
    if (this.canvas.width !== outW || this.canvas.height !== outH) {
      this.canvas.width = outW
      this.canvas.height = outH
    }
    gl.viewport(0, 0, outW, outH)
    gl.useProgram(this.prog)
    gl.uniform2f(this.locCropOrigin, crop.x, crop.y)
    gl.uniform2f(this.locCropSize, crop.w, crop.h)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    if (this.hasFrame) {
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    } else {
      gl.clearColor(0.04, 0.03, 0.07, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.tex)
    gl.deleteProgram(this.prog)
  }
}

// fetchFrameBitmap mengambil 1 frame dari decoder native Go dan men-decode-nya
// jadi ImageBitmap (siap diunggah ke WebGL). Mengembalikan juga dimensi source.
export async function fetchFrameBitmap(
  videoPath: string,
  tSec: number,
  quality = 80,
  signal?: AbortSignal,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const url = `/preview/frame?path=${encodeURIComponent(videoPath)}&t=${tSec}&q=${quality}`
  const resp = await fetch(url, { signal })
  if (!resp.ok) throw new Error(`frame fetch ${resp.status}`)
  const width = parseInt(resp.headers.get('X-Frame-Width') || '0', 10)
  const height = parseInt(resp.headers.get('X-Frame-Height') || '0', 10)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  return { bitmap, width, height }
}
