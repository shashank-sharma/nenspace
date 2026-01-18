<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";
	import * as THREE from "three";
	import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
	import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
	import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

	const CHAR_SET = new Set<string>();
	
	for (let i = 32; i <= 126; i++) {
		CHAR_SET.add(String.fromCharCode(i));
	}
	const specialChars = "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ";
	for (const char of specialChars) {
		CHAR_SET.add(char);
	}
	
	const ALL_CHARS = Array.from(CHAR_SET).sort();
	const CHAR_COUNT = ALL_CHARS.length;
	
	function shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}
	
	const lineIndices = shuffleArray(Array.from({ length: CHAR_COUNT }, (_, i) => i));
	
	const CHAR_TO_LINE_MAP = new Map<string, number>();
	ALL_CHARS.forEach((char, index) => {
		CHAR_TO_LINE_MAP.set(char, lineIndices[index]);
	});

	const CONFIG = {
		colorBg: "#020817",
		colorLine: "#374151",
		colorSignal: "#00d9ff",
		colorSignal2: "#a855f7",
		colorSignal3: "#f59e0b",

		lineCount: CHAR_COUNT,
		globalRotation: 0,
		positionX: 0,
		positionY: 0,

		spreadHeight: 55,
		spreadDepth: 0,
		curveLength: 50,
		straightLength: 100,
		curvePower: 0.7265,

		waveSpeed: 1.8,
		waveHeight: 2.145,
		lineOpacity: 0.1,

		speedGlobal: 0.4,
		trailLength: 5,

		bloomStrength: 1.5,
		bloomRadius: 0.9,
	};

	const CONSTANTS = {
		segmentCount: 150,
	};

	let mountRef: HTMLDivElement;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let composer: EffectComposer | null = null;
	let frameId: number;
	let contentGroup: THREE.Group;
	let backgroundLines: THREE.Line[] = [];

	let bgMaterial: THREE.LineBasicMaterial;
	let signalMaterial: THREE.LineBasicMaterial;
	const signalColorObj1 = new THREE.Color(CONFIG.colorSignal);
	const signalColorObj2 = new THREE.Color(CONFIG.colorSignal2);
	const signalColorObj3 = new THREE.Color(CONFIG.colorSignal3);
	
	const interactiveSignals = new Map<number, {
		mesh: THREE.Line;
		laneIndex: number;
		speed: number;
		progress: number;
		history: THREE.Vector3[];
		assignedColor: THREE.Color;
		fadeOut?: boolean;
		fadeProgress?: number;
	}>();
	
	let signalColorOverride: THREE.Color | null = $state(null);
	
	let isLoginProcessing = $state(false);
	
	let animatedSpreadHeight = $state(CONFIG.spreadHeight);
	
		let globalFadeProgress = $state(0);
	let isFadingOut = $state(false);
	
	function calculateViewportBounds(
		camera: THREE.PerspectiveCamera,
		distance: number
	): { left: number; right: number } {
		const fovRad = THREE.MathUtils.degToRad(camera.fov);
		const viewportHeight = 2 * distance * Math.tan(fovRad / 2);
		const viewportWidth = viewportHeight * camera.aspect;
		
		return {
			left: -viewportWidth / 2,
			right: viewportWidth / 2,
		};
	}

	function updatePathDimensions() {
		if (!camera || !mountRef) return;
		
		const bounds = calculateViewportBounds(camera, 90);
		
		CONFIG.curveLength = -bounds.left;
		CONFIG.straightLength = bounds.right;
		CONFIG.positionX = 0;
		
		if (contentGroup) {
			contentGroup.position.set(CONFIG.positionX, CONFIG.positionY, 0);
		}
	}

	function getPathPoint(t: number, lineIndex: number, time: number): THREE.Vector3 {
		const totalLen = CONFIG.curveLength + CONFIG.straightLength;
		const currentX = -CONFIG.curveLength + t * totalLen;

		const connectionPoint = -CONFIG.curveLength * 0.3;

		let y = 0;
		let z = 0;
		const normalizedIndex = lineIndex / (CONFIG.lineCount - 1);
		const spreadFactor = (normalizedIndex - 0.5) * 0.8 * 2;

		if (currentX < connectionPoint) {
			const curveStartX = -CONFIG.curveLength;
			const curveRange = CONFIG.curveLength + connectionPoint;
			const ratio = (currentX - curveStartX) / curveRange;
			let shapeFactor = (Math.cos(ratio * Math.PI) + 1) / 2;
			shapeFactor = Math.pow(shapeFactor, CONFIG.curvePower);

			const spreadHeightFactor = animatedSpreadHeight / CONFIG.spreadHeight || 0;
			
			y = spreadFactor * animatedSpreadHeight * shapeFactor;
			z = spreadFactor * CONFIG.spreadDepth * shapeFactor;

			const waveFactor = shapeFactor * spreadHeightFactor;
			const wave = Math.sin(time * CONFIG.waveSpeed + currentX * 0.1 + lineIndex) * CONFIG.waveHeight * waveFactor;
			y += wave;
		}

		return new THREE.Vector3(currentX, y, z);
	}

	function pickSignalColor(): THREE.Color {
		const rand = Math.random();
		if (rand < 0.7) return signalColorObj1;
		if (rand < 0.9) return signalColorObj2;
		return signalColorObj3;
	}

	function rebuildLines() {
		if (!contentGroup) return;

		backgroundLines.forEach((l) => {
			contentGroup.remove(l);
			l.geometry.dispose();
		});
		backgroundLines = [];

		for (let i = 0; i < CONFIG.lineCount; i++) {
			const geometry = new THREE.BufferGeometry();
			const positions = new Float32Array(CONSTANTS.segmentCount * 3);
			geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

			const line = new THREE.Line(geometry, bgMaterial);
			line.userData = { id: i };
			line.renderOrder = 0;
			contentGroup.add(line);
			backgroundLines.push(line);
		}
	}

	function handleResize() {
		if (!renderer || !camera || !mountRef || !composer) return;
		const rect = mountRef.getBoundingClientRect();
		camera.aspect = rect.width / rect.height;
		camera.updateProjectionMatrix();
		renderer.setSize(rect.width, rect.height);
		composer.setSize(rect.width, rect.height);
		
		updatePathDimensions();
	}

	function triggerCharacterBloom(char: string) {
		if (!contentGroup || !signalMaterial) return;
		
		const lineIndex = CHAR_TO_LINE_MAP.get(char);
		if (lineIndex === undefined) return;
		
		const maxTrail = 150;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(maxTrail * 3);
		const colors = new Float32Array(maxTrail * 3);

		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

		const mesh = new THREE.Line(geometry, signalMaterial);
		mesh.frustumCulled = false;
		mesh.renderOrder = 1;
		contentGroup.add(mesh);

		const id = Date.now() + Math.random();
		interactiveSignals.set(id, {
			mesh: mesh,
			laneIndex: lineIndex,
			speed: 0.2 + Math.random() * 0.5,
			progress: 0,
			history: [],
			assignedColor: pickSignalColor(),
		});
	}

	export function onCharacterTyped(char: string) {
		triggerCharacterBloom(char);
	}
	
	export function triggerAllCharacters() {
		if (!contentGroup || !signalMaterial || !browser) return;
		
		ALL_CHARS.forEach((char, index) => {
			const timeoutId = setTimeout(() => {
				if (contentGroup && signalMaterial) {
					triggerCharacterBloom(char);
				}
			}, index * 5);
		});
	}
	
	export function changeAllSignalsColor(color: string) {
		const newColor = new THREE.Color(color);
		signalColorOverride = newColor;
		
		interactiveSignals.forEach((sig) => {
			sig.assignedColor = newColor;
		});
	}
	
	export function destroyAllSignals() {
		interactiveSignals.forEach((sig) => {
			sig.fadeOut = true;
			sig.fadeProgress = 0;
		});
	}
	
	export function setLoginProcessingMode(enabled: boolean) {
		isLoginProcessing = enabled;
	}
	
	export function collapseToSingleLine(duration: number = 1000) {
		if (!browser) return;
		
		const startHeight = animatedSpreadHeight;
		const endHeight = 0;
		const startTime = Date.now();
		let animationFrameId: number | null = null;
		
		function animateCollapse() {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const easedProgress = 1 - Math.pow(1 - progress, 3);
			animatedSpreadHeight = startHeight * (1 - easedProgress) + endHeight * easedProgress;
			
			if (progress < 1) {
				animationFrameId = requestAnimationFrame(animateCollapse);
			} else {
				animationFrameId = null;
			}
		}
		
		animateCollapse();
	}
	
	export function fadeOutAll(duration: number = 800) {
		if (!browser) return;
		
		isFadingOut = true;
		globalFadeProgress = 0;
		
		const startTime = Date.now();
		let animationFrameId: number | null = null;
		
		function animateFade() {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			globalFadeProgress = progress;
			
			if (progress < 1) {
				animationFrameId = requestAnimationFrame(animateFade);
			} else {
				animationFrameId = null;
			}
		}
		
		animateFade();
	}
	
	export function setRotation(isSmallOrMedium: boolean) {
		CONFIG.globalRotation = isSmallOrMedium ? 90 : 0;
	}
	
	export function resetVisualization() {
		interactiveSignals.forEach((sig) => {
			if (contentGroup && sig.mesh) {
				contentGroup.remove(sig.mesh);
				sig.mesh.geometry.dispose();
			}
		});
		interactiveSignals.clear();
		
		signalColorOverride = null;
		
		isLoginProcessing = false;
		
		animatedSpreadHeight = CONFIG.spreadHeight;
		globalFadeProgress = 0;
		isFadingOut = false;
		
		if (bgMaterial) {
			bgMaterial.opacity = CONFIG.lineOpacity;
		}
	}

	function disposeScene() {
		if (frameId) cancelAnimationFrame(frameId);
		window.removeEventListener("resize", handleResize);

		interactiveSignals.forEach((s) => {
			contentGroup?.remove(s.mesh);
			s.mesh.geometry.dispose();
		});
		interactiveSignals.clear();

		backgroundLines.forEach((l) => {
			contentGroup?.remove(l);
			l.geometry.dispose();
		});
		backgroundLines = [];

		if (bgMaterial) bgMaterial.dispose();
		if (signalMaterial) signalMaterial.dispose();

		if (composer) {
			composer.dispose();
			composer = null;
		}

		if (renderer) {
			renderer.dispose();
			renderer.forceContextLoss?.();
			renderer = null;
		}

		scene = null;
		camera = null;
	}

	onMount(() => {
		if (!browser || !mountRef) return;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(CONFIG.colorBg);
		scene.fog = new THREE.FogExp2(CONFIG.colorBg, 0.002);

		const rect = mountRef.getBoundingClientRect();
		camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 1, 1000);
		camera.position.set(0, 0, 90);
		camera.lookAt(0, 0, 0);
		camera.updateProjectionMatrix();

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(rect.width, rect.height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		mountRef.appendChild(renderer.domElement);

		updatePathDimensions();

		contentGroup = new THREE.Group();
		contentGroup.position.set(CONFIG.positionX, CONFIG.positionY, 0);
		scene.add(contentGroup);

		const renderScene = new RenderPass(scene, camera);
		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(rect.width, rect.height),
			1.5,
			0.4,
			0.85
		);
		bloomPass.threshold = 0;
		bloomPass.strength = CONFIG.bloomStrength;
		bloomPass.radius = CONFIG.bloomRadius;

		composer = new EffectComposer(renderer);
		composer.addPass(renderScene);
		composer.addPass(bloomPass);

		bgMaterial = new THREE.LineBasicMaterial({
			color: CONFIG.colorLine,
			transparent: true,
			opacity: CONFIG.lineOpacity,
			depthWrite: false,
		});

		signalMaterial = new THREE.LineBasicMaterial({
			vertexColors: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: false,
			transparent: true,
		});

		rebuildLines();

		window.addEventListener("resize", handleResize);

		const clock = new THREE.Clock();

		function animate() {
			frameId = requestAnimationFrame(animate);
			const time = clock.getElapsedTime();

			contentGroup.rotation.z = THREE.MathUtils.degToRad(CONFIG.globalRotation);

			backgroundLines.forEach((line) => {
				const positions = line.geometry.attributes.position.array as Float32Array;
				const lineId = line.userData.id;
				for (let j = 0; j < CONSTANTS.segmentCount; j++) {
					const t = j / (CONSTANTS.segmentCount - 1);
					const vec = getPathPoint(t, lineId, time);
					positions[j * 3] = vec.x;
					positions[j * 3 + 1] = vec.y;
					positions[j * 3 + 2] = vec.z;
				}
				line.geometry.attributes.position.needsUpdate = true;
				
				if (isFadingOut && bgMaterial) {
					bgMaterial.opacity = CONFIG.lineOpacity * (1 - globalFadeProgress);
				} else if (!isFadingOut && bgMaterial) {
					bgMaterial.opacity = CONFIG.lineOpacity;
				}
			});

			interactiveSignals.forEach((sig, id) => {
				if (sig.fadeOut) {
					if (sig.fadeProgress === undefined) sig.fadeProgress = 0;
					sig.fadeProgress += 0.02;
					if (sig.fadeProgress >= 1.0) {
						contentGroup?.remove(sig.mesh);
						sig.mesh.geometry.dispose();
						interactiveSignals.delete(id);
						return;
					}
				}

				const speedMultiplier = isLoginProcessing ? 3.0 : 1.0;
				sig.progress += sig.speed * 0.005 * CONFIG.speedGlobal * speedMultiplier;

				if (sig.progress > 1.0 && !sig.fadeOut) {
					contentGroup?.remove(sig.mesh);
					sig.mesh.geometry.dispose();
					interactiveSignals.delete(id);
					return;
				}

				const pos = getPathPoint(sig.progress, sig.laneIndex, time);
				sig.history.push(pos);

				if (sig.history.length > CONFIG.trailLength + 1) {
					sig.history.shift();
				}

				const positions = sig.mesh.geometry.attributes.position.array as Float32Array;
				const colors = sig.mesh.geometry.attributes.color.array as Float32Array;

				const drawCount = Math.max(1, CONFIG.trailLength);
				const currentLen = sig.history.length;

				for (let i = 0; i < drawCount; i++) {
					let index = currentLen - 1 - i;
					if (index < 0) index = 0;

					const p = sig.history[index] || new THREE.Vector3();

					positions[i * 3] = p.x;
					positions[i * 3 + 1] = p.y;
					positions[i * 3 + 2] = p.z;

					let alpha = 1;
					if (CONFIG.trailLength > 0) {
						alpha = Math.max(0, 1 - i / CONFIG.trailLength);
					}

					if (sig.fadeOut && sig.fadeProgress !== undefined) {
						alpha *= (1 - sig.fadeProgress);
					}
					if (isFadingOut) {
						alpha *= (1 - globalFadeProgress);
					}

					const bloomIntensity = 1.8;
					
					const color = signalColorOverride || sig.assignedColor;
					colors[i * 3] = color.r * alpha * bloomIntensity;
					colors[i * 3 + 1] = color.g * alpha * bloomIntensity;
					colors[i * 3 + 2] = color.b * alpha * bloomIntensity;
				}

				sig.mesh.geometry.setDrawRange(0, drawCount);
				sig.mesh.geometry.attributes.position.needsUpdate = true;
				sig.mesh.geometry.attributes.color.needsUpdate = true;
			});

			composer?.render();
		}

		animate();
	});

	onDestroy(disposeScene);
</script>

<div bind:this={mountRef} class="absolute inset-0 w-[140%] h-full"></div>