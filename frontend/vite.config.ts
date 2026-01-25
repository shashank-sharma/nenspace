import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const host = process.env.TAURI_DEV_HOST;
const isProduction = process.env.NODE_ENV === 'production';

// Read package.json to get version
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

function getGitCommitShort(): string {
	// Prefer CI-provided env var if present (e.g. GitHub Actions)
	const fromEnv =
		process.env.VITE_GIT_COMMIT ||
		process.env.GIT_COMMIT ||
		process.env.COMMIT_SHA ||
		process.env.GITHUB_SHA;

	if (fromEnv) return String(fromEnv).slice(0, 8);

	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		// Git may not be available in some build environments; keep it non-fatal.
		return 'unknown';
	}
}

// PWA plugin configuration (only enabled in production builds)
const pwaPlugin = isProduction ? VitePWA({
	registerType: 'autoUpdate',
	includeAssets: ['favicon.png', 'fonts/**/*', 'icons/**/*'],
	manifest: {
		name: 'Nen Space',
		short_name: 'NenSpace',
		description: 'Your personal dashboard for productivity and organization',
		theme_color: '#000000',
		background_color: '#ffffff',
		display: 'standalone',
		orientation: 'portrait',
		scope: '/',
		start_url: '/',
		icons: [
			{
				src: '/icons/apple-icon-180.png',
				sizes: '180x180',
				type: 'image/png'
			},
			{
				src: '/icons/manifest-icon-192.maskable.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/icons/manifest-icon-512.maskable.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/icons/manifest-icon-512.maskable.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		]
	},
	workbox: {
		globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
		runtimeCaching: [
			{
				urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
				handler: 'CacheFirst',
				options: {
					cacheName: 'google-fonts-cache',
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
					},
					cacheableResponse: {
						statuses: [0, 200]
					}
				}
			},
			{
				urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
				handler: 'CacheFirst',
				options: {
					cacheName: 'gstatic-fonts-cache',
					expiration: {
						maxEntries: 10,
						maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
					},
					cacheableResponse: {
						statuses: [0, 200]
					}
				}
			},
			{
				urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
				handler: 'CacheFirst',
				options: {
					cacheName: 'image-cache',
					expiration: {
						maxEntries: 60,
						maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
					}
				}
			}
		],
		navigateFallback: '/index.html',
		navigateFallbackDenylist: [/^\/api\//]
	}
}) : null;

export default defineConfig({
	plugins: [
		sveltekit(),
		...(pwaPlugin ? [pwaPlugin] : [])
	].filter(Boolean),
	optimizeDeps: {
		exclude: ['fsevents'],
		include: ['react', 'react-dom', '@excalidraw/excalidraw'],
		esbuildOptions: {
			mainFields: ['module', 'main']
		}
	},
	resolve: {
		dedupe: ['react', 'react-dom'],
		alias: {
			'react': 'react',
			'react-dom': 'react-dom'
		}
	},
	ssr: {
		noExternal: ['@excalidraw/excalidraw']
	},
	server: {
        host: host || false,
        port: 5173,
        strictPort: true,
        hmr: host
            ? {
                protocol: 'ws',
                host,
                port: 1421,
            }
            : undefined,
    },
    // Tauri expects a fixed port, fail if that port is not available
    clearScreen: false,
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ['VITE_', 'TAURI_'],
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
		__GIT_COMMIT__: JSON.stringify(getGitCommitShort()),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
});
