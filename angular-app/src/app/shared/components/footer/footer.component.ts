import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="surface-ground text-center text-sm text-500 py-3 mt-4 border-top-1 border-300">
      <span>OpenMath v2.1 &mdash; Angular + FastAPI + PrimeNG + PostgreSQL</span>
      <span class="mx-2">|</span>
      <a href="https://github.com" target="_blank" class="text-500 no-underline hover:text-primary">Source</a>
    </footer>
  `,
})
export class FooterComponent {}
