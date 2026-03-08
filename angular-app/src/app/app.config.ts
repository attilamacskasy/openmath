import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTransloco } from '@jsverse/transloco';
import localeHu from '@angular/common/locales/hu';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { TranslocoHttpLoader } from './transloco-loader';

registerLocaleData(localeHu);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'hu'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
