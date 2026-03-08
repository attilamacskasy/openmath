import { Component, inject, computed, signal, OnInit, DestroyRef } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';
import { LocaleService } from './core/services/locale.service';

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
  private localeService = inject(LocaleService);
  private destroyRef = inject(DestroyRef);

  private currentUrl = signal(this.router.url);

  showChrome = computed(() => {
    const url = this.currentUrl();
    const isAuthPage =
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url.startsWith('/auth/callback');
    return this.auth.isAuthenticated() && !isAuthPage;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));

    // Initialize locale from user profile on app startup
    if (this.auth.isAuthenticated()) {
      this.auth.getMe().subscribe();
    }
  }
}
