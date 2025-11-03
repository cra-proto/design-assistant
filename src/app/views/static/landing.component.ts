import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'aida-landing',
  imports: [CommonModule, TranslateModule],
  template: `
    <h1 id="wb-cont">{{ 'title.landing' | translate}}</h1>
    <p>{{'about.content' | translate }}</p>   
  `,
  styles: ``
})
export class LandingComponent {

}

