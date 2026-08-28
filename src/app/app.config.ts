import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeEn from '@angular/common/locales/en-CA';
import localeFr from '@angular/common/locales/fr-CA';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';

import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { firstValueFrom } from 'rxjs';

import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { CustomTitleStrategy } from './common/custom-title-strategy';
import MyPreset from './common/theme-presets/preset';

registerLocaleData(localeFr);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideHttpClient(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: './i18n/', suffix: '.json' }),
      fallbackLang: 'en',
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      const savedLang = localStorage.getItem('lang') ?? 'en';
      return firstValueFrom(translate.use(savedLang));
    }),
    providePrimeNG({
      inputVariant: 'filled', // default is outlined
      theme: {
        preset: MyPreset,
        options: {
          colorScheme: 'light', // or 'dark'
          theme: 'blue', // or 'indigo', 'teal', etc.
          ripple: true,
          darkModeSelector: '.dark-mode',
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
};
