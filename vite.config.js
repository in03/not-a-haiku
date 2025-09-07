import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['onnxruntime-web']
	},
	server: {
		port: 5173,
		headers: {
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin'
		},
		allowedHosts: [
			"dell-lappy2.hippo-pineapplefish.ts.net",
		],
	}
});