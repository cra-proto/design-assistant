import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'aida-example',
  imports: [TranslateModule],
  template: `
    <h1 id="wb-cont">{{ 'example._title' | translate}}</h1>
    <div [innerHTML]="'example.description' | translate"></div>
    <!-- Views -->
    <p>{{ 'dashboard._' | translate}}</p>
    <p>{{ 'project._' | translate}}</p>
    <p>{{ 'switch._' | translate}}</p>
    <p>{{ 'inventory._' | translate}}</p>
    <p>{{ 'github._' | translate}}</p>
    <p>{{ 'about._' | translate}}</p>
    <!-- Components -->
    <p>{{ 'nav._' | translate}}</p>
    <p>{{ 'export._' | translate}}</p>
    <p>{{ 'signin._' | translate}}</p>
    <p>{{ 'settings._' | translate}}</p>
    <p>{{ 'collaborators._' | translate}}</p>
    <p>{{ 'addPages._' | translate}}</p>
    <p>{{ 'findPages._' | translate}}</p>
    <p>{{ 'apiKey._' | translate}}</p>
  `,
  styles: ``
})
export class ExampleComponent {

}
