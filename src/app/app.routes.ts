import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Discover | K-Song',
    loadComponent: () => import('./features/discover/discover-page.component').then((module) => module.DiscoverPageComponent),
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
