import { Routes } from '@angular/router';
import { authenticatedGuard } from './core/guards/authenticated.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Home | K-Song',
    loadComponent: () => import('./features/home/home-page.component').then((module) => module.HomePageComponent),
  },
  {
    path: 'discover',
    title: 'Discover | K-Song',
    loadComponent: () => import('./features/discover/discover-page.component').then((module) => module.DiscoverPageComponent),
  },
  {
    path: 'search',
    title: 'Search | K-Song',
    loadComponent: () => import('./features/search/search-page.component').then((module) => module.SearchPageComponent),
  },
  {
    path: 'artists',
    title: 'Artists | K-Song',
    loadComponent: () => import('./features/artists/artists-page.component').then((module) => module.ArtistsPageComponent),
  },
  {
    path: 'library',
    title: 'Your Library | K-Song',
    loadComponent: () => import('./features/library/library-page.component').then((module) => module.LibraryPageComponent),
  },
  {
    path: 'liked',
    title: 'Liked Songs | K-Song',
    loadComponent: () => import('./features/library/liked-songs-page.component').then((module) => module.LikedSongsPageComponent),
  },
  {
    path: 'now-playing',
    title: 'Now Playing | K-Song',
    canActivate: [authenticatedGuard],
    loadComponent: () => import('./features/player/now-playing-page.component').then((module) => module.NowPlayingPageComponent),
  },
  {
    path: 'login',
    title: 'Log in | K-Song',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'register',
    title: 'Join K-Song',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'verify',
    title: 'Verify account | K-Song',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password | K-Song',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'reset-password',
    title: 'Reset password | K-Song',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'admin',
    title: 'Creator studio | K-Song',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-page.component').then((module) => module.AdminPageComponent),
  },
  { path: '**', redirectTo: '' },
];
