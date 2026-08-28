import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { TabsModule } from 'primeng/tabs';

import { CompareRenderedComponent } from '../../../components/compare/compare-rendered/compare-rendered.component';
import { CompareSourceComponent } from '../../../components/compare/compare-source/compare-source.component';

import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';

@Component({
  selector: 'aida-standalone-compare-versions',
  imports: [TranslatePipe, TabsModule, CompareRenderedComponent, CompareSourceComponent],
  templateUrl: './standalone-compare-versions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandaloneCompareComponent implements OnInit {
  public htmlNormalizationService = inject(HtmlNormalizationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Signals
  protected readonly originalHtml = signal<htmlProcessingResult | undefined>(undefined);
  protected readonly modifiedHtml = signal<htmlProcessingResult | undefined>(undefined);

  // Handle accept/reject changes
  protected onContentChanged(event: { beforeContent: htmlProcessingResult; afterContent: htmlProcessingResult }): void {
    // Update signals
    this.originalHtml.set(event.beforeContent);
    this.modifiedHtml.set(event.afterContent);
  }

  ngOnInit() {
    // Update settings from url parameter (if present) then remove the param
    this.route.queryParams.subscribe(async (params) => {
      const allParams = { ...params };
      // Handle before
      if (params['before'] !== undefined) {
        const before = await this.loadContent(params['before']);
        this.originalHtml.set(before);
        //delete allParams['before']
      }
      // Handle after
      if (params['after'] !== undefined) {
        const after = await this.loadContent(params['after']);
        this.modifiedHtml.set(after);
        //delete allParams['after']
      }
      // Remove processed parameters
      if (Object.keys(params).length !== Object.keys(allParams).length) {
        this.router.navigate([], {
          queryParams: allParams,
          replaceUrl: true,
        });
      }
    });
  }

  private async loadContent(url: string): Promise<htmlProcessingResult | undefined> {
    const fetchType = url.startsWith('http://cra-ut.isvcs.net/') || url.startsWith('https://canada-preview.adobecqms.net/') ? 'proxy' : 'url';
    return await this.htmlNormalizationService.normalizeHTML(url, fetchType);
  }
}
