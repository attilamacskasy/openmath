import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <div class="flex flex-column min-h-screen">
      <app-header />
      <main class="flex-1 p-4">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
  styles: [],
})
export class AppComponent {
  title = 'OpenMath';
}
