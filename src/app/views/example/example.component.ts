import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { marker } from '@colsen1991/ngx-translate-extract-marker';

@Component({
  selector: 'aida-example',
  imports: [TranslateModule],
  template: `
    <h1 id="wb-cont">{{ 'example._title' | translate}}</h1>
    <div [innerHTML]="'example.description' | translate"></div>
  `,
  styles: ``
})
export class ExampleComponent {
  /**
  * Translation markers for visual separators in translation files.
  * These keys (feature._) create visual breaks between feature sections.
  * DO NOT REMOVE - needed to preserve separators during i18n:clean
  */
  markForTranslation() {
    //Views
    marker('dashboard._');
    marker('project._');
    marker('switch._');
    marker('inventory._');
    marker('github._');
    marker('about._');
    // Components
    marker('nav._');
    marker('export._');
    marker('signin._');
    marker('settings._');
    marker('collaborators._');
    marker('addPages._');
    marker('findPages._');
    marker('apiKey._');
  }
}
