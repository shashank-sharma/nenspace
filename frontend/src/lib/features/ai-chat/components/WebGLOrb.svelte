
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    let { className = '' } = $props<{
        className?: string;
    }>();

    let canvas: HTMLCanvasElement;
    let gl: WebGL2RenderingContext | null = null;
    let animationFrameId: number | null = null;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;

    const vsSource = `#version 300 es
    in vec4 position;
    void main() {
      gl_Position = position;
    }
    `;

    const fsSource = `#version 300 es
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    out vec4 fragColor;

    void main() {
        // r = resolution
        vec2 r = resolution;
        // t = time
        float t = time;

        // o = output color, initialized to 0
        vec4 o = vec4(0.0);

        // FC.rgb*2.-r.xyy implementation
        // This corresponds to a ray direction
        vec3 dir = normalize(vec3(gl_FragCoord.xy * 2.0 - r.xy, -r.y));

        // Loop vars
        float z = 0.0;
        float i = 0.0;

        for(i = 0.0; i < 100.0; i++) {
            // p = z * dir
            vec3 p = dir * z;
            p.z += 2.0;

            // Rotation: p.zx *= mat2(cos(p.y+t+vec4(0,11,33,0)))
            // We implement the rotation matrix explicitly
            // vec4(0, 11, 33, 0)
            // 11.0 radians is approx 3.5 * PI, so cos(x + 11) ~= sin(x)
            // 33.0 radians is approx 10.5 * PI, so cos(x + 33) ~= -sin(x)
            float ang = p.y + t;
            vec4 coeffs = cos(ang + vec4(0.0, 11.0, 33.0, 0.0));
            mat2 rot = mat2(coeffs.x, coeffs.y, coeffs.z, coeffs.w);
            p.zx = rot * p.zx;

            vec3 v = p;

            // Fractal folding
            // for(d=1.;d<i;d+=d) p+=sin(p.yzx*d)/d;
            float d_fold = 1.0;
            // Unrolling loop up to max possible iterations for i < 100
            for(int k=0; k<10; k++) {
                if(d_fold >= i) break;
                p += sin(p.yzx * d_fold) / d_fold;
                d_fold += d_fold;
            }

            // Distance field
            // s = cos(3.*p.y)
            float s = cos(3.0 * p.y);

            // d = .2 * max(.03 + abs(s)*.1, length(v)-1.)
            // Note: reusing variable name 'd_val' for 'd' in shader
            float d_val = 0.2 * max(0.03 + abs(s) * 0.1, length(v) - 1.0);

            z += d_val;

            // Color accumulation
            // o+=(cos(s/.4+p.y+vec4(6,1,3,0))+1.5)/d/z;
            vec4 col = cos(s / 0.4 + p.y + vec4(6.0, 1.0, 3.0, 0.0)) + 1.5;

            // Add safety for division
            o += col / max(d_val, 0.0001) / max(z, 0.0001);
        }

        // Tone mapping
        // o=tanh(o/1e4)
        fragColor = tanh(o / 10000.0);
        fragColor.a = 1.0;
    }
    `;

    function createShader(type: number, source: string): WebGLShader | null {
        if (!gl) return null;
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
        if (!gl) return null;
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Program link error:", gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    function resize() {
        if (!canvas) return;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            if (gl) {
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            }
        }
    }

    function render(now: number) {
        if (!gl || !program || !vao) return;

        resize();

        gl.useProgram(program);
        gl.bindVertexArray(vao);

        const resolutionLocation = gl.getUniformLocation(program, "resolution");
        const timeLocation = gl.getUniformLocation(program, "time");

        if (resolutionLocation) {
            gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
        }
        if (timeLocation) {
            gl.uniform1f(timeLocation, now * 0.001);
        }

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        animationFrameId = requestAnimationFrame(render);
    }

    onMount(() => {
        if (!canvas) return;

        gl = canvas.getContext('webgl2');
        if (!gl) {
            console.error("WebGL2 not supported");
            return;
        }

        vs = createShader(gl.VERTEX_SHADER, vsSource);
        fs = createShader(gl.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) return;

        program = createProgram(vs, fs);
        if (!program) return;

        const positionAttributeLocation = gl.getAttribLocation(program, "position");
        positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

        const positions = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.enableVertexAttribArray(positionAttributeLocation);
        gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

        requestAnimationFrame(render);
    });

    onDestroy(() => {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
        if (gl && program) {
            gl.deleteProgram(program);
        }
        if (gl && vs) {
            gl.deleteShader(vs);
        }
        if (gl && fs) {
            gl.deleteShader(fs);
        }
    });
</script>

<canvas
    bind:this={canvas}
    class="block w-full h-full {className}"
    style="background: black;"
></canvas>
