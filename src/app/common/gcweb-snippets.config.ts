export interface GCwebSnippet {
  label: string;
  snippet: string;
  category?: string;
}

export const GCWEB_SNIPPETS_ENG: GCwebSnippet[] = [
  {
    label: 'Or - side-by-side',
    category: 'And/or',
    snippet: `<ul class="list-unstyled cnjnctn-type-or cnjnctn-xs">\n  <li class="cnjnctn-col">\n    <p>This is content for column A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>This is content for column B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'Or - stacked',
    category: 'And/or',
    snippet: `<ul class="list-unstyled cnjnctn-type-or">\n  <li class="cnjnctn-col">\n    <p>This is content for column A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>This is content for column B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'And - side-by-side',
    category: 'And/or',
    snippet: `<ul class="list-unstyled cnjnctn-type-and cnjnctn-xs">\n  <li class="cnjnctn-col">\n    <p>This is content for column A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>This is content for column B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'And - stacked',
    category: 'And/or',
    snippet: `<ul class="list-unstyled cnjnctn-type-and">\n  <li class="cnjnctn-col">\n    <p>This is content for column A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>This is content for column B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'English',
    category: 'Rescue link',
    snippet: `<p class="pull-left small"><strong>You may be looking for:</strong></p>\n<ul class="pull-left small mrgn-lft-md list-unstyled">\n  <li><a href="#">Link text</a></li>\n</ul>\n<div class="clearfix"></div>`,
  },
  {
    label: 'French',
    category: 'Rescue link',
    snippet: `<p class="pull-left small"><strong>Vous cherchez peut-être :</strong></p>\n<ul class="pull-left small mrgn-lft-md list-unstyled">\n  <li><a href="#">Texte du lien</a></li>\n</ul>\n<div class="clearfix"></div>`,
  },
  {
    label: 'Bulleted',
    category: 'List',
    snippet: `<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n  <li>List item 3</li>\n</ul>`,
  },
  {
    label: 'Numbered',
    category: 'List',
    snippet: `<ol>\n  <li>List item 1</li>\n  <li>List item 2</li>\n  <li>List item 3</li>\n</ol>`,
  },
  {
    label: 'Checkmarks',
    category: 'List',
    snippet: `<ul class="fa-ul">\n  <li><span class="fas fa-check text-success fa-li"></span>List item 1</li>\n  <li><span class="fas fa-check text-success fa-li"></span>List item 2</li>\n  <li><span class="fas fa-times text-danger fa-li"></span>List item 3</li>\n</ul>`,
  },
  {
    label: 'Steps',
    category: 'List',
    snippet: `<ol class="lst-stps stps-strpd">\n  <li><h3>Heading goes here</h3>List item 1</li>\n  <li><h3>Heading goes here</h3>List item 2</li>\n  <li><h3>Heading goes here</h3>List item 3</li>\n</ol>`,
  },
  {
    label: 'Definition',
    category: 'List',
    snippet: `<dl class="dl-horizontal dt-max">\n  <dt>Term 1</dt>\n  <dd>Description of term 1</dd>\n  <dt>Term 2</dt>\n  <dd>Description of term 2</dd>\n  <dt>Term 3</dt>\n  <dd>Description of term 3</dd>\n</dl>`,
  },
  { label: 'Expand/Collapse', snippet: `<details>\n  <summary>Descriptive title</summary>\n  <p>Secondary information.</p>\n</details>` },
  {
    label: 'Info (blue)',
    category: 'Alert',
    snippet: `<section class="alert alert-info">\n  <h2 class="h3 mrgn-tp-0">Descriptive title</h2>\n  <p>Content of your alert <a href="#">link text</a>.</p>\n</section>`,
  },
  {
    label: 'Success (green)',
    category: 'Alert',
    snippet: `<section class="alert alert-success">\n  <h2 class="h3 mrgn-tp-0">Descriptive title</h2>\n  <p>Content of your alert <a href="#">link text</a>.</p>\n</section>`,
  },
  {
    label: 'Warning (yellow)',
    category: 'Alert',
    snippet: `<section class="alert alert-warning">\n  <h2 class="h3 mrgn-tp-0">Descriptive title</h2>\n  <p>Content of your alert <a href="#">link text</a>.</p>\n</section>`,
  },
  {
    label: 'Danger (red)',
    category: 'Alert',
    snippet: `<section class="alert alert-danger">\n  <h2 class="h3 mrgn-tp-0">Descriptive title</h2>\n  <p>Content of your alert <a href="#">link text</a>.</p>\n</section>`,
  },
];

export const GCWEB_SNIPPETS_FRA: GCwebSnippet[] = [
  {
    label: 'Ou - côte à côte',
    category: 'Et/ou',
    snippet: `<ul class="list-unstyled cnjnctn-type-or cnjnctn-xs">\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'Ou - empilé',
    category: 'Et/ou',
    snippet: `<ul class="list-unstyled cnjnctn-type-or">\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'Et - côte à côte',
    category: 'Et/ou',
    snippet: `<ul class="list-unstyled cnjnctn-type-and cnjnctn-xs">\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'Et - empilé',
    category: 'Et/ou',
    snippet: `<ul class="list-unstyled cnjnctn-type-and">\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne A</p>\n  </li>\n  <li class="cnjnctn-col">\n    <p>Contenu de la colonne B</p>\n  </li>\n</ul>`,
  },
  {
    label: 'Français',
    category: 'Lien de secours',
    snippet: `<p class="pull-left small"><strong>Vous cherchez peut-être :</strong></p>\n<ul class="pull-left small mrgn-lft-md list-unstyled">\n  <li><a href="#">Texte du lien</a></li>\n</ul>\n<div class="clearfix"></div>`,
  },
  {
    label: 'Anglais',
    category: 'Lien de secours',
    snippet: `<p class="pull-left small"><strong>You may be looking for:</strong></p>\n<ul class="pull-left small mrgn-lft-md list-unstyled">\n  <li><a href="#">Link text</a></li>\n</ul>\n<div class="clearfix"></div>`,
  },
  {
    label: 'À puces',
    category: 'Liste',
    snippet: `<ul>\n  <li>Élément 1 de la liste</li>\n  <li>Élément 2 de la liste</li>\n  <li>Élément 3 de la liste</li>\n</ul>`,
  },
  {
    label: 'Numérotée',
    category: 'Liste',
    snippet: `<ol>\n  <li>Élément 1 de la liste</li>\n  <li>Élément 2 de la liste</li>\n  <li>Élément 3 de la liste</li>\n</ol>`,
  },
  {
    label: 'Coches',
    category: 'Liste',
    snippet: `<ul class="fa-ul">\n  <li><span class="fas fa-check text-success fa-li"></span>Élément 1 de la liste</li>\n  <li><span class="fas fa-check text-success fa-li"></span>Élément 2 de la liste</li>\n  <li><span class="fas fa-times text-danger fa-li"></span>Élément 3 de la liste</li>\n</ul>`,
  },
  {
    label: 'Étapes',
    category: 'Liste',
    snippet: `<ol class="lst-stps stps-strpd">\n  <li><h3>L'en-tête va ici</h3>Élément 1 de la liste</li>\n  <li><h3>L'en-tête va ici</h3>Élément 2 de la liste</li>\n  <li><h3>L'en-tête va ici</h3>Élément 3 de la liste</li>\n</ol>`,
  },
  {
    label: 'Définition',
    category: 'Liste',
    snippet: `<dl class="dl-horizontal dt-max">\n  <dt>1er terme</dt>\n  <dd>Description du terme 1</dd>\n  <dt>2e terme</dt>\n  <dd>Description du terme 2</dd>\n  <dt>3e terme</dt>\n  <dd>Description du terme 3</dd>\n</dl>`,
  },
  { label: 'Développer/réduire', snippet: `<details>\n  <summary>Titre descriptif</summary>\n  <p>Renseignements secondaires.</p>\n</details>` },
  {
    label: 'Information (bleue)',
    category: 'Alerte',
    snippet: `<section class="alert alert-info">\n  <h2 class="h3 mrgn-tp-0">Titre descriptif</h2>\n  <p>Contenu de votre alerte <a href="#">texte du lien</a>.</p>\n</section>`,
  },
  {
    label: 'Succès (verte)',
    category: 'Alerte',
    snippet: `<section class="alert alert-success">\n  <h2 class="h3 mrgn-tp-0">Titre descriptif</h2>\n  <p>Contenu de votre alerte <a href="#">texte du lien</a>.</p>\n</section>`,
  },
  {
    label: 'Avertissement (jaune)',
    category: 'Alerte',
    snippet: `<section class="alert alert-warning">\n  <h2 class="h3 mrgn-tp-0">Titre descriptif</h2>\n  <p>Contenu de votre alerte <a href="#">texte du lien</a>.</p>\n</section>`,
  },
  {
    label: 'Danger (rouge)',
    category: 'Alerte',
    snippet: `<section class="alert alert-danger">\n  <h2 class="h3 mrgn-tp-0">Titre descriptif</h2>\n  <p>Contenu de votre alerte <a href="#">texte du lien</a>.</p>\n</section>`,
  },
];
