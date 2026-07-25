import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from a GitHub Pages project
  // subpath (/peters-riff-adventure/) without hardcoding the repo name.
  base: './',
});
