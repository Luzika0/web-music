import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MusicApiService } from '../../core/services/music-api.service';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot-password' | 'reset-password';

@Component({
  selector: 'app-auth-page',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-layout">
      <div class="auth-art" aria-hidden="true">
        <span class="auth-disc"></span><span class="auth-note">♫</span>
        <p>Every good thing<br />starts with a song.</p>
        <span class="auth-art-small">A HOME FOR THE SOUNDTRACK OF YOU</span>
      </div>
      <div class="auth-panel">
        <a class="back-link" routerLink="/">← Back to discovery</a>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ heading }}</h1>
        <p class="auth-intro">{{ introduction }}</p>
        @if (error) { <div class="inline-alert error-alert" role="alert">{{ error }}</div> }
        @if (success) { <div class="inline-alert success-alert" role="status">{{ success }}</div> }

        @if (mode === 'register') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="register-name">Your name</label>
            <input id="register-name" name="name" [(ngModel)]="name" autocomplete="name" required />
            <label for="register-username">Username</label>
            <input id="register-username" name="username" [(ngModel)]="userName" autocomplete="username" required />
            <label for="register-email">Email address</label>
            <input id="register-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <label for="register-dob">Date of birth</label>
            <input id="register-dob" name="dob" [(ngModel)]="dob" type="date" autocomplete="bday" required />
            <label for="register-password">Password</label>
            <input id="register-password" name="password" [(ngModel)]="password" type="password" autocomplete="new-password" minlength="8" required />
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              {{ submitting ? 'Creating your account…' : 'Create account' }}
            </button>
          </form>
          <p class="auth-switch">Already one of us? <a routerLink="/login">Log in</a></p>
        } @else if (mode === 'verify') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="verify-email">Email address</label>
            <input id="verify-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <label for="verify-otp">Verification code</label>
            <input id="verify-otp" name="otp" [(ngModel)]="otp" inputmode="numeric" autocomplete="one-time-code" minlength="4" maxlength="8" required />
            <p class="field-hint">Enter the code sent to your email address.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              {{ submitting ? 'Verifying…' : 'Verify account' }}
            </button>
          </form>
          <p class="auth-switch">Already verified? <a routerLink="/login">Log in</a></p>
        } @else if (mode === 'login') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="login-identity">Email or username</label>
            <input id="login-identity" name="identity" [(ngModel)]="identity" autocomplete="username" required />
            <label for="login-password">Password</label>
            <input id="login-password" name="password" [(ngModel)]="password" type="password" autocomplete="current-password" required />
            <div class="forgot-row"><span>Welcome back.</span><a routerLink="/forgot-password">Forgot password?</a></div>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              {{ submitting ? 'Signing you in…' : 'Log in' }}
            </button>
          </form>
          <p class="auth-switch">New to K-Song? <a routerLink="/register">Create an account</a></p>
        } @else if (mode === 'forgot-password') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="forgot-email">Email address</label>
            <input id="forgot-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <p class="field-hint">We’ll send a one-time code to the email linked to your account.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              {{ submitting ? 'Sending code…' : 'Send reset code' }}
            </button>
          </form>
          <p class="auth-switch"><a routerLink="/login">Back to log in</a></p>
        } @else {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="reset-email">Email address</label>
            <input id="reset-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <label for="reset-otp">Reset code</label>
            <input id="reset-otp" name="otp" [(ngModel)]="otp" inputmode="numeric" autocomplete="one-time-code" minlength="4" maxlength="8" required />
            <label for="reset-password">New password</label>
            <input id="reset-password" name="password" [(ngModel)]="password" type="password" autocomplete="new-password" minlength="8" required />
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              {{ submitting ? 'Updating password…' : 'Reset password' }}
            </button>
          </form>
          <p class="auth-switch"><a routerLink="/login">Back to log in</a></p>
        }
      </div>
    </section>
  `,
})
export class AuthPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(MusicApiService);
  private readonly title = inject(Title);
  private readonly changeDetector = inject(ChangeDetectorRef);
  mode: AuthMode = 'login';
  name = '';
  userName = '';
  email = '';
  identity = '';
  password = '';
  dob = '';
  otp = '';
  error = '';
  success = '';
  submitting = false;

  get heading(): string {
    return {
      login: 'Welcome back.',
      register: 'Find your people.',
      verify: 'One quick check.',
      'forgot-password': 'Let’s get you back.',
      'reset-password': 'A fresh start.',
    }[this.mode];
  }

  get eyebrow(): string {
    return {
      login: 'YOUR MUSIC, WAITING',
      register: 'MAKE YOURSELF AT HOME',
      verify: 'ALMOST THERE',
      'forgot-password': 'IT HAPPENS',
      'reset-password': 'NEW PASSWORD, NEW DAY',
    }[this.mode];
  }

  get introduction(): string {
    return {
      login: 'Pick up right where the music left you.',
      register: 'Join a community made for the love of listening.',
      verify: 'Let’s make sure it’s really you.',
      'forgot-password': 'We’ll send you a code to get back into your account.',
      'reset-password': 'Enter the code we sent and choose a new password.',
    }[this.mode];
  }

  ngOnInit(): void {
    const path = this.route.snapshot.url[0]?.path;
    if (path === 'register' || path === 'verify' || path === 'forgot-password' || path === 'reset-password') {
      this.mode = path;
    }
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    if (this.mode === 'login' && this.route.snapshot.queryParamMap.get('verified') === '1') {
      this.success = 'Your email is verified. You can now log in.';
    }
    if (this.route.snapshot.queryParamMap.get('reason') === 'session-expired') {
      this.error = 'Your session expired. Please sign in again.';
    }
    this.title.setTitle(`K-Song | ${this.heading}`);
  }

  async submit(): Promise<void> {
    this.error = '';
    this.success = '';
    this.submitting = true;
    try {
      switch (this.mode) {
        case 'register':
          await this.api.register({
            name: this.name,
            userName: this.userName,
            email: this.email,
            password: this.password,
            dob: this.dob,
          });
          await this.router.navigate(['/verify'], { queryParams: { email: this.email } });
          break;
        case 'verify':
          await this.api.verifyOtp(this.email, this.otp);
          await this.router.navigate(['/login'], { queryParams: { verified: '1' } });
          break;
        case 'login': {
          await this.api.login(this.identity, this.password);
          const next = this.route.snapshot.queryParamMap.get('next');
          await this.router.navigate([next === 'admin' && this.api.isAdmin() ? '/admin' : '/']);
          break;
        }
        case 'forgot-password':
          await this.api.requestPasswordReset(this.email);
          await this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
          break;
        case 'reset-password':
          await this.api.resetPassword(this.email, this.otp, this.password);
          this.success = 'Your password has been updated. You can log in now.';
          this.password = '';
          break;
      }
    } catch (error) {
      this.error = this.api.toUserMessage(error);
    } finally {
      this.submitting = false;
      this.changeDetector.markForCheck();
    }
  }
}
