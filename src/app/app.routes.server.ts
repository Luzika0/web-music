import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // These screens depend on browser session state, local storage, or browser-only data.
  // Rendering them on the server can race with client navigation and cannot authorize a user.
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'verify', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'now-playing', renderMode: RenderMode.Client },
  { path: 'search', renderMode: RenderMode.Client },
  { path: 'library', renderMode: RenderMode.Client },
  { path: 'liked', renderMode: RenderMode.Client },
  // Public catalogue pages can still use request-time SSR.
  { path: '**', renderMode: RenderMode.Server },
];
