import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { MusicApiService } from '../services/music-api.service';

export async function requireAuthenticatedSession(api: MusicApiService, router: Router, next: string) {
  if (!api.user()) {
    return router.createUrlTree(['/login'], { queryParams: { next } });
  }

  const ready = await api.ensureSessionReady();
  return ready ? true : router.createUrlTree(['/login'], { queryParams: { next } });
}

export function authenticatedGuard(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
  return requireAuthenticatedSession(inject(MusicApiService), inject(Router), state.url);
}
