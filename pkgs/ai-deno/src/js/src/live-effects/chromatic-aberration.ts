import { StyleFilterFlag } from "../types.ts";
import { definePlugin } from "../types.ts";
import { ui } from "../ui.ts";
import {
  adjustImageToNearestAligned256Resolution,
  paddingImageData,
  resizeImageData,
  // toPng,
} from "./utils.ts";

export const chromaticAberration = definePlugin({
  id: "chromatic-aberration-v1",
  title: "Chromatic Aberration V1",
  version: { major: 1, minor: 0 },
  styleFilterFlags: {
    main: StyleFilterFlag.kPostEffectFilter,
    features: [],
  },
  paramSchema: {
    colorMode: {
      type: "string",
      enum: ["rgb", "cmyk"],
      default: "rgb",
    },
    strength: {
      type: "real",
      default: 1.0,
    },
    angle: {
      type: "real",
      default: 0.0,
    },
    opacity: {
      type: "real",
      default: 100,
    },
    blendMode: {
      type: "string",
      enum: ["over", "under"],
      default: "under",
    },
    padding: {
      type: "int",
      default: 0,
    },
  },
  editLiveEffectParameters: (params) => JSON.stringify(params),
  renderUI: (params) => {
    // prettier-ignore
    return ui.group({ direction: "col" }, [
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Color Mode"}),
        ui.select({ key: "colorMode", label: "Color Mode", value: params.colorMode, options: ['rgb', 'cmyk'] }),
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Strength"}),
        ui.slider({ key: "strength", label: "Strength", dataType: 'float', min: 0, max: 200, value: params.strength }),
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Angle"}),
        ui.slider({ key: "angle", label: "Angle", dataType: 'float', min: 0, max: 360, value: params.angle }),
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Opacity"}),
        ui.slider({ key: "opacity", label: "Opacity", dataType: 'float', min: 0, max: 100, value: params.opacity }),
      ]),
      ui.group({ direction: "row" }, [
        // ui.text({ text: "Blend Mode"}),
        ui.select({ key: "blendMode", label: "Blend Mode", value: params.blendMode, options: ['over', 'under'] }),
      ]),

      ui.separator(),

      ui.group({ direction: "col" }, [
        ui.text({ text: "Debugging parameters" }),
        ui.slider({ key: "padding", label: "Padding", dataType: 'int', min: 0, max: 200, value: params.padding }),
      ]),
    ])
  },
  initDoLiveEffect: async () => {
    const device = await navigator.gpu.requestAdapter().then((adapter) =>
      adapter!.requestDevice({
        label: "WebGPU(Chromatic Aberration)",
      })
    );

    if (!device) {
      throw new Error("Failed to create WebGPU device");
    }

    const shader = device.createShaderModule({
      label: "Chromatic Aberration Shader",
      code: `
          struct Params {
              strength: f32,
              angle: f32,
              colorMode: u32,
              opacity: f32,
              blendMode: u32,  // 0: over, 1: under
          }

          @group(0) @binding(0) var inputTexture: texture_2d<f32>;
          @group(0) @binding(1) var resultTexture: texture_storage_2d<rgba8unorm, write>;
          @group(0) @binding(2) var textureSampler: sampler;
          @group(0) @binding(3) var<uniform> params: Params;

          fn getOffset(angle: f32) -> vec2f {
              let radians = angle * 3.14159 / 180.0;
              return vec2f(cos(radians), sin(radians));
          }

          fn screenBlend(a: f32, b: f32) -> f32 {
              return 1.0 - (1.0 - a) * (1.0 - b);
          }

          // RGB から CMYK への変換関数
          fn rgbToCmyk(rgb: vec3f) -> vec4f {
              let r = rgb.r;
              let g = rgb.g;
              let b = rgb.b;

              let k = 1.0 - max(max(r, g), b);

              // 黒が1.0（完全な黒）の場合、他のチャンネルは0に
              if (k == 1.0) {
                  return vec4f(0.0, 0.0, 0.0, 1.0);
              }

              let c = (1.0 - r - k) / (1.0 - k);
              let m = (1.0 - g - k) / (1.0 - k);
              let y = (1.0 - b - k) / (1.0 - k);

              return vec4f(c, m, y, k);
          }

          // CMYK から RGB への変換関数
          fn cmykToRgb(cmyk: vec4f) -> vec3f {
              let c = cmyk.x;
              let m = cmyk.y;
              let y = cmyk.z;
              let k = cmyk.w;

              let r = (1.0 - c) * (1.0 - k);
              let g = (1.0 - m) * (1.0 - k);
              let b = (1.0 - y) * (1.0 - k);

              return vec3f(r, g, b);
          }

          @compute @workgroup_size(16, 16)
          fn computeMain(@builtin(global_invocation_id) id: vec3u) {
              let dims = vec2f(textureDimensions(inputTexture));
              let texCoord = vec2f(id.xy) / dims;

              // strengthをピクセル単位として処理し、テクスチャ座標に変換
              let pixelOffset = getOffset(params.angle) * params.strength;
              let texOffset = pixelOffset / dims;

              var effectColor: vec4f;
              let originalColor = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);

              if (params.colorMode == 0u) { // RGB mode
                  let redOffset = texCoord + texOffset;
                  let blueOffset = texCoord - texOffset;

                  let redSample = textureSampleLevel(inputTexture, textureSampler, redOffset, 0.0);
                  let greenSample = textureSampleLevel(inputTexture, textureSampler, texCoord, 0.0);
                  let blueSample = textureSampleLevel(inputTexture, textureSampler, blueOffset, 0.0);

                  let r = redSample.r;
                  let g = greenSample.g;
                  let b = blueSample.b;

                  let a_red = redSample.a;
                  let a_green = greenSample.a;
                  let a_blue = blueSample.a;

                  let a = screenBlend(screenBlend(a_red, a_green), a_blue);

                  effectColor = vec4f(r, g, b, a);
              } else { // CMYK mode
                  let cyanOffset = texCoord + texOffset;
                  let magentaOffset = texCoord + vec2f(-texOffset.y, texOffset.x) * 0.866;
                  let yellowOffset = texCoord + vec2f(-texOffset.x, -texOffset.y);
                  let blackOffset = texCoord - vec2f(-texOffset.y, texOffset.x) * 0.866;

                  let cyanSample = textureSampleLevel(inputTexture, textureSampler, cyanOffset, 0.0);
                  let magentaSample = textureSampleLevel(inputTexture, textureSampler, magentaOffset, 0.0);
                  let yellowSample = textureSampleLevel(inputTexture, textureSampler, yellowOffset, 0.0);
                  let blackSample = textureSampleLevel(inputTexture, textureSampler, blackOffset, 0.0);

                  // 各サンプルをCMYKに変換
                  let cyanCmyk = rgbToCmyk(cyanSample.rgb);
                  let magentaCmyk = rgbToCmyk(magentaSample.rgb);
                  let yellowCmyk = rgbToCmyk(yellowSample.rgb);
                  let blackCmyk = rgbToCmyk(blackSample.rgb);

                  // CMYK各チャンネルの分離
                  let c = cyanCmyk.x;        // シアンのみを使用
                  let m = magentaCmyk.y;     // マゼンタのみを使用
                  let y = yellowCmyk.z;      // イエローのみを使用
                  let k = blackCmyk.w;       // ブラックのみを使用

                  // 合成CMYK値を作成
                  let finalCmyk = vec4f(c, m, y, k);

                  // CMYKからRGBに変換
                  let result = cmykToRgb(finalCmyk);

                  // アルファ値の計算
                  let a_cyan = cyanSample.a;
                  let a_magenta = magentaSample.a;
                  let a_yellow = yellowSample.a;
                  let a_black = blackSample.a;

                  let a = screenBlend(screenBlend(screenBlend(a_cyan, a_magenta), a_yellow), a_black);

                  effectColor = vec4f(result, a);
              }

              var finalColor: vec4f;
              if (params.blendMode == 0u) {
                  finalColor = mix(originalColor, effectColor, params.opacity);
              } else {
                  finalColor = mix(effectColor, originalColor, 1.0 - params.opacity);
              }

              textureStore(resultTexture, id.xy, finalColor);
          }
      `,
    });

    device.addEventListener("lost", (e) => {
      console.error(e);
    });

    device.addEventListener("uncapturederror", (e) => {
      console.error(e.error);
    });

    const pipeline = device.createComputePipeline({
      label: "Chromatic Aberration Pipeline",
      layout: "auto",
      compute: {
        module: shader,
        entryPoint: "computeMain",
      },
    });

    return { device, pipeline };
  },
  doLiveEffect: async ({ device, pipeline }, params, imgData) => {
    console.log("Chromatic Aberration V1", params);
    // const size = Math.max(imgData.width, imgData.height);

    const padImg = await paddingImageData(imgData, params.padding);

    // const orignalSize = { width: imgData.width, height: imgData.height };
    imgData = await adjustImageToNearestAligned256Resolution(padImg);

    const width = imgData.width,
      height = imgData.height;

    // Create textures
    const texture = device.createTexture({
      label: "Input Texture",
      size: [width, height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.STORAGE_BINDING,
    });

    const resultTexture = device.createTexture({
      label: "Result Texture",
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
    });

    const sampler = device.createSampler({
      label: "Texture Sampler",
      magFilter: "linear",
      minFilter: "linear",
    });

    // Create uniform buffer
    const uniformBuffer = device.createBuffer({
      label: "Params Buffer",
      size: 20, // float + float + uint + float + uint
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      label: "Main Bind Group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: texture.createView(),
        },
        {
          binding: 1,
          resource: resultTexture.createView(),
        },
        {
          binding: 2,
          resource: sampler,
        },
        {
          binding: 3,
          resource: { buffer: uniformBuffer },
        },
      ],
    });

    const stagingBuffer = device.createBuffer({
      label: "Staging Buffer",
      size: width * height * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Update uniforms
    const uniformData = new ArrayBuffer(20); // 4 floats + 1 uint
    new Float32Array(uniformData, 0, 1)[0] = params.strength;
    new Float32Array(uniformData, 4, 1)[0] = params.angle;
    new Uint32Array(uniformData, 8, 1)[0] = params.colorMode === "rgb" ? 0 : 1;
    new Float32Array(uniformData, 12, 1)[0] = params.opacity / 100;
    new Uint32Array(uniformData, 16, 1)[0] = 0;
    new Uint32Array(uniformData, 16, 1)[0] =
      params.blendMode === "over" ? 0 : 1;
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Update source texture
    device.queue.writeTexture(
      { texture },
      imgData.data,
      { bytesPerRow: width * 4, rowsPerImage: height },
      [width, height]
    );

    // Execute compute shader
    const commandEncoder = device.createCommandEncoder({
      label: "Main Command Encoder",
    });

    const computePass = commandEncoder.beginComputePass({
      label: "Chromatic Aberration Compute Pass",
    });
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(
      Math.ceil(width / 16),
      Math.ceil(height / 16)
    );
    computePass.end();

    commandEncoder.copyTextureToBuffer(
      { texture: resultTexture },
      { buffer: stagingBuffer, bytesPerRow: width * 4 },
      [width, height]
    );

    device.queue.submit([commandEncoder.finish()]);

    // Read back and display the result
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const copyArrayBuffer = stagingBuffer.getMappedRange();
    const resultData = new Uint8Array(copyArrayBuffer.slice(0));
    stagingBuffer.unmap();

    const resultImageData = new ImageData(
      new Uint8ClampedArray(resultData),
      width,
      height
    );

    // const png = await toPng(resultImageData);
    // Deno.writeFile(
    //   "chromatic-aberration-out.png",
    //   new Uint8Array(await png.arrayBuffer())
    // );

    return await resizeImageData(resultImageData, padImg.width, padImg.height);
  },
});
