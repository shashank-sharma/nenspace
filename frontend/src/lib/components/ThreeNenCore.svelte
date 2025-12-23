<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { browser } from "$app/environment";
	import * as THREE from "three";

	export type NenTypeKey =
		| "enhancement"
		| "transmutation"
		| "emission"
		| "conjuration"
		| "manipulation"
		| "specialization";

	type NenConfig = {
		key: NenTypeKey;
		name: string;
		core: string;
		glow: string;
		auraStyle: "solid" | "flow" | "radiate" | "geometric" | "precise" | "chaos";
		speed: number;
		intensity: number;
	};

	const TYPE_CONFIGS: NenConfig[] = [
		{
			key: "enhancement",
			name: "Enhancement",
			core: "#22c55e",
			glow: "#a3e635",
			auraStyle: "solid",
			speed: 0.8,
			intensity: 0.6,
		},
		{
			key: "transmutation",
			name: "Transmutation",
			core: "#c084fc",
			glow: "#7c3aed",
			auraStyle: "flow",
			speed: 1.4,
			intensity: 0.8,
		},
		{
			key: "emission",
			name: "Emission",
			core: "#38bdf8",
			glow: "#0ea5e9",
			auraStyle: "radiate",
			speed: 1.2,
			intensity: 0.7,
		},
		{
			key: "conjuration",
			name: "Conjuration",
			core: "#67e8f9",
			glow: "#06b6d4",
			auraStyle: "geometric",
			speed: 0.6,
			intensity: 0.5,
		},
		{
			key: "manipulation",
			name: "Manipulation",
			core: "#f97316",
			glow: "#fb923c",
			auraStyle: "precise",
			speed: 1.0,
			intensity: 0.65,
		},
		{
			key: "specialization",
			name: "Specialization",
			core: "#ec4899",
			glow: "#f472b6",
			auraStyle: "chaos",
			speed: 1.8,
			intensity: 0.9,
		},
	];

	const { type = "enhancement" as NenTypeKey, autoRotate = true, size = 520 } = $props<{
		type?: NenTypeKey;
		autoRotate?: boolean;
		size?: number;
	}>();

	let mountRef: HTMLDivElement;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let frameId: number;
	let currentCfg = TYPE_CONFIGS[0];

	const targetCore = new THREE.Color(currentCfg.core);
	const targetGlow = new THREE.Color(currentCfg.glow);

	let dodecahedronGroup: THREE.Group;
	let edgeMaterial: THREE.ShaderMaterial;
	let edgeUniforms: {
		uTime: { value: number };
		uColor: { value: THREE.Color };
		uGlow: { value: THREE.Color };
		uStyle: { value: number };
		uSpeed: { value: number };
	};
	let vertexMaterial: THREE.MeshBasicMaterial;
	let auraParticles: THREE.Points;
	let particleMaterial: THREE.ShaderMaterial;
	let particleUniforms: {
		uTime: { value: number };
		uColor: { value: THREE.Color };
		uStyle: { value: number };
		uSpeed: { value: number };
	};
	let advancedAuraGroup: THREE.Group;
	let auraLights: THREE.PointLight[];
	let connectionLines: THREE.Line[] = [];
	let connectionMaterial: THREE.ShaderMaterial | null = null;

	const typeMap = new Map(TYPE_CONFIGS.map((cfg) => [cfg.key, cfg]));

	function getStyleIndex(style: string): number {
		const styles = ["solid", "flow", "radiate", "geometric", "precise", "chaos"];
		return styles.indexOf(style);
	}

	function applyType(next: NenTypeKey) {
		const cfg = typeMap.get(next);
		if (!cfg) return;
		currentCfg = cfg;
		targetCore.set(cfg.core);
		targetGlow.set(cfg.glow);
		const styleIdx = getStyleIndex(cfg.auraStyle);
		if (edgeUniforms) {
			edgeUniforms.uStyle.value = styleIdx;
			edgeUniforms.uSpeed.value = cfg.speed;
		}
		if (particleUniforms) {
			particleUniforms.uStyle.value = styleIdx;
			particleUniforms.uSpeed.value = cfg.speed;
		}
		createAdvancedAuraEffects(styleIdx);
	}

	function createDottedLine(start: THREE.Vector3, end: THREE.Vector3, dotCount: number): THREE.BufferGeometry {
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(dotCount * 3);
		const sizes = new Float32Array(dotCount);
		
		for (let i = 0; i < dotCount; i++) {
			const t = (i + 1) / (dotCount + 1);
			const pos = new THREE.Vector3().lerpVectors(start, end, t);
			positions[i * 3] = pos.x;
			positions[i * 3 + 1] = pos.y;
			positions[i * 3 + 2] = pos.z;
			sizes[i] = 0.08;
		}
		
		geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
		return geometry;
	}

	function linePassesThroughDodecahedron(start: THREE.Vector3, end: THREE.Vector3): boolean {
		const dodecaRadius = 1.0;
		const margin = 0.15;
		const threshold = dodecaRadius + margin;
		
		const lineVec = new THREE.Vector3().subVectors(end, start);
		const lineLength = lineVec.length();
		
		if (lineLength < 0.001) return false;
		
		const dir = lineVec.clone().normalize();
		const originToStart = start.clone();
		const t = -originToStart.dot(dir);
		const clampedT = Math.max(0, Math.min(lineLength, t));
		const closestPoint = new THREE.Vector3().addVectors(start, dir.multiplyScalar(clampedT));
		const distToOrigin = closestPoint.length();
		const startDist = start.length();
		const endDist = end.length();
		
		return distToOrigin < threshold || startDist < threshold || endDist < threshold;
	}

	function createAdvancedAuraEffects(styleIdx: number) {
		if (!advancedAuraGroup) return;
		
		connectionLines.forEach((line) => {
			if (line.geometry) line.geometry.dispose();
			if (line.material) {
				if (Array.isArray(line.material)) {
					line.material.forEach((mat) => mat.dispose());
				} else {
					line.material.dispose();
				}
			}
			advancedAuraGroup.remove(line);
		});
		connectionLines = [];
		if (connectionMaterial) {
			connectionMaterial.dispose();
			connectionMaterial = null;
		}
		
		advancedAuraGroup.children.forEach((child) => {
			if (child instanceof THREE.Mesh && child.geometry) child.geometry.dispose();
			if (child instanceof THREE.Points && child.geometry) child.geometry.dispose();
			if (child instanceof THREE.Line && child.geometry) child.geometry.dispose();
			advancedAuraGroup.remove(child);
		});
		auraLights.forEach((light) => {
			scene?.remove(light);
		});
		auraLights = [];
		
		const color = new THREE.Color(currentCfg.glow);
		
		if (styleIdx === 0) {
			const particlePositions: THREE.Vector3[] = [];
			const connections: Array<[number, number]> = [];
			const baseRadius = 1.9;
			
			const octaVertices = [
				[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
			];
			
			octaVertices.forEach((vertex) => {
				const vec = new THREE.Vector3(vertex[0], vertex[1], vertex[2]).normalize();
				particlePositions.push(vec.multiplyScalar(baseRadius));
			});
			
			const edgeMidpoints: Array<[number, number]> = [
				[0, 2], [0, 3], [0, 4], [0, 5],
				[1, 2], [1, 3], [1, 4], [1, 5],
				[2, 4], [2, 5], [3, 4], [3, 5]
			];
			
			edgeMidpoints.forEach(([i, j]) => {
				const mid = new THREE.Vector3()
					.addVectors(particlePositions[i], particlePositions[j])
					.normalize()
					.multiplyScalar(baseRadius);
				particlePositions.push(mid);
			});
			
			const vertexCount = 6;
			const edgeMidpointCount = 12;
			
			const octaEdges: Array<[number, number]> = [
				[0, 2], [0, 3], [0, 4], [0, 5],
				[1, 2], [1, 3], [1, 4], [1, 5],
				[2, 4], [2, 5], [3, 4], [3, 5]
			];
			
			octaEdges.forEach(([i, j]) => {
				const pos1 = particlePositions[i];
				const pos2 = particlePositions[j];
				if (!linePassesThroughDodecahedron(pos1, pos2)) {
					connections.push([i, j]);
				}
			});
			
			edgeMidpoints.forEach(([i, j], midIdx) => {
				const midpointIdx = vertexCount + midIdx;
				const midPos = particlePositions[midpointIdx];
				
				if (!linePassesThroughDodecahedron(midPos, particlePositions[i])) {
					connections.push([midpointIdx, i]);
				}
				
				if (!linePassesThroughDodecahedron(midPos, particlePositions[j])) {
					connections.push([midpointIdx, j]);
				}
			});
			
			for (let i = 0; i < edgeMidpointCount; i++) {
				const midIdx1 = vertexCount + i;
				const midPos1 = particlePositions[midIdx1];
				const [v1a, v1b] = edgeMidpoints[i];
				
				for (let j = i + 1; j < edgeMidpointCount; j++) {
					const midIdx2 = vertexCount + j;
					const [v2a, v2b] = edgeMidpoints[j];
					
					if (v1a === v2a || v1a === v2b || v1b === v2a || v1b === v2b) {
						const midPos2 = particlePositions[midIdx2];
						if (!linePassesThroughDodecahedron(midPos1, midPos2)) {
							connections.push([midIdx1, midIdx2]);
						}
					}
				}
			}
			
			connectionLines = [];
			connectionMaterial = new THREE.ShaderMaterial({
				uniforms: {
					uTime: { value: 0 },
					uColor: { value: color },
					uSpeed: { value: currentCfg.speed },
				},
				transparent: true,
				linewidth: 2,
				vertexShader: `
          attribute float flow;
          varying float vFlow;
          uniform float uTime;
          uniform float uSpeed;
          
          void main() {
            vFlow = flow;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
				fragmentShader: `
          varying float vFlow;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            float t = uTime * uSpeed;
            float energy = sin(vFlow * 10.0 - t * 2.0) * 0.5 + 0.5;
            energy = pow(energy, 2.0);
            float alpha = 0.2 + energy * 0.3;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
			});
			
			connections.forEach(([startIdx, endIdx]) => {
				const start = particlePositions[startIdx];
				const end = particlePositions[endIdx];
				const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
				const flow = new Float32Array([0, 1]);
				lineGeo.setAttribute("flow", new THREE.BufferAttribute(flow, 1));
				
				if (connectionMaterial) {
					const line = new THREE.Line(lineGeo, connectionMaterial);
					advancedAuraGroup.add(line);
					connectionLines.push(line);
				}
			});
			
			const particleCount = particlePositions.length;
			const positions = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const strengths = new Float32Array(particleCount);
			
			particlePositions.forEach((pos, i) => {
				positions[i * 3] = pos.x;
				positions[i * 3 + 1] = pos.y;
				positions[i * 3 + 2] = pos.z;
				sizes[i] = 0.08 + Math.random() * 0.06;
				const connectionCount = connections.filter(([a, b]) => a === i || b === i).length;
				strengths[i] = 0.7 + (connectionCount / 10.0) * 0.3;
			});
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			particleGeo.setAttribute("strength", new THREE.BufferAttribute(strengths, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute float strength;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            float t = uTime * uSpeed;
            float pulse = sin(t * 1.5) * 0.15 + 0.85;
            float enhancedPulse = pulse * strength;
            vColor = uColor * (0.9 + enhancedPulse * 0.2);
            vOpacity = 0.4 + enhancedPulse * 0.3;
            gl_PointSize = size * enhancedPulse * (400.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
			
			if (dodecahedronGroup && connectionMaterial) {
				const dodecaVertices: THREE.Vector3[] = [];
				dodecahedronGroup.children.forEach((child) => {
					if (child instanceof THREE.Mesh && child.position.length() > 0.9) {
						dodecaVertices.push(child.position.clone());
					}
				});
				
				particlePositions.forEach((particlePos, i) => {
					const isOctaVertex = i < vertexCount && i % 2 === 0;
					const isEdgeMidpoint = i >= vertexCount && i < vertexCount + edgeMidpointCount && i % 3 === 0;
					
					if ((isOctaVertex || isEdgeMidpoint) && dodecaVertices.length > 0) {
						let nearestVertex = dodecaVertices[0];
						let minDist = particlePos.distanceTo(nearestVertex);
						dodecaVertices.forEach((vertex) => {
							const dist = particlePos.distanceTo(vertex);
							if (dist < minDist) {
								minDist = dist;
								nearestVertex = vertex;
							}
						});
						
						const bondGeo = new THREE.BufferGeometry().setFromPoints([particlePos, nearestVertex]);
						const flow = new Float32Array([0, 1]);
						bondGeo.setAttribute("flow", new THREE.BufferAttribute(flow, 1));
						if (connectionMaterial) {
							const bond = new THREE.Line(bondGeo, connectionMaterial);
							advancedAuraGroup.add(bond);
							connectionLines.push(bond);
						}
					}
				});
			}
		} else if (styleIdx === 1) {
			const particleCount = 400;
			const positions = new Float32Array(particleCount * 3);
			const velocities = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const phases = new Float32Array(particleCount);
			
			for (let i = 0; i < particleCount; i++) {
				const radius = 1.3 + Math.random() * 0.6;
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				
				positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
				positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
				positions[i * 3 + 2] = radius * Math.cos(phi);
				
				const dir = new THREE.Vector3(
					positions[i * 3],
					positions[i * 3 + 1],
					positions[i * 3 + 2]
				).normalize();
				velocities[i * 3] = dir.x * 0.02;
				velocities[i * 3 + 1] = dir.y * 0.02;
				velocities[i * 3 + 2] = dir.z * 0.02;
				
				sizes[i] = 0.05 + Math.random() * 0.08;
				phases[i] = Math.random() * Math.PI * 2;
			}
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			particleGeo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute vec3 velocity;
          attribute float phase;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            vec3 pos = position;
            float t = uTime * uSpeed;
            float flow = sin(length(pos) * 4.0 + t * 2.0 + phase) * 0.5 + 0.5;
            float morph = sin(pos.x * 3.0 + t * 1.5) * sin(pos.y * 3.0 + t * 1.8) * sin(pos.z * 3.0 + t * 1.2);
            pos += velocity * t * 2.0;
            pos += normalize(pos) * morph * 0.3;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            float anim = 0.8 + flow * 0.4 + abs(morph) * 0.3;
            vColor = uColor * (1.0 + flow * 0.5);
            vOpacity = 0.6 + flow * 0.4;
            gl_PointSize = size * anim * (400.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
		} else if (styleIdx === 2) {
			const particleCount = 700;
			const positions = new Float32Array(particleCount * 3);
			const velocities = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const lifetimes = new Float32Array(particleCount);
			
			for (let i = 0; i < particleCount; i++) {
				const radius = 1.2 + Math.random() * 0.8;
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				
				positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
				positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
				positions[i * 3 + 2] = radius * Math.cos(phi);
				
				const dir = new THREE.Vector3(
					positions[i * 3],
					positions[i * 3 + 1],
					positions[i * 3 + 2]
				).normalize();
				velocities[i * 3] = dir.x * 0.05;
				velocities[i * 3 + 1] = dir.y * 0.05;
				velocities[i * 3 + 2] = dir.z * 0.05;
				
				sizes[i] = 0.05 + Math.random() * 0.08;
				lifetimes[i] = Math.random();
			}
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			particleGeo.setAttribute("lifetime", new THREE.BufferAttribute(lifetimes, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute vec3 velocity;
          attribute float lifetime;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            vec3 pos = position;
            float t = uTime * uSpeed;
            pos += velocity * t * 3.0;
            float dist = length(pos);
            
            if (dist > 4.0) {
              pos = normalize(pos) * 1.2;
            }
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            float burst = sin(dist * 8.0 - t * 5.0) * 0.5 + 0.5;
            float trail = smoothstep(0.0, 0.3, lifetime + fract(t * 2.0));
            vColor = uColor * (1.0 + burst * 0.5);
            vOpacity = burst * trail * 0.6;
            gl_PointSize = size * (1.0 + burst * 0.3) * (380.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
		} else if (styleIdx === 3) {
			const particleCount = 400;
			const positions = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const phases = new Float32Array(particleCount);
			const shapeTypes = new Float32Array(particleCount);
			const materializeProgress = new Float32Array(particleCount);
			
			for (let i = 0; i < particleCount; i++) {
				const shapeType = Math.floor(Math.random() * 4);
				shapeTypes[i] = shapeType;
				phases[i] = Math.random() * Math.PI * 2;
				materializeProgress[i] = Math.random();
				
				let x, y, z;
				const baseRadius = 1.5;
				
				if (shapeType === 0) {
					const cubeSize = 0.4;
					const cubeIdx = i % 8;
					x = (cubeIdx & 1) ? cubeSize : -cubeSize;
					y = (cubeIdx & 2) ? cubeSize : -cubeSize;
					z = (cubeIdx & 4) ? cubeSize : -cubeSize;
					const angle = Math.floor(i / 8) * (Math.PI * 2 / (particleCount / 8));
					const rotX = x * Math.cos(angle) - z * Math.sin(angle);
					const rotZ = x * Math.sin(angle) + z * Math.cos(angle);
					x = rotX;
					z = rotZ;
					const radius = baseRadius + (Math.floor(i / 8) % 3) * 0.3;
					const dir = new THREE.Vector3(x, y, z).normalize();
					x = dir.x * radius;
					y = dir.y * radius;
					z = dir.z * radius;
				} else if (shapeType === 1) {
					const theta = Math.random() * Math.PI * 2;
					const phi = Math.acos(2 * Math.random() - 1);
					const radius = baseRadius + Math.random() * 0.4;
					x = radius * Math.sin(phi) * Math.cos(theta);
					y = radius * Math.sin(phi) * Math.sin(theta);
					z = radius * Math.cos(phi);
				} else if (shapeType === 2) {
					const pyramidIdx = i % 4;
					const pyramidSize = 0.35;
					if (pyramidIdx === 0) {
						x = 0; y = pyramidSize; z = 0;
					} else {
						const angle = (pyramidIdx - 1) * (Math.PI * 2 / 3);
						x = Math.cos(angle) * pyramidSize;
						y = -pyramidSize * 0.5;
						z = Math.sin(angle) * pyramidSize;
					}
					const angle = Math.floor(i / 4) * (Math.PI * 2 / (particleCount / 4));
					const rotX = x * Math.cos(angle) - z * Math.sin(angle);
					const rotZ = x * Math.sin(angle) + z * Math.cos(angle);
					x = rotX;
					z = rotZ;
					const radius = baseRadius + (Math.floor(i / 4) % 3) * 0.25;
					const dir = new THREE.Vector3(x, y, z).normalize();
					x = dir.x * radius;
					y = dir.y * radius;
					z = dir.z * radius;
				} else {
					const ringAngle = (i % 12) * (Math.PI * 2 / 12);
					const ringRadius = 0.3;
					x = Math.cos(ringAngle) * ringRadius;
					y = (Math.floor(i / 12) % 3 - 1) * 0.3;
					z = Math.sin(ringAngle) * ringRadius;
					const angle = Math.floor(i / 12) * (Math.PI * 2 / (particleCount / 12));
					const rotX = x * Math.cos(angle) - z * Math.sin(angle);
					const rotZ = x * Math.sin(angle) + z * Math.cos(angle);
					x = rotX;
					z = rotZ;
					const radius = baseRadius + (Math.floor(i / 12) % 2) * 0.3;
					const dir = new THREE.Vector3(x, y, z).normalize();
					x = dir.x * radius;
					y = dir.y * radius;
					z = dir.z * radius;
				}
				
				positions[i * 3] = x;
				positions[i * 3 + 1] = y;
				positions[i * 3 + 2] = z;
				sizes[i] = 0.06 + Math.random() * 0.08;
			}
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			particleGeo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
			particleGeo.setAttribute("shapeType", new THREE.BufferAttribute(shapeTypes, 1));
			particleGeo.setAttribute("materializeProgress", new THREE.BufferAttribute(materializeProgress, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute float phase;
          attribute float shapeType;
          attribute float materializeProgress;
          varying vec3 vColor;
          varying float vOpacity;
          varying float vShapeType;
          varying float vMaterialize;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            vec3 pos = position;
            float t = uTime * uSpeed;
            
            float materializeWave = sin(t * 1.5 + phase * 2.0) * 0.5 + 0.5;
            float currentProgress = mod(materializeProgress + materializeWave * 0.3, 1.0);
            
            float gridX = abs(sin(pos.x * 5.0 + t * 1.2));
            float gridY = abs(sin(pos.y * 5.0 + t * 1.2));
            float gridZ = abs(sin(pos.z * 5.0 + t * 1.2));
            float grid = gridX * gridY * gridZ;
            
            float shapeEffect = 0.0;
            if (shapeType < 0.5) {
              shapeEffect = grid * 0.8;
            } else if (shapeType < 1.5) {
              shapeEffect = sin(length(pos) * 4.0 + t * 2.0) * 0.5 + 0.5;
            } else if (shapeType < 2.5) {
              shapeEffect = abs(sin(pos.y * 6.0 + t * 1.5)) * grid;
            } else {
              float ringDist = length(pos.xz);
              shapeEffect = sin(ringDist * 8.0 + t * 2.5) * 0.5 + 0.5;
            }
            
            float materializeIntensity = smoothstep(0.0, 0.6, currentProgress) * smoothstep(1.0, 0.4, currentProgress);
            materializeIntensity = max(materializeIntensity, 0.3);
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vColor = uColor * (1.0 + shapeEffect * 0.6 + grid * 0.4);
            vOpacity = materializeIntensity * (0.4 + shapeEffect * 0.4);
            vShapeType = shapeType;
            vMaterialize = currentProgress;
            gl_PointSize = size * (0.8 + materializeIntensity * 0.4 + shapeEffect * 0.3) * (380.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          varying float vShapeType;
          varying float vMaterialize;
          
          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            
            float shapeMask = 1.0;
            if (vShapeType < 0.5) {
              shapeMask = 1.0 - smoothstep(0.35, 0.5, max(abs(coord.x), abs(coord.y)));
            } else if (vShapeType < 1.5) {
              shapeMask = 1.0 - smoothstep(0.0, 0.5, dist);
            } else if (vShapeType < 2.5) {
              float tri = abs(coord.x) + abs(coord.y) * 1.2;
              shapeMask = 1.0 - smoothstep(0.3, 0.5, tri);
            } else {
              float ringDist = length(coord);
              shapeMask = 1.0 - smoothstep(0.2, 0.35, abs(ringDist - 0.15));
            }
            
            float gridOverlay = abs(sin(coord.x * 20.0)) * abs(sin(coord.y * 20.0));
            gridOverlay = smoothstep(0.7, 1.0, gridOverlay) * 0.3;
            
            float alpha = shapeMask * vOpacity * (1.0 + gridOverlay);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
		} else if (styleIdx === 4) {
			const particleCount = 350;
			const positions = new Float32Array(particleCount * 3);
			const centers = new Float32Array(particleCount * 3);
			const phases = new Float32Array(particleCount);
			const sizes = new Float32Array(particleCount);
			const orbitRadii = new Float32Array(particleCount);
			
			for (let i = 0; i < particleCount; i++) {
				const group = Math.floor(i / 8);
				const indexInGroup = i % 8;
				const groupAngle = (group * Math.PI * 2) / (particleCount / 8);
				
				const centerRadius = 1.5;
				centers[i * 3] = Math.cos(groupAngle) * centerRadius;
				centers[i * 3 + 1] = Math.sin(groupAngle) * centerRadius;
				centers[i * 3 + 2] = (group % 3 - 1) * 0.4;
				
				const orbitRadius = 0.3 + (indexInGroup / 8.0) * 0.2;
				orbitRadii[i] = orbitRadius;
				
				const initialAngle = (indexInGroup * Math.PI * 2) / 8;
				phases[i] = initialAngle;
				
				positions[i * 3] = centers[i * 3] + Math.cos(initialAngle) * orbitRadius;
				positions[i * 3 + 1] = centers[i * 3 + 1] + Math.sin(initialAngle) * orbitRadius;
				positions[i * 3 + 2] = centers[i * 3 + 2];
				
				sizes[i] = 0.06 + Math.random() * 0.08;
			}
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("center", new THREE.BufferAttribute(centers, 3));
			particleGeo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
			particleGeo.setAttribute("orbitRadius", new THREE.BufferAttribute(orbitRadii, 1));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute vec3 center;
          attribute float phase;
          attribute float orbitRadius;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            float t = uTime * uSpeed;
            float angle = phase + t * 1.2;
            vec3 pos = center;
            pos.x += cos(angle) * orbitRadius;
            pos.y += sin(angle) * orbitRadius;
            
            float pulse = sin(t * 2.0 + phase) * 0.15 + 0.85;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            vColor = uColor * pulse;
            vOpacity = 0.6 + pulse * 0.3;
            gl_PointSize = size * pulse * (380.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
		} else {
			const particleCount = 500;
			const positions = new Float32Array(particleCount * 3);
			const velocities = new Float32Array(particleCount * 3);
			const sizes = new Float32Array(particleCount);
			const chaos = new Float32Array(particleCount);
			
			for (let i = 0; i < particleCount; i++) {
				const radius = 1.2 + Math.random() * 0.8;
				const theta = Math.random() * Math.PI * 2;
				const phi = Math.acos(2 * Math.random() - 1);
				
				positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
				positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
				positions[i * 3 + 2] = radius * Math.cos(phi);
				
				velocities[i * 3] = (Math.random() - 0.5) * 0.04;
				velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.04;
				velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
				
				sizes[i] = 0.05 + Math.random() * 0.1;
				chaos[i] = Math.random();
			}
			
			const particleGeo = new THREE.BufferGeometry();
			particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
			particleGeo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
			particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
			particleGeo.setAttribute("chaos", new THREE.BufferAttribute(chaos, 1));
			
			particleUniforms = {
				uTime: { value: 0 },
				uColor: { value: color },
				uStyle: { value: styleIdx },
				uSpeed: { value: currentCfg.speed },
			};
			
			particleMaterial = new THREE.ShaderMaterial({
				uniforms: particleUniforms,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexShader: `
          attribute float size;
          attribute vec3 velocity;
          attribute float chaos;
          varying vec3 vColor;
          varying float vOpacity;
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uSpeed;
          
          void main() {
            vec3 pos = position;
            float t = uTime * uSpeed;
            pos += velocity * t * 2.0;
            float fractal = sin(length(pos) * 7.0 + t * 4.0 + chaos * 10.0) * 
                           sin(pos.x * 5.0 + t * 3.0) * 
                           sin(pos.y * 5.0 + t * 2.0) * 
                           sin(pos.z * 5.0 + t * 5.0);
            pos += normalize(pos) * fractal * 0.4;
            
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            float intensity = 0.7 + abs(fractal) * 0.5;
            vColor = uColor * intensity;
            vOpacity = 0.5 + abs(fractal) * 0.5;
            gl_PointSize = size * (1.0 + abs(fractal) * 0.8) * (400.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
				fragmentShader: `
          varying vec3 vColor;
          varying float vOpacity;
          
          void main() {
            float dist = distance(gl_PointCoord, vec2(0.5));
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(vColor, alpha * vOpacity);
          }
        `,
			});
			
			auraParticles = new THREE.Points(particleGeo, particleMaterial);
			advancedAuraGroup.add(auraParticles);
		}
	}

	function resize() {
		if (!renderer || !camera || !mountRef) return;
		const rect = mountRef.getBoundingClientRect();
		camera.aspect = rect.width / rect.height;
		camera.updateProjectionMatrix();
		renderer.setSize(rect.width, rect.height);
	}

	function disposeScene() {
		cancelAnimationFrame(frameId);
		window.removeEventListener("resize", resize);
		if (renderer) {
			renderer.dispose();
			renderer.forceContextLoss?.();
		}
		if (edgeMaterial) edgeMaterial.dispose();
		if (vertexMaterial) vertexMaterial.dispose();
		if (particleMaterial) particleMaterial.dispose();
		
		connectionLines.forEach((line) => {
			if (line.geometry) line.geometry.dispose();
			if (line.material) {
				if (Array.isArray(line.material)) {
					line.material.forEach((mat) => mat.dispose());
				} else {
					line.material.dispose();
				}
			}
		});
		connectionLines = [];
		if (connectionMaterial) {
			connectionMaterial.dispose();
			connectionMaterial = null;
		}
		
		if (advancedAuraGroup) {
			advancedAuraGroup.children.forEach((child) => {
				if (child instanceof THREE.Mesh) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
				} else if (child instanceof THREE.Points) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
				} else if (child instanceof THREE.Line) {
					if (child.geometry) child.geometry.dispose();
					if (child.material) {
						if (Array.isArray(child.material)) {
							child.material.forEach((mat) => mat.dispose());
						} else {
							child.material.dispose();
						}
					}
				}
			});
		}
		
		auraLights.forEach((light) => {
			scene?.remove(light);
			light.dispose();
		});
		auraLights = [];
		
		scene = null;
		camera = null;
		renderer = null;
	}

	onDestroy(disposeScene);

	onMount(() => {
		if (!browser || !mountRef) return;

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
		camera.position.set(0, 0, 5.5);

		renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		mountRef.appendChild(renderer.domElement);

		dodecahedronGroup = new THREE.Group();
		const dodecaGeometry = new THREE.DodecahedronGeometry(1.0);
		
		const edgesGeometry = new THREE.EdgesGeometry(dodecaGeometry);
		const edgesPosAttr = edgesGeometry.attributes.position;
		
		const posAttr = dodecaGeometry.attributes.position;
		const vertexMap = new Map<string, THREE.Vector3>();
		const vertices: THREE.Vector3[] = [];
		
		for (let i = 0; i < posAttr.count; i++) {
			const x = posAttr.getX(i);
			const y = posAttr.getY(i);
			const z = posAttr.getZ(i);
			const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
			
			if (!vertexMap.has(key)) {
				const vertex = new THREE.Vector3(x, y, z);
				vertexMap.set(key, vertex);
				vertices.push(vertex);
			}
		}
		
		const edges: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
		for (let i = 0; i < edgesPosAttr.count; i += 2) {
			const start = new THREE.Vector3(
				edgesPosAttr.getX(i),
				edgesPosAttr.getY(i),
				edgesPosAttr.getZ(i)
			);
			const end = new THREE.Vector3(
				edgesPosAttr.getX(i + 1),
				edgesPosAttr.getY(i + 1),
				edgesPosAttr.getZ(i + 1)
			);
			edges.push({ start, end });
		}
		
		edgeUniforms = {
			uTime: { value: 0 },
			uColor: { value: new THREE.Color(currentCfg.core) },
			uGlow: { value: new THREE.Color(currentCfg.glow) },
			uStyle: { value: getStyleIndex(currentCfg.auraStyle) },
			uSpeed: { value: currentCfg.speed },
		};
		edgeMaterial = new THREE.ShaderMaterial({
			uniforms: edgeUniforms,
			transparent: true,
			depthWrite: false,
			vertexShader: `
        attribute float size;
        varying vec3 vColor;
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uGlow;
        uniform float uSpeed;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float t = uTime * uSpeed;
          float pulse = sin(t * 2.0) * 0.1 + 0.9;
          vColor = mix(uColor, uGlow, 0.7);
          gl_PointSize = size * pulse * (400.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
			fragmentShader: `
        varying vec3 vColor;
        
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha * 1.0);
        }
      `,
		});
		
		edges.forEach((edge) => {
			const dotCount = 15;
			const lineGeo = createDottedLine(edge.start, edge.end, dotCount);
			const edgeDots = new THREE.Points(lineGeo, edgeMaterial);
			dodecahedronGroup.add(edgeDots);
		});
		
		vertexMaterial = new THREE.MeshBasicMaterial({
			color: new THREE.Color(currentCfg.glow),
			transparent: true,
			opacity: 0.9,
		});
		
		const vertexGeometry = new THREE.SphereGeometry(0.05, 16, 16);
		vertices.forEach((vertex) => {
			const dot = new THREE.Mesh(vertexGeometry, vertexMaterial);
			dot.position.copy(vertex);
			dodecahedronGroup.add(dot);
		});
		
		scene.add(dodecahedronGroup);

		advancedAuraGroup = new THREE.Group();
		auraLights = [];
		
		createAdvancedAuraEffects(getStyleIndex(currentCfg.auraStyle));
		
		scene.add(advancedAuraGroup);

		resize();
		window.addEventListener("resize", resize);

		const clock = new THREE.Clock();
		function animate() {
			frameId = requestAnimationFrame(animate);
			const t = clock.getElapsedTime();
			
			if (edgeUniforms) {
				edgeUniforms.uTime.value = t;
				edgeUniforms.uColor.value.lerp(targetCore, 0.04);
				edgeUniforms.uGlow.value.lerp(targetGlow, 0.04);
			}
			
			if (vertexMaterial) {
				vertexMaterial.color.lerp(targetGlow, 0.05);
			}
			
			if (connectionMaterial && connectionMaterial.uniforms) {
				connectionMaterial.uniforms.uTime.value = t;
				connectionMaterial.uniforms.uSpeed.value = currentCfg.speed;
				if (connectionMaterial.uniforms.uColor) {
					if (connectionMaterial.uniforms.uColor.value instanceof THREE.Color) {
						connectionMaterial.uniforms.uColor.value.lerp(targetGlow, 0.05);
					} else {
						connectionMaterial.uniforms.uColor.value = targetGlow;
					}
				}
			}
			
			if (particleUniforms && auraParticles) {
				particleUniforms.uTime.value = t;
				particleUniforms.uStyle.value = getStyleIndex(currentCfg.auraStyle);
				particleUniforms.uSpeed.value = currentCfg.speed;
				particleUniforms.uColor.value.lerp(targetGlow, 0.05);
				
				const styleIdx = getStyleIndex(currentCfg.auraStyle);
				if (styleIdx === 1 || styleIdx === 2 || styleIdx === 5) {
					const positions = auraParticles.geometry.attributes.position;
					const velocities = auraParticles.geometry.attributes.velocity;
					
					if (positions && velocities) {
						const posArray = positions.array as Float32Array;
						const velArray = velocities.array as Float32Array;
						
						for (let i = 0; i < posArray.length; i += 3) {
							posArray[i] += velArray[i] * 0.016;
							posArray[i + 1] += velArray[i + 1] * 0.016;
							posArray[i + 2] += velArray[i + 2] * 0.016;
							
							if (styleIdx === 2) {
								const dist = Math.sqrt(
									posArray[i] ** 2 + posArray[i + 1] ** 2 + posArray[i + 2] ** 2
								);
								if (dist > 3.5) {
									const dir = new THREE.Vector3(
										posArray[i],
										posArray[i + 1],
										posArray[i + 2]
									).normalize();
									posArray[i] = dir.x * 1.2;
									posArray[i + 1] = dir.y * 1.2;
									posArray[i + 2] = dir.z * 1.2;
								}
							}
						}
						
						positions.needsUpdate = true;
					}
				}
			}
			
			if (auraLights.length > 0) {
				auraLights.forEach((light, i) => {
					const styleIdx = getStyleIndex(currentCfg.auraStyle);
					if (styleIdx === 2) {
						const angle = (i * Math.PI * 2) / auraLights.length;
						const pulse = Math.sin(t * 3.0 + i) * 0.3 + 1.0;
						light.position.x = Math.cos(angle) * 2.0 * pulse;
						light.position.y = Math.sin(angle) * 2.0 * pulse;
						light.intensity = 2.0 + Math.sin(t * 4.0 + i) * 1.0;
					} else if (styleIdx === 5) {
						light.position.x += (Math.random() - 0.5) * 0.02;
						light.position.y += (Math.random() - 0.5) * 0.02;
						light.position.z += (Math.random() - 0.5) * 0.02;
						light.intensity = 2.0 + Math.sin(t * 5.0 + i) * 1.5;
					}
				});
			}

			if (autoRotate) {
				dodecahedronGroup.rotation.y += 0.003;
				dodecahedronGroup.rotation.x += 0.001;
				if (advancedAuraGroup) {
					advancedAuraGroup.rotation.y += 0.001;
					advancedAuraGroup.rotation.x += 0.0005;
				}
			}

			renderer?.render(scene!, camera!);
		}

		animate();
	});

	$effect(() => {
		if (type) {
			applyType(type);
		}
	});
</script>

<div
	bind:this={mountRef}
	class="relative w-full h-full"
	style={`min-height:${size}px; aspect-ratio: 1 / 1;`}
>
	{#if !browser}
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="relative w-64 h-64">
				<div
					class="absolute inset-0 opacity-60 blur-2xl"
					style={`background: radial-gradient(circle, ${currentCfg.core}, transparent 65%);`}
				></div>
				<svg
					class="absolute inset-0 w-full h-full"
					viewBox="0 0 200 200"
					style={`filter: drop-shadow(0 0 20px ${currentCfg.glow});`}
				>
					<polygon
						points="100,30 130,50 150,80 130,110 100,130 70,110 50,80 70,50"
						fill="none"
						stroke={currentCfg.glow}
						stroke-width="1.5"
						stroke-dasharray="3,3"
						opacity="0.6"
						class="animate-pulse"
					/>
					<polygon
						points="100,50 120,65 130,90 120,115 100,130 80,115 70,90 80,65"
						fill="none"
						stroke={currentCfg.core}
						stroke-width="1"
						stroke-dasharray="2,2"
						opacity="0.4"
					/>
					<circle cx="100" cy="30" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="130" cy="50" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="150" cy="80" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="130" cy="110" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="100" cy="130" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="70" cy="110" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="50" cy="80" r="4" fill={currentCfg.glow} opacity="0.9" />
					<circle cx="70" cy="50" r="4" fill={currentCfg.glow} opacity="0.9" />
				</svg>
			</div>
		</div>
	{/if}
</div>
