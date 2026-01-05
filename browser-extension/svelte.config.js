import sveltePreprocess from 'svelte-preprocess';

export default {
  preprocess: sveltePreprocess(),
  compilerOptions: {
    dev: process.env.NODE_ENV !== 'production',
    immutable: true
  }
};
