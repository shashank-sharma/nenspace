<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import type { VisualizerMode } from '../constants';

    interface Props {
        audioElement: HTMLAudioElement | null;
        mode?: VisualizerMode;
        barCount?: number;
        height?: number;
        color?: string;
    }

    let { 
        audioElement, 
        mode = 'bars',
        barCount = 64,
        height = 100,
        color = 'hsl(var(--primary))'
    }: Props = $props();

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let animationId: number | null = null;
    let dataArray: Uint8Array | null = null;
    let isInitialized = $state(false);

    function initializeAudio() {
        if (!browser || !audioElement || isInitialized) return;

        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = barCount * 2;
            analyser.smoothingTimeConstant = 0.8;

            source = audioContext.createMediaElementSource(audioElement);
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            dataArray = new Uint8Array(analyser.frequencyBinCount);
            isInitialized = true;

            startVisualization();
        } catch (error) {
            console.error('Failed to initialize audio visualization:', error);
        }
    }

    function startVisualization() {
        if (!ctx || !analyser || !dataArray) return;

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser!.getByteFrequencyData(dataArray!);

            ctx!.clearRect(0, 0, canvas.width, canvas.height);

            switch (mode) {
                case 'bars':
                    drawBars();
                    break;
                case 'waveform':
                    drawWaveform();
                    break;
                case 'circular':
                    drawCircular();
                    break;
            }
        };

        draw();
    }

    function drawBars() {
        if (!ctx || !dataArray) return;

        const barWidth = canvas.width / barCount;
        const heightScale = canvas.height / 255;

        ctx.fillStyle = color;

        for (let i = 0; i < barCount; i++) {
            const barHeight = dataArray[i] * heightScale;
            const x = i * barWidth;
            const y = canvas.height - barHeight;

            ctx.fillRect(x, y, barWidth - 1, barHeight);
        }
    }

    function drawWaveform() {
        if (!ctx || !analyser) return;

        const waveData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(waveData);

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = canvas.width / waveData.length;
        let x = 0;

        for (let i = 0; i < waveData.length; i++) {
            const v = waveData[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    }

    function drawCircular() {
        if (!ctx || !dataArray) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.6;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        for (let i = 0; i < barCount; i++) {
            const angle = (i / barCount) * Math.PI * 2;
            const amplitude = dataArray[i] / 255;
            const length = radius * 0.3 * amplitude;

            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + length);
            const y2 = centerY + Math.sin(angle) * (radius + length);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    function handleResize() {
        if (!canvas) return;
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx?.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    $effect(() => {
        if (audioElement && !isInitialized) {
            initializeAudio();
        }
    });

    onMount(() => {
        if (!browser || !canvas) return;

        ctx = canvas.getContext('2d');
        handleResize();

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    onDestroy(() => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
    });
</script>

<canvas
    bind:this={canvas}
    class="w-full"
    style="height: {height}px;"
></canvas>




