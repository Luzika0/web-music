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
    <section class="auth-layout" [attr.data-auth-mode]="mode" aria-labelledby="auth-title">
      <div class="auth-art" aria-hidden="true">
        <span class="auth-disc"></span><svg class="auth-note" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg>
        <p>Every good thing<br />starts with a song.</p>
        <span class="auth-art-small">A HOME FOR THE SOUNDTRACK OF YOU</span>
      </div>
      <div class="auth-panel">
        <a class="back-link" routerLink="/">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6M9 12h11" /></svg>
          <span>Back to discovery</span>
        </a>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1 id="auth-title">{{ heading }}</h1>
        <p class="auth-intro">{{ introduction }}</p>
        @if (error) { <div class="inline-alert error-alert" role="alert">{{ error }}</div> }
        @if (success) { <div class="inline-alert success-alert" role="status">{{ success }}</div> }

        @if (mode === 'register') {
          <form class="form-stack auth-register-form" (ngSubmit)="submit()" #authForm="ngForm">
            <div class="auth-field-pair">
              <div class="auth-field">
                <label for="register-name">Your name</label>
                <input id="register-name" name="name" [(ngModel)]="name" autocomplete="name" required />
              </div>
              <div class="auth-field">
                <label for="register-username">Username</label>
                <input id="register-username" name="username" [(ngModel)]="userName" autocomplete="username" required />
              </div>
            </div>
            <div class="auth-field-pair">
              <div class="auth-field">
                <label for="register-email">Email address</label>
                <input id="register-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
              </div>
              <div class="auth-field">
                <label for="register-dob">Date of birth</label>
                <input id="register-dob" name="dob" [(ngModel)]="dob" type="date" [max]="today" autocomplete="bday" required />
              </div>
            </div>
            <label for="register-password">Password</label>
            <div class="auth-password-field">
              <input id="register-password" name="password" [(ngModel)]="password" [type]="passwordVisible ? 'text' : 'password'" autocomplete="new-password" minlength="8" required />
              <button type="button" class="password-visibility" (click)="togglePasswordVisibility()"
                [attr.aria-label]="passwordVisible ? 'Hide password' : 'Show password'"
                [title]="passwordVisible ? 'Hide password' : 'Show password'">
                @if (passwordVisible) {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.5 5.2 8.5 7a8.8 8.8 0 0 1-2.2 3.2M6.2 6.2C3.9 7.7 2.5 10.2 2.5 12c0 1.8 3.3 7 9.5 7a10.7 10.7 0 0 0 3.4-.6" /></svg>
                } @else {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                }
              </button>
            </div>
            <p class="field-hint">Use at least 8 characters.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              @if (submitting) { <span class="button-loading-spinner" aria-hidden="true"></span> }
              <span>{{ submitting ? 'Creating your account…' : 'Create account' }}</span>
            </button>
          </form>
          <p class="auth-switch">Already one of us? <a routerLink="/login">Log in</a></p>
        } @else if (mode === 'verify') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="verify-email">Email address</label>
            <input id="verify-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <label for="verify-otp">Verification code</label>
            <input id="verify-otp" class="auth-code-input" name="otp" [(ngModel)]="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required />
            <p class="field-hint">Enter the code sent to your email address.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              @if (submitting) { <span class="button-loading-spinner" aria-hidden="true"></span> }
              <span>{{ submitting ? 'Verifying…' : 'Verify account' }}</span>
            </button>
          </form>
          <p class="auth-switch">Already verified? <a routerLink="/login">Log in</a></p>
        } @else if (mode === 'login') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="login-identity">Email or username</label>
            <input id="login-identity" name="identity" [(ngModel)]="identity" autocomplete="username" required />
            <label for="login-password">Password</label>
            <div class="auth-password-field">
              <input id="login-password" name="password" [(ngModel)]="password" [type]="passwordVisible ? 'text' : 'password'" autocomplete="current-password" required />
              <button type="button" class="password-visibility" (click)="togglePasswordVisibility()"
                [attr.aria-label]="passwordVisible ? 'Hide password' : 'Show password'"
                [title]="passwordVisible ? 'Hide password' : 'Show password'">
                @if (passwordVisible) {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.5 5.2 8.5 7a8.8 8.8 0 0 1-2.2 3.2M6.2 6.2C3.9 7.7 2.5 10.2 2.5 12c0 1.8 3.3 7 9.5 7a10.7 10.7 0 0 0 3.4-.6" /></svg>
                } @else {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                }
              </button>
            </div>
            <div class="forgot-row"><span>Welcome back.</span><a routerLink="/forgot-password">Forgot password?</a></div>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              @if (submitting) { <span class="button-loading-spinner" aria-hidden="true"></span> }
              <span>{{ submitting ? 'Signing you in…' : 'Log in' }}</span>
            </button>
          </form>
          <p class="auth-switch">New to K-Song? <a routerLink="/register">Create an account</a></p>
        } @else if (mode === 'forgot-password') {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="forgot-email">Email address</label>
            <input id="forgot-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <p class="field-hint">We’ll send a one-time code to the email linked to your account.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              @if (submitting) { <span class="button-loading-spinner" aria-hidden="true"></span> }
              <span>{{ submitting ? 'Sending code…' : 'Send reset code' }}</span>
            </button>
          </form>
          <p class="auth-switch"><a routerLink="/login">Back to log in</a></p>
        } @else {
          <form class="form-stack" (ngSubmit)="submit()" #authForm="ngForm">
            <label for="reset-email">Email address</label>
            <input id="reset-email" name="email" [(ngModel)]="email" type="email" autocomplete="email" required />
            <label for="reset-otp">Reset code</label>
            <input id="reset-otp" class="auth-code-input" name="otp" [(ngModel)]="otp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" minlength="4" maxlength="8" required />
            <label for="reset-password">New password</label>
            <div class="auth-password-field">
              <input id="reset-password" name="password" [(ngModel)]="password" [type]="passwordVisible ? 'text' : 'password'" autocomplete="new-password" minlength="8" required />
              <button type="button" class="password-visibility" (click)="togglePasswordVisibility()"
                [attr.aria-label]="passwordVisible ? 'Hide password' : 'Show password'"
                [title]="passwordVisible ? 'Hide password' : 'Show password'">
                @if (passwordVisible) {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.5 5.2 8.5 7a8.8 8.8 0 0 1-2.2 3.2M6.2 6.2C3.9 7.7 2.5 10.2 2.5 12c0 1.8 3.3 7 9.5 7a10.7 10.7 0 0 0 3.4-.6" /></svg>
                } @else {
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                }
              </button>
            </div>
            <p class="field-hint">Use at least 8 characters.</p>
            <button class="button button-light button-wide" type="submit" [disabled]="authForm.invalid || submitting" [attr.aria-busy]="submitting">
              @if (submitting) { <span class="button-loading-spinner" aria-hidden="true"></span> }
              <span>{{ submitting ? 'Updating password…' : 'Reset password' }}</span>
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
  passwordVisible = false;
  error = '';
  success = '';
  submitting = false;
  readonly today = (() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

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

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    this.error = '';
    this.success = '';
    this.submitting = true;
    try {
      switch (this.mode) {
        case 'register':
          await this.api.register({
            name: this.name.trim(),
            userName: this.userName.trim(),
            email: this.email.trim(),
            password: this.password,
            dob: this.dob,
          });
          await this.router.navigate(['/verify'], { queryParams: { email: this.email } });
          break;
        case 'verify':
          await this.api.verifyOtp(this.email.trim(), this.otp.trim());
          await this.router.navigate(['/login'], { queryParams: { verified: '1' } });
          break;
        case 'login': {
          await this.api.login(this.identity.trim(), this.password);
          const requested = this.route.snapshot.queryParamMap.get('next');
          // Only restore same-origin application paths, never an external redirect.
          const safeNext = requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;
          const destination = safeNext ?? (this.api.isAdmin() ? '/admin' : '/');
          await this.router.navigateByUrl(destination);
          break;
        }
        case 'forgot-password':
          await this.api.requestPasswordReset(this.email.trim());
          await this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
          break;
        case 'reset-password':
          await this.api.resetPassword(this.email.trim(), this.otp.trim(), this.password);
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
