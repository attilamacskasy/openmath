import { Pipe, PipeTransform, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { LocaleService } from '../../core/services/locale.service';

@Pipe({ name: 'localDate', standalone: true })
export class LocalDatePipe implements PipeTransform {
  private localeService = inject(LocaleService);

  transform(value: string | Date | null | undefined, format: string = 'short'): string {
    if (!value) return '';
    const locale = this.localeService.getLocale() === 'hu' ? 'hu-HU' : 'en-US';
    return formatDate(value, format, locale);
  }
}
