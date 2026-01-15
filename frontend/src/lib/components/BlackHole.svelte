<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { browser } from "$app/environment";

	const { speed, colorCore, colorOuter, isFluxMode } = $props<{
		speed: number;
		colorCore: [number, number, number];
		colorOuter: [number, number, number];
		isFluxMode: boolean;
	}>();

	let canvasElement: HTMLCanvasElement;
	let gl: WebGL2RenderingContext | null = null;
	let program: WebGLProgram | null = null;
	let animationFrameId: number | null = null;
	let propsRef = $state({ speed, colorCore, colorOuter, isFluxMode });
	let mousePosition = $state({ x: 0, y: 0 });
	let resizeHandler: (() => void) | null = null;
	let fadeInProgress = $state(0.0);
	let startTime: number | null = null;

	const vertexShaderSource = `#version 300 es
in vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

	const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform vec3 u_color_core;
uniform vec3 u_color_outer;
uniform float u_is_flux;
uniform float u_fade;

out vec4 fragColor;

void main() {
    vec2 r = u_resolution;
    float t = u_time;
    vec2 FC = gl_FragCoord.xy;

    // Normalize and center
    vec2 uv = (FC.xy * 2.0 - r) / r.y;
    
    // Mouse parallax effect
    vec2 mouseOffset = (u_mouse / r - 0.5) * 0.05;
    vec2 p = (uv - mouseOffset) / 0.7;
    
    vec2 d = vec2(-0.5, 1.0);
    
    // Core math from original shader
    vec2 denomVec = 5.0 * p - d;
    float dotDenom = dot(denomVec, denomVec);
    vec2 col2 = d / (0.1 + 5.0 / dotDenom);
    // Use more symmetric transformation to reduce diagonal tilt
    mat2 m1 = mat2(1.0, 0.0, col2.x, col2.y);
    
    vec2 c = p * m1;
    vec2 v = c;
    
    // 'o' accumulates the sine wave values. This holds the "texture" of the ripples.
    vec4 o = vec4(0.0);
    
    vec4 cosArg = log(length(v)) + t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0);
    vec4 cosRes = cos(cosArg);
    mat2 m2 = mat2(cosRes.x, cosRes.y, cosRes.z, cosRes.w);
    
    v = (v * m2) * 5.0;
    
    for (float i = 0.0; i++ < 9.0; ) {
        v += 0.7 * sin(v.yx * i + t) / i + 0.5;
        o += sin(v.xyyx) + 1.0;
    }
    
    vec4 term1_exp = exp(c.x * vec4(0.6, -0.4, -1.0, 0.0));
    vec4 term1 = -term1_exp;
    
    vec2 vDiv = v / 0.3;
    vec2 cMult = c * vec2(1.0, 2.0);
    float lenArg = length(sin(vDiv) * 0.2 + cMult) - 1.0;
    float term2 = 0.1 + 0.1 * pow(lenArg, 2.0);
    
    float term3 = 1.0 + 7.0 * exp(0.3 * c.y - dot(c, c));
    float term4 = 0.03 + abs(length(p) - 0.7);
    
    vec4 exponent = term1 / o / term2 / term3 / term4 * 0.2;
    float intensity = 1.0 - exp(exponent.x); 
    
    // Add some variation for the "cloud" texture
    float texture = 1.0 - exp(exponent.y * 1.5);
    
    vec3 color;

    if (u_is_flux > 0.5) {
        // FLUX MODE: Gentle Silky Flow
        
        // 1. Flow Phase: 
        // uv.x * 0.6 -> Stretches the gradient across the screen width
        // -t * 0.15 -> Slow, majestic drift
        // o.x * 0.05 -> Subtle organic influence from the black hole math
        float flowPhase = uv.x * 0.6 - t * 0.15 + o.x * 0.05;
        
        // 2. Spectral Palette (Cosine based)
        // Gentle pastel/spectral shift
        vec3 spectral = 0.5 + 0.5 * cos(flowPhase + vec3(0.0, 2.0, 4.0));
        
        // 3. Silky Texture:
        // Soft sine wave based on the simulation accumulator 'o.y'
        // combined with the distortion coordinate 'c.x'.
        float silkyRipple = 0.5 + 0.5 * sin(o.y * 0.2 + c.x + t * 0.5);
        
        // 4. Composition
        // Base body
        color = spectral * intensity * 1.1;
        
        // Add soft highlights
        color += spectral * silkyRipple * intensity * 0.4;
        
        // Soft Center Glow with additional center effect
        float centerGlow = 0.03 / (length(p) + 0.01);
        color += spectral * centerGlow * 0.8;
        
        // Additional center effect for more attraction
        vec2 centerP = (FC.xy * 2.0 - r) / r.y;
        float centerLVal = abs(0.7 - dot(centerP, centerP));
        vec2 centerL = vec2(centerLVal);
        vec2 centerV = centerP * (1.0 - centerLVal) / 0.2;
        vec4 centerO = vec4(0.0);
        for(float i = 0.0; i++ < 8.0; ) {
            centerO += (sin(centerV.xyyx) + 1.0) * abs(centerV.x - centerV.y) * 0.2;
            centerV += cos(centerV.yx * i + vec2(0.0, i) + t) / i + 0.7;
        }
        centerO = tanh(exp(centerP.y * vec4(1.0, -1.0, -2.0, 0.0)) * exp(-4.0 * centerL.x) / centerO);
        float centerEffectMask = 1.0 - smoothstep(0.0, 0.5, length(centerP));
        vec3 centerEffectColor = vec3(centerO.xyz) * 0.5;
        color += spectral * centerEffectColor * centerEffectMask;
        
    } else {
        // STANDARD MODE: Theme Colors
        color = mix(u_color_outer * 0.5, u_color_core, intensity * 1.2 + texture * 0.2);
        
        // Add a glow to the center
        float centerGlow = 0.05 / (length(p) + 0.01);
        color += u_color_core * centerGlow * 0.5;
        
        // Additional center effect for more attraction
        vec2 centerP = (FC.xy * 2.0 - r) / r.y;
        float centerLVal = abs(0.7 - dot(centerP, centerP));
        vec2 centerL = vec2(centerLVal);
        vec2 centerV = centerP * (1.0 - centerLVal) / 0.2;
        vec4 centerO = vec4(0.0);
        for(float i = 0.0; i++ < 8.0; ) {
            centerO += (sin(centerV.xyyx) + 1.0) * abs(centerV.x - centerV.y) * 0.2;
            centerV += cos(centerV.yx * i + vec2(0.0, i) + t) / i + 0.7;
        }
        centerO = tanh(exp(centerP.y * vec4(1.0, -1.0, -2.0, 0.0)) * exp(-4.0 * centerL.x) / centerO);
        float centerEffectMask = 1.0 - smoothstep(0.0, 0.5, length(centerP));
        vec3 centerEffectColor = vec3(centerO.xyz) * 0.5;
        color += u_color_core * centerEffectColor * centerEffectMask;
    }

    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.5, length(uv));
    color *= vig;
    
    // Fade-in animation
    color *= u_fade;

    fragColor = vec4(color, 1.0);
}`;

	function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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

	$effect(() => {
		propsRef = { speed, colorCore, colorOuter, isFluxMode };
	});

	function handleMouseMove(e: MouseEvent) {
		mousePosition = { x: e.clientX, y: window.innerHeight - e.clientY };
	}

	onMount(() => {
		if (!browser || !canvasElement) return;

		// Initialize fade-in animation
		startTime = performance.now();
		fadeInProgress = 0.0;

		// Initialize mouse position to center of screen to prevent snapping
		mousePosition = {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		};

		const canvas = canvasElement;
		const context = canvas.getContext("webgl2");
		if (!context) {
			console.error("WebGL2 not supported");
			return;
		}
		gl = context;

		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

		if (!vertexShader || !fragmentShader) return;

		const shaderProgram = gl.createProgram();
		if (!shaderProgram) return;
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			console.error("Program link error:", gl.getProgramInfoLog(shaderProgram));
			return;
		}

		gl.useProgram(shaderProgram);
		program = shaderProgram;

		// Buffers
		const vertices = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

		const positionAttribLocation = gl.getAttribLocation(program, "a_position");
		gl.enableVertexAttribArray(positionAttribLocation);
		gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);

		// Uniform Locations
		const locs = {
			resolution: gl.getUniformLocation(program, "u_resolution"),
			time: gl.getUniformLocation(program, "u_time"),
			mouse: gl.getUniformLocation(program, "u_mouse"),
			colorCore: gl.getUniformLocation(program, "u_color_core"),
			colorOuter: gl.getUniformLocation(program, "u_color_outer"),
			isFlux: gl.getUniformLocation(program, "u_is_flux"),
			fade: gl.getUniformLocation(program, "u_fade"),
		};

		// Resize
		resizeHandler = () => {
			if (!gl || !program) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
			gl.viewport(0, 0, canvas.width, canvas.height);
			if (locs.resolution) {
				gl.uniform2f(locs.resolution, canvas.width, canvas.height);
			}
		};
		window.addEventListener("resize", resizeHandler);
		resizeHandler();

		// Mouse tracking
		window.addEventListener("mousemove", handleMouseMove);

		// Render Loop
		let accumulatedTime = 0;
		let lastTime = performance.now();

		function render(now: number) {
			if (!gl || !program) return;

			const { speed, colorCore, colorOuter, isFluxMode } = propsRef;

			const dt = (now - lastTime) * 0.001;
			lastTime = now;

			// Update fade-in animation (2.5 seconds fade-in)
			if (startTime !== null) {
				const elapsed = (now - startTime) * 0.001;
				fadeInProgress = Math.min(1.0, elapsed / 3.5);
			}

			accumulatedTime += dt * speed;

			if (locs.time) gl.uniform1f(locs.time, accumulatedTime);
			if (locs.mouse) gl.uniform2f(locs.mouse, mousePosition.x, mousePosition.y);
			if (locs.colorCore) gl.uniform3fv(locs.colorCore, colorCore);
			if (locs.colorOuter) gl.uniform3fv(locs.colorOuter, colorOuter);
			if (locs.isFlux) gl.uniform1f(locs.isFlux, isFluxMode ? 1.0 : 0.0);
			if (locs.fade) gl.uniform1f(locs.fade, fadeInProgress);

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			animationFrameId = requestAnimationFrame(render);
		}

		animationFrameId = requestAnimationFrame(render);
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		window.removeEventListener("mousemove", handleMouseMove);
		if (resizeHandler) {
			window.removeEventListener("resize", resizeHandler);
		}
		if (gl && program) {
			gl.deleteProgram(program);
		}
	});
</script>

<canvas bind:this={canvasElement} class="block w-full h-full"></canvas>