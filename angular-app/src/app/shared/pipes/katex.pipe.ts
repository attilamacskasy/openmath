import { Pipe, PipeTransform } from '@angular/core';
import katex from 'katex';

@Pipe({
  name: 'katex',
  standalone: true,
})
export class KatexPipe implements PipeTransform {
  transform(expression: string | null | undefined, enabled: boolean = true): string {
    if (!expression) return '';
    if (!enabled) return expression;

    try {
      return katex.renderToString(expression, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
    } catch (e) {
      console.warn('KaTeX rendering failed for:', expression, e);
      return expression;
    }
  }
}
