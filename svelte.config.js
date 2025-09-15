import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Vercel adapter handles most configuration automatically
		}),
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