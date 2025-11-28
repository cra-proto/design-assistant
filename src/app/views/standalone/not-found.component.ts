import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'aida-not-found',
  imports: [TranslateModule],
  template: `
    <span [innerHTML]="'404.message' | translate"></span>
  `,
  styles: ``
})
export class NotFoundComponent {

}
