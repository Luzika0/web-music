import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { requireAuthenticatedSession } from './authenticated.guard';
import { MusicApiService } from '../services/music-api.service';

export async function adminGuard() {
  const api = inject(MusicApiService);
  const router = inject(Router);

  const authentication = await requireAuthenticatedSession(api, router, '/admin');
  if (authentication !== true) {
    return authentication;
  }

  if (api.isAdmin()) {
    return true;
  }

  api.notice.set('Creator studio access requires the admin permission from your account.');
  return router.createUrlTree(['/']);
}
