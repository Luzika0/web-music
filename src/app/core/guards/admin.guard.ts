import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MusicApiService } from '../services/music-api.service';

export function adminGuard() {
  const api = inject(MusicApiService);
  const router = inject(Router);

  if (api.isAdmin()) {
    return true;
  }

  api.notice.set(api.user()
    ? 'Creator studio access requires the admin permission from your account.'
    : 'Please sign in with an authorized account to open the creator studio.');

  return api.user()
    ? router.createUrlTree(['/'])
    : router.createUrlTree(['/login'], { queryParams: { next: 'admin' } });
}
