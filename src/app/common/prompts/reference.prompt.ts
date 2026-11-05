// Alert-analysis instructions composed into the problem prompt.
export const AlertIssuesInstructions = `{
  "inputs": {
    "alerts": "Array of alert HTML strings in source order. Each item is the full alert container.",
    "pageSignals": {
      "optional": true,
      "description": "Structured page-level hints such as title, h1, pageTypeSignal, introSnippet, and h2Headings."
    },
    "alertPlacementContext": {
      "optional": true,
      "description": "Structured per-alert placement hints such as is_before_first_h2, position_percent_in_main, nearest_h2_above, nearest_h2_below, section snippets, and alert clustering."
    },
    "alertSignals": {
      "optional": true,
      "description": "Precomputed per-alert structural signals such as alert_type, heading metadata, paragraph count, link count, links, hidden-content flags, and adjacency flags."
    }
  },
  "workflow": [
    { "step": 1,
      "name": "enumerate_alerts",
      "instruction": "Analyze every alert in the alerts array. Use array order as alert_index, starting at 1."
    },
    { "step": 2,
      "name": "use_structured_context",
      "instruction": "Use pageSignals as page-level evidence when present. For each alert, use the alertPlacementContext and alertSignals objects with the same alert_index as primary evidence. If structured context conflicts with a weak inference from raw HTML, prefer the structured context."
    },
    { "step": 3,
      "name": "check_simple_issues",
      "instruction": "For each alert, evaluate every simple issue category independently."
    },
    { "step": 4,
      "name": "check_complex_issues",
      "instruction": "For each alert, evaluate every complex issue category independently."
    }
  ],
  "simpleIssueCategories": [
    { "name": "Misuse",
      "rule": "Do not use alerts for standard process steps, low-risk warnings, routine information, or emphasis. Use pageTypeSignal, title, and h1 to assess page-wide appropriateness."
    },
    { "name": "Too wordy",
      "rule": "Alerts must be short and easy to scan. Flag multiple paragraphs, avoidable detail, or more than 2 sentences unless the sentences are short. Do not flag based on character count alone; use paragraph_count and text_length_chars as supporting evidence. For longer content, recommend a short summary linking to the full details."
    },
    { "name": "Generic titles",
      "rule": "Flag headings such as Note, Info, Important, or New. Alert titles must be descriptive."
    },
    { "name": "Unclear impact",
      "rule": "The alert must explain any consequence that is not obvious to the user, and not just state a fact."
    },
    { "name": "Outdated",
      "rule": "Flag past dates, expired notices, or resolved events. Alerts are temporary."
    },
    { "name": "Missing heading",
      "rule": "Alerts must contain an appropriate heading pattern when a heading is needed for scanability and context. Use has_heading, heading_level, heading_source, and heading_tag as evidence. Recommend a descriptive heading and do not suggest generic labels such as Note, Important, Info, or New."
    },
    { "name": "Wrong type",
      "rule": "The alert type must match the severity; use alert_type as evidence. For example, use alert-info (blue) for updates, clarifications, delays, expected outages; use alert-warning (yellow/orange) for unexpected outages, serious service disruptions or termination, possible consequences of an action or inaction; use alert-danger (red) only rarely, for situations that could place someone in danger, or an issue that could cause them to be unable to complete their task."
    },
    { "name": "Hidden content",
      "rule": "Do not use accordions, expand-collapse patterns, or hidden content inside alerts. Alert content must be visible; use has_hidden_content as evidence."
    },
    { "name": "Wrong component",
      "rule": "Do not use alerts for content better handled by another component, such as labels for New items. These alerts should usually be removed."
    },
    { "name": "Too many links",
      "rule": "Limit alerts to one primary link when possible. Use link_count, has_multiple_links, and links as evidence and for link-related recommendations."
    },
    { "name": "Wrong placement",
      "rule": "Flag only when an alert applies to specific content but is placed globally or far from the relevant section. Use h2Headings, nearest_h2_above, nearest_h2_below, is_before_first_h2, position_percent_in_main, and nearby section snippets as supporting evidence. Do not flag an alert solely because it appears before the first substantive section."
    },
    { "name": "Alert overload",
      "rule": "Flag multiple stacked or clustered alerts that may create alert fatigue. Use the full set of placement objects, previous_sibling_is_alert, next_sibling_is_alert, and adjacent_alert_cluster_size to assess clustering."
    },
    { "name": "Low relevance",
      "rule": "On home, landing, or broad overview pages, alerts should apply to more than half of the audience. Use pageTypeSignal, title, and h1 to assess whether an alert is narrowly targeted relative to the page."
    },
    { "name": "Incorrect hierarchy",
      "rule": "Alert headings must follow the heading structure of the page (e.g., there should never be an H4 after an H2). Use has_heading, heading_level, heading_source, heading_tag, h2Headings, nearest_h2_above, and nearest_h2_below to compare the alert heading pattern with nearby page headings and section position, not just the alert markup in isolation."
    },
    { "name": "Nothing actionable",
      "rule": "If no next-step link exists, flag the alert to confirm that none is needed or whether it needs to be deleted and the information added to the page instead."
    }
  ],
  "complexIssueCategories": [
    { "name": "Focus order",
      "rule": "Ensure the alert's logical reading order is preserved and not skipped by assistive technologies."
    },
    { "name": "Content clarity",
      "rule": "Use plain language and keep the reading level around Grade 6-8."
    },
    { "name": "Non-text content",
      "rule": "Images and icons need descriptive alternatives."
    },
    { "name": "Missing alert semantics",
      "rule": "Flag visually styled alerts whose alert or notice purpose is not programmatically identifiable to assistive technologies. Do not use this category for missing headings or defects covered by another category. Recommend design-system review only. Do not recommend role=alert, role=status, aria-live, or any other unapproved semantic markup for static content."
    },
    { "name": "Accessibility/code",
      "rule": "Flag accessibility or markup defects not covered by another issue category. Do not flag a heading solely because its visual heading class differs from its semantic heading tag. This is acceptable when the tag follows the page hierarchy; classes such as h4 may intentionally control appearance."
    }
  ],
  "outputRules": {
    "requirements": [
      "Include the alert number in the description, for example: Alert 2: ...",
      "Emit a separate issue item for every category that applies to each alert."
    ]
  }
}`;
