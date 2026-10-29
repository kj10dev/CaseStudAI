# GitHub Pages deployment

The `main` branch is deployed to GitHub Pages by `.github/workflows/deploy.yml`.
The Vite base path is configured for this repository's project site:
`https://kj10dev.github.io/CaseStudAI/`.

To enable deployment, open the repository's **Settings → Pages**, set **Build
and deployment → Source** to **GitHub Actions**, and push to `main` (or start
the workflow manually from the **Actions** tab). The workflow builds the app,
adds a `404.html` copy so the `/try-now` client-side route works on direct
visits and refreshes, and publishes the `dist/` artifact.

If the site is moved to a custom domain or a user/organization site, update the
`base` value in `vite.config.ts` to `/` and adjust the project's Pages URL.
This is a static frontend: GitHub Pages does not run the CLI or provide an AI
backend. Visitors still need their own provider API key, and the selected
provider must permit browser requests from the Pages origin.
