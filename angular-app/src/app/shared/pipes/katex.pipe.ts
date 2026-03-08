import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

@Pipe({
  name: 'katex',
  standalone: true,
})
export class KatexPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(expression: string | null | undefined, enabled: boolean = true): string | SafeHtml {
    if (!expression) return '';
    if (!enabled) return expression;

    try {
      const html = katex.renderToString(expression, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
      // KaTeX output relies on inline styles for positioning (top, height, etc.).
      // Angular's [innerHTML] sanitizer strips these, breaking fraction layout.
      // This is safe because KaTeX generates HTML from our own expressions, not user input.
      return this.sanitizer.bypassSecurityTrustHtml(html);
    } catch (e) {
      console.warn('KaTeX rendering failed for:', expression, e);
      return expression;
    }
  }
}
