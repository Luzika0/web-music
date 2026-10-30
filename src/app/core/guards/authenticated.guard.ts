import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { MusicApiService } from '../services/music-api.service';

export async function requireAuthenticatedSession(api: MusicApiService, router: Router, next: string) {
  if (!api.user()) {
    return router.createUrlTree(['/login'], { queryParams: { next } });
  }

  try {
    await api.refreshPlaybackAuthorization();
    return true;
  } catch {
    return router.createUrlTree(['/login'], { queryParams: { reason: 'session-expired' } });
  }
}

export function authenticatedGuard(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  return requireAuthenticatedSession(inject(MusicApiService), inject(Router), state.url);
}
