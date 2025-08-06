import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/sveltekit-haiku' : ''
		},
		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				// Ignore missing favicon
				if (path === '/favicon.png') {
					return;
				}
				
				// Throw other errors
				throw new Error(message);
			}
		}
	}
};

export default config;