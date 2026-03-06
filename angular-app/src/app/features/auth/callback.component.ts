import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    <div class="flex justify-content-center align-items-center" style="min-height: 80vh">
      <div class="text-center">
        @if (error) {
          <h3 class="text-red-500">Authentication Failed</h3>
          <p class="text-500">{{ error }}</p>
          <a href="/login" class="text-primary">Return to login</a>
        } @else {
          <p-progressSpinner></p-progressSpinner>
          <p class="text-500 mt-3">Signing you in with Google...</p>
        }
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  error = '';

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error = `Google authentication error: ${errorParam}`;
      return;
    }

    if (!code) {
      this.error = 'No authorization code received from Google.';
      return;
    }

    const redirectUri = window.location.origin + '/auth/callback';
    this.auth.loginWithGoogle(code, redirectUri).subscribe({
      next: (res) => {
        if (res.isNewUser) {
          // New Google users go to profile to complete setup
          this.router.navigate(['/profile']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.error = err.error?.detail || 'Google authentication failed.';
      },
    });
  }
}
