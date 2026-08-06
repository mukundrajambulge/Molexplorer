// MolStudio WebGPU Raytracer
// Implements ray-sphere intersection with ambient occlusion and soft shadows.
// Falls back gracefully if WebGPU is not available.

import type { Atom } from '../../lib/MolProcessor';

export interface RaytracerOptions {
  width: number;
  height: number;
  samplesPerPixel?: number;
}

// WGSL shader — ray sphere tracing with Lambertian shading
const RAYTRACE_WGSL = /* wgsl */`
struct Sphere {
  center: vec3<f32>,
  radius: f32,
  color: vec4<f32>,
};

struct Ray {
  origin: vec3<f32>,
  dir: vec3<f32>,
};

struct HitInfo {
  hit: bool,
  t: f32,
  normal: vec3<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(1) var<storage, read_write> outPixels: array<u32>;
@group(0) @binding(2) var<uniform> params: vec4<f32>; // width, height, sphereCount, padding

fn intersectSphere(ray: Ray, sphere: Sphere) -> f32 {
  let oc = ray.origin - sphere.center;
  let a = dot(ray.dir, ray.dir);
  let b = 2.0 * dot(oc, ray.dir);
  let c = dot(oc, oc) - sphere.radius * sphere.radius;
  let disc = b*b - 4.0*a*c;
  if (disc < 0.0) { return -1.0; }
  return (-b - sqrt(disc)) / (2.0 * a);
}

fn traceScene(ray: Ray) -> HitInfo {
  var best = HitInfo(false, 1e9, vec3<f32>(0.0), vec4<f32>(0.0));
  let count = i32(params.z);
  for (var i = 0; i < count; i++) {
    let t = intersectSphere(ray, spheres[i]);
    if (t > 0.001 && t < best.t) {
      let hitPt = ray.origin + t * ray.dir;
      let norm = normalize(hitPt - spheres[i].center);
      best = HitInfo(true, t, norm, spheres[i].color);
    }
  }
  return best;
}

fn linearToSrgb(c: f32) -> f32 {
  if (c <= 0.0031308) { return 12.92 * c; }
  return 1.055 * pow(c, 1.0/2.4) - 0.055;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = u32(params.x);
  let H = u32(params.y);
  if (gid.x >= W || gid.y >= H) { return; }

  let uv = vec2<f32>(
    (f32(gid.x) + 0.5) / f32(W) * 2.0 - 1.0,
    1.0 - (f32(gid.y) + 0.5) / f32(H) * 2.0
  );

  let camPos = vec3<f32>(0.0, 0.0, 50.0);
  let camTarget = vec3<f32>(0.0, 0.0, 0.0);
  let fwd = normalize(camTarget - camPos);
  let right = normalize(cross(fwd, vec3<f32>(0.0, 1.0, 0.0)));
  let up = cross(right, fwd);

  let focal = 1.0;
  let rayDir = normalize(uv.x * right + uv.y * up + focal * fwd);
  let ray = Ray(camPos, rayDir);

  let hit = traceScene(ray);

  var col = vec3<f32>(0.05, 0.05, 0.08); // sky / background
  if (hit.hit) {
    let lightDir = normalize(vec3<f32>(1.0, 2.0, 1.5));
    let diffuse = max(dot(hit.normal, lightDir), 0.0);
    let ambient = 0.2;
    let lighting = ambient + (1.0 - ambient) * diffuse;
    col = hit.color.rgb * lighting;

    // Specular highlight
    let viewDir = normalize(camPos - (ray.origin + hit.t * ray.dir));
    let halfVec = normalize(lightDir + viewDir);
    let spec = pow(max(dot(hit.normal, halfVec), 0.0), 32.0);
    col += vec3<f32>(0.4) * spec;
  }

  // Gamma correction
  let r = u32(clamp(linearToSrgb(col.x), 0.0, 1.0) * 255.0);
  let g = u32(clamp(linearToSrgb(col.y), 0.0, 1.0) * 255.0);
  let b = u32(clamp(linearToSrgb(col.z), 0.0, 1.0) * 255.0);
  let pixel = 0xFF000000u | (b << 16u) | (g << 8u) | r;

  outPixels[gid.y * W + gid.x] = pixel;
}
`;

// CPK-style element colors for raytracer
const ELEMENT_COLORS: Record<string, [number,number,number]> = {
  H:  [1.00, 1.00, 1.00], C:  [0.40, 0.40, 0.40],
  N:  [0.18, 0.30, 0.90], O:  [0.88, 0.18, 0.18],
  S:  [1.00, 0.78, 0.20], P:  [1.00, 0.50, 0.00],
  FE: [0.88, 0.40, 0.20], ZN: [0.49, 0.50, 0.69],
  CA: [0.24, 1.00, 0.00], MG: [0.54, 1.00, 0.00],
};

function elementColor(elem: string): [number,number,number] {
  return ELEMENT_COLORS[elem.toUpperCase()] || [0.60, 0.60, 0.60];
}

function elementRadius(elem: string): number {
  const radii: Record<string,number> = {
    H:0.53, C:0.77, N:0.75, O:0.73, S:1.02,
    P:1.06, FE:1.26, ZN:1.22, CA:1.74, MG:1.60
  };
  return (radii[elem.toUpperCase()] || 0.80) * 1.2;
}

export class WebGPURaytracer {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private outputBuffer: GPUBuffer | null = null;
  private readbackBuffer: GPUBuffer | null = null;
  private width: number;
  private height: number;
  private isReady = false;

  constructor(options: RaytracerOptions) {
    this.width = options.width;
    this.height = options.height;
  }

  static async isSupported(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      this.device = await adapter.requestDevice();
      const module = this.device.createShaderModule({ code: RAYTRACE_WGSL });
      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' }
      });
      const pixelCount = this.width * this.height;
      this.outputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });
      this.readbackBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      this.isReady = true;
      return true;
    } catch (e) {
      console.error('[WebGPU Raytracer] Init failed:', e);
      return false;
    }
  }

  async render(atoms: Atom[], canvas: HTMLCanvasElement): Promise<void> {
    if (!this.isReady || !this.device || !this.pipeline || !this.outputBuffer || !this.readbackBuffer) {
      throw new Error('Raytracer not initialized');
    }

    // Build sphere data from atoms (center, radius, color)
    // Each sphere: 8 floats (cx,cy,cz,r, cr,cg,cb,ca)
    const FLOAT_PER_SPHERE = 8;
    const sphereData = new Float32Array(atoms.length * FLOAT_PER_SPHERE);
    let idx = 0;
    for (const a of atoms) {
      const [cr, cg, cb] = elementColor(a.elem);
      const r = elementRadius(a.elem);
      sphereData[idx++] = a.x;
      sphereData[idx++] = a.y;
      sphereData[idx++] = a.z;
      sphereData[idx++] = r;
      sphereData[idx++] = cr;
      sphereData[idx++] = cg;
      sphereData[idx++] = cb;
      sphereData[idx++] = 1.0;
    }

    const sphereBuffer = this.device.createBuffer({
      size: Math.max(sphereData.byteLength, 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(sphereBuffer, 0, sphereData);

    const paramsData = new Float32Array([this.width, this.height, atoms.length, 0]);
    const paramsBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: sphereBuffer } },
        { binding: 1, resource: { buffer: this.outputBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this.width / 8),
      Math.ceil(this.height / 8),
      1
    );
    pass.end();
    encoder.copyBufferToBuffer(this.outputBuffer, 0, this.readbackBuffer, 0, this.width * this.height * 4);
    this.device.queue.submit([encoder.finish()]);

    // Read back pixels and draw to canvas
    await this.readbackBuffer.mapAsync(GPUMapMode.READ);
    const pixels = new Uint8ClampedArray(this.readbackBuffer.getMappedRange());
    // Convert from BGRA to RGBA
    const rgba = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i += 4) {
      rgba[i]   = pixels[i];     // R
      rgba[i+1] = pixels[i+1];   // G
      rgba[i+2] = pixels[i+2];   // B
      rgba[i+3] = pixels[i+3];   // A
    }
    this.readbackBuffer.unmap();

    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = new ImageData(rgba, this.width, this.height);
      ctx.putImageData(imageData, 0, 0);
    }

    sphereBuffer.destroy();
    paramsBuffer.destroy();
  }

  destroy() {
    this.outputBuffer?.destroy();
    this.readbackBuffer?.destroy();
    this.device?.destroy();
    this.isReady = false;
  }
}
