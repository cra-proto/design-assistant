import { Injectable, signal, computed, inject } from '@angular/core';
import { UrlPair, BreadcrumbNode, PageData, SearchMatches, BrokenLinks } from '../data/data.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../../../environments/environment';
import { FileUploadHandlerEvent } from 'primeng/fileupload';

import { CloudStorageService } from '../../../services/cloud-storage.service';

/*
Should contain:

Private signal/observable holding current Project object
Public readonly signals for components to consume
Methods to update project data
Methods to add/remove/modify tree nodes
Methods to mark pages for editing
Computed signals for stats (page counts, problem counts, etc.)
NO persistence logic (that goes elsewhere)*/


//Project phase
