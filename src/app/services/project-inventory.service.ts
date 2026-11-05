import { inject, Injectable } from '@angular/core';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';

import { FetchService } from './fetch.service';
import { ProjectMetadataService } from './project-metadata.service';
import { LabelItem } from './style-table.service';
import { StyleTreeNodeService } from './style-treenode.service';

import { PageTemplate, TreeNodeData } from '../common/data.model';

export interface TableItemBase {
  group: string;
  column: string;
}

export type TableItem = TableItemBase &
  (
    | { type: 'string'; content: string }
    | { type: 'array'; content: string[] }
    | { type: 'boolean'; content: boolean }
    | { type: 'number'; content: number }
    | { type: 'date'; content: Date | undefined }
  );

export const INVENTORY_GROUPS = ['status', 'notes', 'readability', 'links', 'pageData', 'owner', 'metadata'] as const;
export type InventoryGroup = (typeof INVENTORY_GROUPS)[number];
export type InventoryColumn = (keyof FlattenedInventory)[number];

export interface FlattenedInventory {
  label: Record<'en' | 'fr', LabelItem>;
  style?: string;

  //Notes
  todo: TableItem;
  issue: TableItem;
  solution: TableItem;

  //Status
  inScope: TableItem;
  isNew: TableItem;
  isMoved: TableItem;
  isROT: TableItem;
  isArchived: TableItem;
  noindex: TableItem;

  //PageData
  templateEn: TableItem;
  templateFr: TableItem;
  visitsEn: TableItem;
  visitsFr: TableItem;
  tasksEn: TableItem;
  tasksFr: TableItem;
  phoneNumbersEn: TableItem;
  phoneNumbersFr: TableItem;
  lastModifiedEn: TableItem;
  lastModifiedFr: TableItem;
  lastPublishedEn: TableItem;
  lastPublishedFr: TableItem;

  //Owner
  ownerEn: TableItem;
  ownerFr: TableItem;
  emailEn: TableItem;
  emailFr: TableItem;

  //Readability
  wordCountEn: TableItem;
  wordCountFr: TableItem;
  fleschKincaidEn: TableItem;
  fleschKincaidFr: TableItem;
  gunningFogEn: TableItem;
  gunningFogFr: TableItem;

  //Links
  pathEn: TableItem;
  pathFr: TableItem;
  is404En: TableItem;
  is404Fr: TableItem;
  iaOrphanEn: TableItem;
  iaOrphanFr: TableItem;
  vanitiesEn: TableItem;
  vanitiesFr: TableItem;
  /*
  brokenLinksEn: TableItem;
  brokenLinksFr: TableItem;
  redirectedLinksEn: TableItem;
  redirectedLinksFr: TableItem;
  ambiguousLinksEn: TableItem;
  ambiguousLinksFr: TableItem;
  duplicateLinksEn: TableItem;
  duplicateLinksFr: TableItem;
  externalLinksEn: TableItem;
  externalLinksFr: TableItem;
  referringLinksEn: TableItem;
  referringLinksFr: TableItem;
  */
  linkCountEn: TableItem;
  linkCountFr: TableItem;
  linksToPortalEn: TableItem;
  linksToPortalFr: TableItem;
  linksToSignInEn: TableItem;
  linksToSignInFr: TableItem;
  hasChatbotEn: TableItem;
  hasChatbotFr: TableItem;

  //Metadata
  h1En: TableItem;
  h1Fr: TableItem;
  doubleH1En: TableItem;
  doubleH1Fr: TableItem;
  titleEn: TableItem;
  titleFr: TableItem;
  descriptionEn: TableItem;
  descriptionFr: TableItem;
  keywordsEn: TableItem;
  keywordsFr: TableItem;
  metaApproval: TableItem;
}

/**
 * Reviewed: 2026-10-17 (ng21)
 *
 * Flattened version of page data for content inventory
 */
@Injectable({ providedIn: 'root' })
export class ProjectInventoryService {
  private readonly translate = inject(TranslateService);
  private readonly styleTreeNodeService = inject(StyleTreeNodeService);
  private readonly fetchService = inject(FetchService);
  private readonly projectMetadata = inject(ProjectMetadataService);

  public flattenInventory(tree: TreeNode<TreeNodeData>[]): FlattenedInventory[] {
    const flatNodes: FlattenedInventory[] = [];

    //Groups
    const status = this.translate.instant('inventory.columnGroups.status');
    const notes = this.translate.instant('inventory.columnGroups.notes');
    const readability = this.translate.instant('inventory.columnGroups.readability');
    const links = this.translate.instant('inventory.columnGroups.links');
    const pageData = this.translate.instant('inventory.columnGroups.pageData');
    const owner = this.translate.instant('inventory.columnGroups.owner');
    const metadata = this.translate.instant('inventory.columnGroups.metadata');
    //Notes
    const todo = this.translate.instant('inventory.header.todo');
    const issue = this.translate.instant('inventory.header.issue');
    const solution = this.translate.instant('inventory.header.solution');
    //Status Columns
    const inScope = this.translate.instant('inventory.header.inScope');
    const isNew = this.translate.instant('inventory.header.isNew');
    const isMoved = this.translate.instant('inventory.header.isMoved');
    const isROT = this.translate.instant('inventory.header.isROT');
    const isArchived = this.translate.instant('inventory.header.isArchived');
    const noindex = this.translate.instant('inventory.header.noindex');
    //PageData Columns
    const template = this.translate.instant('inventory.header.template');
    const visits = this.translate.instant('inventory.header.visits');
    const tasks = this.translate.instant('inventory.header.tasks');
    const phoneNumbers = this.translate.instant('inventory.header.phoneNumbers');
    const lastModified = this.translate.instant('inventory.header.lastModified');
    const lastPublished = this.translate.instant('inventory.header.lastPublished');
    //Owner Columns
    const email = this.translate.instant('inventory.header.email');

    //Readability Columns
    const wordCount = this.translate.instant('inventory.header.wordCount');
    const fleschKincaid = this.translate.instant('inventory.header.fleschKincaid');
    const gunningFog = this.translate.instant('inventory.header.gunningFog');

    //Links Columns
    const path = this.translate.instant('inventory.header.path');
    const is404 = this.translate.instant('inventory.header.is404');
    const iaOrphan = this.translate.instant('inventory.header.iaOrphan');
    const vanities = this.translate.instant('inventory.header.vanities');
    const linkCount = this.translate.instant('inventory.header.linkCount');
    const linksToPortal = this.translate.instant('inventory.header.linksToPortal');
    const linksToSignIn = this.translate.instant('inventory.header.linksToSignIn');
    const hasChatbot = this.translate.instant('inventory.header.hasChatbot');

    //Metadata Columns
    const h1 = this.translate.instant('inventory.header.h1');
    const doubleH1 = this.translate.instant('inventory.header.doubleH1');
    const title = this.translate.instant('inventory.header.title');
    const description = this.translate.instant('inventory.header.description');
    const keywords = this.translate.instant('inventory.header.keywords');
    const metaApproval = this.translate.instant('inventory.header.metaApproval');

    const walk = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const data = node.data;
        const allColours = this.styleTreeNodeService.contextStyles;
        if (!data) continue;
        const style = data.status.isNew ? allColours.new : data.status.isROT ? allColours.rot : data.status.isMoved ? allColours.move : undefined;
        const splitList = (content?: string) =>
          content
            ?.split(';')
            .map((x) => x.trim())
            .filter(Boolean) ?? [];

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
          // Notes
          todo: {
            group: notes,
            column: todo,
            type: 'array',
            content: this.computeActions(data),
          },
          issue: {
            group: notes,
            column: issue,
            type: 'string',
            content: data.notes?.issue ?? '',
          },
          solution: {
            group: notes,
            column: solution,
            type: 'string',
            content: data.notes?.solution ?? '',
          },
          // Status
          inScope: {
            group: status,
            column: inScope,
            type: 'boolean',
            content: data.status.inScope,
          },
          isNew: {
            group: status,
            column: isNew,
            type: 'boolean',
            content: data.status.isNew,
          },
          isROT: {
            group: status,
            column: isROT,
            type: 'boolean',
            content: data.status.isROT,
          },
          isMoved: {
            group: status,
            column: isMoved,
            type: 'boolean',
            content: data.status.isMoved,
          },
          isArchived: {
            group: status,
            column: isArchived,
            type: 'boolean',
            content: !!(data.prototype?.en.isArchived && data.prototype?.fr.isArchived),
          },
          noindex: {
            group: status,
            column: noindex,
            type: 'boolean',
            content: !!(data.prototype?.en.noindex && data.prototype?.fr.noindex),
          },
          // Page data
          templateEn: {
            group: pageData,
            column: template,
            type: 'string',
            content: this.translate.instant(data.prototype?.en.template ?? data.live?.en.template ?? PageTemplate.Content),
          },
          templateFr: {
            group: pageData,
            column: template,
            type: 'string',
            content: this.translate.instant(data.prototype?.fr.template ?? data.live?.fr.template ?? PageTemplate.Content),
          },
          visitsEn: {
            group: pageData,
            column: visits,
            type: 'number',
            content: data.visits?.en ?? -1,
          },
          visitsFr: {
            group: pageData,
            column: visits,
            type: 'number',
            content: data.visits?.fr ?? -1,
          },
          tasksEn: {
            group: pageData,
            column: tasks,
            type: 'array',
            content: data.task?.en ?? [],
          },
          tasksFr: {
            group: pageData,
            column: tasks,
            type: 'array',
            content: data.task?.fr ?? [],
          },
          phoneNumbersEn: {
            group: pageData,
            column: phoneNumbers,
            type: 'array',
            content: data.prototype?.en.phoneNumbers ?? data.live?.en.phoneNumbers ?? [],
          },
          phoneNumbersFr: {
            group: pageData,
            column: phoneNumbers,
            type: 'array',
            content: data.prototype?.fr.phoneNumbers ?? data.live?.fr.phoneNumbers ?? [],
          },
          lastModifiedEn: {
            group: pageData,
            column: lastModified,
            type: 'date',
            content: data.live?.en.lastModified ? new Date(data.live?.en.lastModified) : undefined,
          },
          lastModifiedFr: {
            group: pageData,
            column: lastModified,
            type: 'date',
            content: data.live?.fr.lastModified ? new Date(data.live?.fr.lastModified) : undefined,
          },
          lastPublishedEn: {
            group: pageData,
            column: lastPublished,
            type: 'date',
            content: data.live?.en.lastPublished ? new Date(data.live?.en.lastPublished) : undefined,
          },
          lastPublishedFr: {
            group: pageData,
            column: lastPublished,
            type: 'date',
            content: data.live?.fr.lastPublished ? new Date(data.live?.fr.lastPublished) : undefined,
          },

          // Owner

          ownerEn: {
            group: owner,
            column: owner,
            type: 'array',
            content: splitList(data.live?.en.owner),
          },
          ownerFr: {
            group: owner,
            column: owner,
            type: 'array',
            content: splitList(data.live?.fr.owner),
          },
          emailEn: {
            group: owner,
            column: email,
            type: 'array',
            content: splitList(data.live?.en.email),
          },
          emailFr: {
            group: owner,
            column: email,
            type: 'array',
            content: splitList(data.live?.fr.email),
          },

          // Readability
          wordCountEn: {
            group: readability,
            column: wordCount,
            type: 'number',
            content: data.prototype?.en.wordCount ?? data.live?.en.wordCount ?? -1,
          },
          wordCountFr: {
            group: readability,
            column: wordCount,
            type: 'number',
            content: data.prototype?.fr.wordCount ?? data.live?.fr.wordCount ?? -1,
          },
          fleschKincaidEn: {
            group: readability,
            column: fleschKincaid,
            type: 'number',
            content: data.prototype?.en.fleschKincaid ?? data.live?.en.fleschKincaid ?? -1,
          },
          fleschKincaidFr: {
            group: readability,
            column: fleschKincaid,
            type: 'number',
            content: data.prototype?.fr.fleschKincaid ?? data.live?.fr.fleschKincaid ?? -1,
          },
          gunningFogEn: {
            group: readability,
            column: gunningFog,
            type: 'number',
            content: data.prototype?.en.gunningFog ?? data.live?.en.gunningFog ?? -1,
          },
          gunningFogFr: {
            group: readability,
            column: gunningFog,
            type: 'number',
            content: data.prototype?.fr.gunningFog ?? data.live?.fr.gunningFog ?? -1,
          },
          //Links
          pathEn: {
            group: links,
            column: path,
            type: 'string',
            content: data.path.en ?? '',
          },
          pathFr: {
            group: links,
            column: path,
            type: 'string',
            content: data.path.fr ?? '',
          },
          is404En: {
            group: links,
            column: is404,
            type: 'boolean',
            content: data.live?.en.is404 ?? false,
          },
          is404Fr: {
            group: links,
            column: is404,
            type: 'boolean',
            content: data.live?.fr.is404 ?? false,
          },
          iaOrphanEn: {
            group: links,
            column: iaOrphan,
            type: 'boolean',
            content: data.prototype?.en.isOrphan ?? data.live?.en.isOrphan ?? false,
          },
          iaOrphanFr: {
            group: links,
            column: iaOrphan,
            type: 'boolean',
            content: data.prototype?.fr.isOrphan ?? data.live?.fr.isOrphan ?? false,
          },
          vanitiesEn: {
            group: links,
            column: vanities,
            type: 'array',
            content: data.vanity?.en ?? [],
          },
          vanitiesFr: {
            group: links,
            column: vanities,
            type: 'array',
            content: data.vanity?.fr ?? [],
          },
          linkCountEn: {
            group: links,
            column: linkCount,
            type: 'number',
            content: data.prototype?.en.linkCount ?? data.live?.en.linkCount ?? -1,
          },
          linkCountFr: {
            group: links,
            column: linkCount,
            type: 'number',
            content: data.prototype?.fr.linkCount ?? data.live?.fr.linkCount ?? -1,
          },
          linksToPortalEn: {
            group: links,
            column: linksToPortal,
            type: 'boolean',
            content: data.prototype?.en.linksToPortal ?? data.live?.en.linksToPortal ?? false,
          },
          linksToPortalFr: {
            group: links,
            column: linksToPortal,
            type: 'boolean',
            content: data.prototype?.fr.linksToPortal ?? data.live?.fr.linksToPortal ?? false,
          },
          linksToSignInEn: {
            group: links,
            column: linksToSignIn,
            type: 'boolean',
            content: data.prototype?.en.linksToSignIn ?? data.live?.en.linksToSignIn ?? false,
          },
          linksToSignInFr: {
            group: links,
            column: linksToSignIn,
            type: 'boolean',
            content: data.prototype?.fr.linksToSignIn ?? data.live?.fr.linksToSignIn ?? false,
          },
          hasChatbotEn: {
            group: links,
            column: hasChatbot,
            type: 'boolean',
            content: data.prototype?.en.hasChatbot ?? data.live?.en.hasChatbot ?? false,
          },
          hasChatbotFr: {
            group: links,
            column: hasChatbot,
            type: 'boolean',
            content: data.prototype?.fr.hasChatbot ?? data.live?.fr.hasChatbot ?? false,
          },

          // Metadata
          h1En: {
            group: metadata,
            column: h1,
            type: 'string',
            content: data.prototype?.en.h1 ?? data.live?.en.h1 ?? '',
          },
          h1Fr: {
            group: metadata,
            column: h1,
            type: 'string',
            content: data.prototype?.fr.h1 ?? data.live?.fr.h1 ?? '',
          },
          doubleH1En: {
            group: metadata,
            column: doubleH1,
            type: 'string',
            content: data.prototype?.en.doubleH1 ?? data.live?.en.doubleH1 ?? '',
          },
          doubleH1Fr: {
            group: metadata,
            column: doubleH1,
            type: 'string',
            content: data.prototype?.fr.doubleH1 ?? data.live?.fr.doubleH1 ?? '',
          },
          titleEn: {
            group: metadata,
            column: title,
            type: 'string',
            content: data.prototype?.en.title ?? data.live?.en.title ?? '',
          },
          titleFr: {
            group: metadata,
            column: title,
            type: 'string',
            content: data.prototype?.fr.title ?? data.live?.fr.title ?? '',
          },
          descriptionEn: {
            group: metadata,
            column: description,
            type: 'string',
            content: data.prototype?.en.description ?? data.live?.en.description ?? '',
          },
          descriptionFr: {
            group: metadata,
            column: description,
            type: 'string',
            content: data.prototype?.fr.description ?? data.live?.fr.description ?? '',
          },
          keywordsEn: {
            group: metadata,
            column: keywords,
            type: 'string',
            content: data.prototype?.en.keywords ?? data.live?.en.keywords ?? '',
          },
          keywordsFr: {
            group: metadata,
            column: keywords,
            type: 'string',
            content: data.prototype?.fr.keywords ?? data.live?.fr.keywords ?? '',
          },
          metaApproval: {
            group: metadata,
            column: metaApproval,
            type: 'boolean',
            content: this.projectMetadata.approvalStatus(data),
          },
        });

        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(tree);
    return flatNodes;
  }

  /** Map status booleans to icons */
  public getBooleanIcon(value: boolean, column: string): string {
    if (!value) return 'pi pi-minus text-gray-400';

    const trueIcons: Record<string, string> = {
      inScope: 'pi pi-check text-green',
      isNew: 'pi pi-plus text-blue-500',
      isMoved: 'pi pi-arrow-right text-orange-500',
      isROT: 'pi pi-trash text-red',
      isArchived: 'pi pi-book text-orange-500',
      noindex: 'pi pi-android text-orange-500',
      iaOrphan: 'pi pi-times text-red',
      is404: 'pi pi-times-circle text-red',
      linksToPortal: 'pi pi-external-link text-blue-500',
      linksToSignIn: 'pi pi-sign-in text-green',
      hasChatbot: 'pi pi-comments text-blue-500',
    };

    const col = column.replace('En', '').replace('Fr', '');
    return trueIcons[col] ?? 'pi pi-check text-green';
  }

  /** Map status booleans to tooltips */
  public getBooleanTooltip(value: boolean, column: string): string {
    const col = column.replace('En', '').replace('Fr', '');
    return `inventory.tooltip.boolean.${col}.${value}`;
  }

  /** Compute todo list based on planned status */
  private computeActions(data: TreeNodeData): string[] {
    const actions: string[] = [];
    const isNew = data.status.isNew;
    const isROT = data.status.isROT;
    const is404Proto = data.prototype?.en.is404;
    const is404Live = data.live?.en.is404;

    const isMoved = data.status.isMoved;
    const parentProto = data.prototype?.en.parentPath;
    const parentLive = data.live?.en.parentPath;

    if (isROT && !is404Live) {
      actions.push(marker('actions.isROT.unpublish'));
    } else if (isNew) {
      if (!is404Live) {
        actions.push(marker('actions.isNew.monitor'));
      } else if (is404Proto) {
        actions.push(marker('actions.isNew.createProto'));
      } else if (!is404Proto) {
        actions.push(marker('actions.isNew.createLive'));
      }
    } else if (isMoved && parentProto !== parentLive) {
      actions.push(marker('actions.isMoved.movePage'));
    }
    return actions;
  }
}
