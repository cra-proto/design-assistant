import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'aida-about',
  imports: [TranslateModule],
  template: `
    <h1 id="wb-cont">{{ 'about._title' | translate}}</h1>
    <div [innerHTML]="'about.content' | translate"></div>
  `,
  styles: ``
})
export class AboutComponent {

}
