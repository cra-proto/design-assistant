import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';

import { FetchService } from './fetch.service';
import { StyleTreeNodeService } from './style-treenode.service';

import { DataVersion, TreeNodeData } from '../common/data.model';

export interface TableItem {
  group: string;
  version: DataVersion | 'ai';
  content: string;
}

export interface LabelItem {
  h1: string;
  doubleH1: string;
  path: string;
}

export interface FlattenedMetadata {
  label: Record<'en' | 'fr', LabelItem>;
  style?: string;
  approved?: boolean;
  //English title
  titleEnBase: TableItem;
  titleEnLive: TableItem;
  titleEnProto: TableItem;
  //English description
  descriptionEnBase: TableItem;
  descriptionEnLive: TableItem;
  descriptionEnAi: TableItem;
  descriptionEnProto: TableItem;
  //English keywords
  keywordsEnBase: TableItem;
  keywordsEnLive: TableItem;
  keywordsEnAi: TableItem;
  keywordsEnProto: TableItem;
  //French title
  titleFrBase: TableItem;
  titleFrLive: TableItem;
  titleFrProto: TableItem;
  //French description
  descriptionFrBase: TableItem;
  descriptionFrLive: TableItem;
  descriptionFrAi: TableItem;
  descriptionFrProto: TableItem;
  //French keywords
  keywordsFrBase: TableItem;
  keywordsFrLive: TableItem;
  keywordsFrAi: TableItem;
  keywordsFrProto: TableItem;
}

/**
 * Reviewed: 2026-10-17 (ng21)
 *
 * Flattened version of metadata
 */
@Injectable({ providedIn: 'root' })
export class ProjectMetadataService {
  private readonly translate = inject(TranslateService);
  private readonly styleTreeNodeService = inject(StyleTreeNodeService);
  private readonly fetchService = inject(FetchService);

  public flattenMetadata(tree: TreeNode<TreeNodeData>[]): FlattenedMetadata[] {
    const flatNodes: FlattenedMetadata[] = [];

    //English
    const titleEN = this.translate.instant('inventory.header.titleEN');
    const descriptionEN = this.translate.instant('inventory.header.descriptionEN');
    const keywordsEN = this.translate.instant('inventory.header.keywordsEN');
    //French
    const titleFR = this.translate.instant('inventory.header.titleFR');
    const descriptionFR = this.translate.instant('inventory.header.descriptionFR');
    const keywordsFR = this.translate.instant('inventory.header.keywordsFR');
    //Version
    const baseline = this.translate.instant('common.version.baseline');
    const live = this.translate.instant('common.version.live');
    const ai = this.translate.instant('common.version.ai');
    const prototype = this.translate.instant('common.version.prototype');
    //No change
    const noChange = 'noChange';

    const walk = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const data = node.data;
        const allColours = this.styleTreeNodeService.contextStyles;
        if (!data) continue;
        const style = data.status.isNew ? allColours.new : data.status.isROT ? allColours.rot : data.status.isMoved ? allColours.move : undefined;
        const storedApproval = data.approved?.metadata;
        const approved = !!storedApproval && storedApproval === this.hashMetadata(data);
        if (data.status?.inScope !== false) {
          flatNodes.push({
            label: {
              en: {
                h1: data.prototype?.en.h1 ?? '',
                doubleH1: data.prototype?.en.doubleH1 ?? '',
                path: data.path.en,
              },
              fr: {
                h1: data.prototype?.fr.h1 ?? '',
                doubleH1: data.prototype?.fr.doubleH1 ?? '',
                path: data.path.fr,
              },
            },
            style: style,
            approved: approved,
            // English title
            titleEnBase: {
              group: titleEN,
              version: baseline,
              content: data.baseline?.en.title ?? '',
            },
            titleEnLive: {
              group: titleEN,
              version: live,
              content: data.live?.en.title === data.baseline?.en.title ? noChange : (data.live?.en.title ?? ''),
            },
            titleEnProto: {
              group: titleEN,
              version: prototype,
              content: data.prototype?.en.title === data.live?.en.title ? noChange : (data.prototype?.en.title ?? ''),
            },
            // English description
            descriptionEnBase: {
              group: descriptionEN,
              version: baseline,
              content: data.baseline?.en.description ?? '',
            },
            descriptionEnLive: {
              group: descriptionEN,
              version: live,
              content: data.live?.en.description === data.baseline?.en.description ? noChange : (data.live?.en.description ?? ''),
            },
            descriptionEnAi: {
              group: descriptionEN,
              version: ai,
              content:
                data.metadataReview?.en.description.status === 'pending' || data.metadataReview?.en.description.status === 'edited'
                  ? (data.metadataReview?.en.description.edited ?? data.metadataReview?.en.description.ai)
                  : noChange,
            },
            descriptionEnProto: {
              group: descriptionEN,
              version: prototype,
              content: data.prototype?.en.description === data.live?.en.description ? noChange : (data.prototype?.en.description ?? ''),
            },
            // English keywords
            keywordsEnBase: {
              group: keywordsEN,
              version: baseline,
              content: data.baseline?.en.keywords ?? '',
            },
            keywordsEnLive: {
              group: keywordsEN,
              version: live,
              content: data.live?.en.keywords === data.baseline?.en.keywords ? noChange : (data.live?.en.keywords ?? ''),
            },
            keywordsEnAi: {
              group: keywordsEN,
              version: ai,
              content:
                data.metadataReview?.en.keywords.status === 'pending' || data.metadataReview?.en.keywords.status === 'edited'
                  ? (data.metadataReview?.en.keywords.edited ?? data.metadataReview?.en.keywords.ai)
                  : noChange,
            },
            keywordsEnProto: {
              group: keywordsEN,
              version: prototype,
              content: data.prototype?.en.keywords === data.live?.en.keywords ? noChange : (data.prototype?.en.keywords ?? ''),
            },
            // French title
            titleFrBase: {
              group: titleFR,
              version: baseline,
              content: data.baseline?.fr.title ?? '',
            },
            titleFrLive: {
              group: titleFR,
              version: live,
              content: data.live?.fr.title === data.baseline?.fr.title ? noChange : (data.live?.fr.title ?? ''),
            },
            titleFrProto: {
              group: titleFR,
              version: prototype,
              content: data.prototype?.fr.title === data.live?.fr.title ? noChange : (data.prototype?.fr.title ?? ''),
            },
            // French description
            descriptionFrBase: {
              group: descriptionFR,
              version: baseline,
              content: data.baseline?.fr.description ?? '',
            },
            descriptionFrLive: {
              group: descriptionFR,
              version: live,
              content: data.live?.fr.description === data.baseline?.fr.description ? noChange : (data.live?.fr.description ?? ''),
            },
            descriptionFrAi: {
              group: descriptionFR,
              version: ai,
              content:
                data.metadataReview?.fr.description.status === 'pending' || data.metadataReview?.fr.description.status === 'edited'
                  ? (data.metadataReview?.fr.description.edited ?? data.metadataReview?.fr.description.ai)
                  : noChange,
            },
            descriptionFrProto: {
              group: descriptionFR,
              version: prototype,
              content: data.prototype?.fr.description === data.live?.fr.description ? noChange : (data.prototype?.fr.description ?? ''),
            },
            // French keywords
            keywordsFrBase: {
              group: keywordsFR,
              version: baseline,
              content: data.baseline?.fr.keywords ?? '',
            },
            keywordsFrLive: {
              group: keywordsFR,
              version: live,
              content: data.live?.fr.keywords === data.baseline?.fr.keywords ? noChange : (data.live?.fr.keywords ?? ''),
            },
            keywordsFrAi: {
              group: keywordsFR,
              version: ai,
              content:
                data.metadataReview?.fr.keywords.status === 'pending' || data.metadataReview?.fr.keywords.status === 'edited'
                  ? (data.metadataReview?.fr.keywords.edited ?? data.metadataReview?.fr.keywords.ai)
                  : noChange,
            },
            keywordsFrProto: {
              group: keywordsFR,
              version: prototype,
              content: data.prototype?.fr.keywords === data.live?.fr.keywords ? noChange : (data.prototype?.fr.keywords ?? ''),
            },
          });
        }

        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(tree);
    return flatNodes;
  }

  public hashMetadata(nodeData: TreeNodeData) {
    if (!nodeData.prototype) return undefined;
    const allMeta = [
      nodeData.prototype.en.title,
      nodeData.prototype.fr.title,
      nodeData.prototype.en.description,
      nodeData.prototype.fr.description,
      nodeData.prototype.en.keywords,
      nodeData.prototype.fr.keywords,
    ];
    const jsonMeta = JSON.stringify(allMeta);
    return this.fetchService.hashString(jsonMeta);
  }
}
