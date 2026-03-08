import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNGConfig } from 'primeng/api';

const PRIMENG_HU: Record<string, any> = {
  dayNames: ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'],
  dayNamesShort: ['Vas', 'Hét', 'Kedd', 'Sze', 'Csüt', 'Pén', 'Szo'],
  dayNamesMin: ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'],
  monthNames: [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
  ],
  monthNamesShort: [
    'Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún',
    'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec',
  ],
  today: 'Ma',
  clear: 'Törlés',
  dateFormat: 'yy.mm.dd',
  firstDayOfWeek: 1,
  accept: 'Igen',
  reject: 'Nem',
  choose: 'Válassz',
  upload: 'Feltöltés',
  cancel: 'Mégse',
  weak: 'Gyenge',
  medium: 'Közepes',
  strong: 'Erős',
  passwordPrompt: 'Adj meg egy jelszót',
  emptyMessage: 'Nincs találat',
  emptyFilterMessage: 'Nincs találat',
};

const PRIMENG_EN: Record<string, any> = {
  dateFormat: 'mm/dd/yy',
  firstDayOfWeek: 0,
};

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private transloco = inject(TranslocoService);
  private primeConfig = inject(PrimeNGConfig);

  /** Switch active locale and update PrimeNG config */
  setLocale(locale: 'en' | 'hu'): void {
    this.transloco.setActiveLang(locale);
    this.applyPrimeNGLocale(locale);
  }

  getLocale(): string {
    return this.transloco.getActiveLang();
  }

  /** Initialize from user profile locale */
  initFromProfile(locale: string): void {
    const lang = locale === 'hu' ? 'hu' : 'en';
    this.setLocale(lang);
  }

  /** Get the PrimeNG Calendar dateFormat for active locale */
  getCalendarDateFormat(): string {
    return this.getLocale() === 'hu' ? 'yy.mm.dd' : 'yy-mm-dd';
  }

  private applyPrimeNGLocale(locale: string): void {
    if (locale === 'hu') {
      this.primeConfig.setTranslation(PRIMENG_HU);
    } else {
      this.primeConfig.setTranslation(PRIMENG_EN);
    }
  }
}
