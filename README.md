# Family Tree App Starter

A front-end-only family tree app starter built with React, React Flow, rsuite, CSS Modules, and localStorage persistence.

## Environment variables
Create a `.env` file for local development:

```bash
VITE_ADMIN_USERNAME=your-admin-username
VITE_ADMIN_PASSWORD=your-admin-password
```

For Netlify, add the same variables in your site environment settings before deploying.

## Run locally
1. Activate your virtual environment if you use one for your local tooling.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

## Notes
- This is a local-only prototype.
- This login is still not secure for production because Vite exposes build-time environment variables to the client bundle.
- Replace this with real backend auth for production use.
- Image support currently uses a URL or data URL field in the editor.
- Persistence logic is separated into `src/services/localStorageService.js` to make backend migration easier later.


## Local JSON save flow

- The app now reads its shared state from `public/data/family-tree-state.json`.
- While running locally with Vite (`npm run dev` / `pnpm dev`), the admin **Save changes** button writes back into that file.
- On the live site, the app remains read-only and the save button is disabled.
- After saving locally, commit the updated `public/data/family-tree-state.json` file and push to Git so the live site picks up the new data on the next deploy.
