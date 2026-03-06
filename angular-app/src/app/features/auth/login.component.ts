import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
    DividerModule,
  ],
  template: `
    <div class="flex justify-content-center align-items-center" style="min-height: 80vh">
      <p-card [style]="{ width: '400px' }">
        <ng-template pTemplate="header">
          <div class="text-center pt-4">
            <h2 class="m-0">🧮 OpenMath</h2>
          </div>
        </ng-template>

        <h3 class="text-center mt-0">Sign in to OpenMath</h3>

        @if (errorMessage()) {
          <p-message severity="error" [text]="errorMessage()" styleClass="w-full mb-3"></p-message>
        }

        <div class="flex flex-column gap-3">
          <div class="flex flex-column gap-1">
            <label for="email" class="font-semibold">Email</label>
            <input
              id="email"
              type="email"
              pInputText
              [(ngModel)]="email"
              placeholder="your@email.com"
              class="w-full"
              (keyup.enter)="login()"
            />
          </div>

          <div class="flex flex-column gap-1">
            <label for="password" class="font-semibold">Password</label>
            <p-password
              id="password"
              [(ngModel)]="password"
              [feedback]="false"
              [toggleMask]="true"
              styleClass="w-full"
              inputStyleClass="w-full"
              (onKeyUp)="onPasswordKeyup($event)"
            ></p-password>
          </div>

          <p-button
            label="Sign In"
            icon="pi pi-sign-in"
            (onClick)="login()"
            [disabled]="!email || !password || submitting()"
            [loading]="submitting()"
            styleClass="w-full"
          ></p-button>

          <p-divider align="center">
            <span class="text-500 text-sm">or</span>
          </p-divider>

          <p-button
            label="Sign in with Google"
            icon="pi pi-google"
            severity="secondary"
            (onClick)="loginWithGoogle()"
            styleClass="w-full"
            [outlined]="true"
          ></p-button>

          <div class="text-center text-sm">
            Don't have an account?
            <a routerLink="/register" class="text-primary no-underline font-semibold">Register</a>
          </div>
        </div>
      </p-card>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  submitting = signal(false);
  errorMessage = signal('');

  login() {
    if (!this.email || !this.password) return;
    this.submitting.set(true);
    this.errorMessage.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(
          err.error?.detail || 'Invalid email or password'
        );
      },
    });
  }

  loginWithGoogle() {
    const clientId = (environment as any).googleClientId;
    if (!clientId) {
      this.errorMessage.set('Google SSO is not configured');
      return;
    }

    const redirectUri = window.location.origin + '/auth/callback';
    const scope = 'openid email profile';
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    window.location.href = url;
  }

  onPasswordKeyup(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.login();
    }
  }
}
