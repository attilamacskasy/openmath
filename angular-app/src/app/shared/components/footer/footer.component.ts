import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [TranslocoModule],
  template: `
    <footer class="surface-card border-top-1 border-300 px-4 py-3 mt-4" *transloco="let t">
      <div class="flex align-items-center justify-content-between text-sm text-500">
        <div class="flex align-items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="20" height="20">
            <defs>
              <linearGradient id="om-grad-f" x1="80" y1="60" x2="430" y2="460" gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#2D9CDB" />
                <stop offset="1" stop-color="#27AE60" />
              </linearGradient>
            </defs>
            <circle cx="256" cy="256" r="210" fill="url(#om-grad-f)" />
            <circle cx="256" cy="256" r="210" fill="none" stroke="#0B1B2B" stroke-opacity=".15" stroke-width="14" />
            <g stroke="#fff" stroke-width="24" stroke-linecap="round">
              <line x1="176" y1="190" x2="220" y2="234" />
              <line x1="220" y1="190" x2="176" y2="234" />
            </g>
            <g stroke="#fff" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <path d="M300 220 L325 245 L360 200" />
            </g>
            <path d="M176 300 Q256 380 336 300" fill="none" stroke="#fff" stroke-width="26" stroke-linecap="round" />
          </svg>
          <span>{{ t('footer.version') }}</span>
          <span>&mdash;</span>
          <span>{{ t('footer.techStack') }}</span>
        </div>
        <a href="https://github.com/attilamacskasy/openmath" target="_blank"
          class="text-500 no-underline hover:text-primary flex align-items-center gap-1">
          <i class="pi pi-github"></i>
          {{ t('footer.source') }}
        </a>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
