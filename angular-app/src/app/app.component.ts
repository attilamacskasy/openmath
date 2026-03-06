import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="flex flex-column min-h-screen">
      @if (showChrome()) {
        <app-header />
      }
      <main class="flex-1 p-4">
        <router-outlet />
      </main>
      @if (showChrome()) {
        <app-footer />
      }
    </div>
  `,
  styles: [],
})
export class AppComponent {
  title = 'OpenMath';
  private router = inject(Router);
  private auth = inject(AuthService);

  showChrome = computed(() => {
    const url = this.router.url;
    const isAuthPage =
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url.startsWith('/auth/callback');
    return this.auth.isAuthenticated() && !isAuthPage;
  });
}
