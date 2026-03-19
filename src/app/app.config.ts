import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from "@angular/core";
import { provideHttpClient, HttpClient } from "@angular/common/http";
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr-CA';
import localeEn from '@angular/common/locales/en-CA';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { TranslateModule, TranslateLoader } from "@ngx-translate/core";
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CustomTitleStrategy } from './common/custom-title-strategy';
import MyPreset from './common/theme-presets/preset';

import { routes } from './app.routes';

registerLocaleData(localeFr);
registerLocaleData(localeEn);

const httpLoaderFactory: (http: HttpClient) => TranslateHttpLoader = (http: HttpClient) =>
  new TranslateHttpLoader(http, './i18n/', '.json');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })
    ),
    { provide: TitleStrategy, useClass: CustomTitleStrategy },
    provideHttpClient(),
    importProvidersFrom([TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
    })]),
    provideAnimationsAsync(),
    providePrimeNG({

      inputVariant: 'filled', // default is outlined
      theme: {
        preset: MyPreset,
        options: {
          colorScheme: 'light', // or 'dark'
          theme: 'blue',        // or 'indigo', 'teal', etc.
          ripple: true,
          darkModeSelector: '.dark-mode'
        }
      }
    }),
    MessageService,
    ConfirmationService
  ],

};