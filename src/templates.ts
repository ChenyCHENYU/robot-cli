import type {
  TemplateConfig,
  CategoryConfig,
} from "./types";
import {
  TEMPLATE_CATEGORIES,
  REMOTE_REGISTRY_URL,
  RECOMMENDED_TEMPLATE_KEYS,
} from "./config";

export { TEMPLATE_CATEGORIES };

// ── Remote Registry ──────────────────────────────────────────────

let remoteTemplates: Record<string, TemplateConfig> | null = null;

export async function loadRemoteRegistry(): Promise<void> {
  try {
    const response = await fetch(REMOTE_REGISTRY_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      remoteTemplates = (await response.json()) as Record<
        string,
        TemplateConfig
      >;
    }
  } catch {
    // Silently fall back to built-in templates
  }
}

// ── Helpers ──────────────────────────────────────────────────────

export function getAllTemplates(): Record<string, TemplateConfig> {
  const templates: Record<string, TemplateConfig> = {};

  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        Object.assign(templates, pattern.templates);
      }
    }
  }

  // Merge remote templates (built-in takes precedence)
  if (remoteTemplates) {
    for (const [key, template] of Object.entries(remoteTemplates)) {
      if (!templates[key]) {
        templates[key] = template;
      }
    }
  }

  return templates;
}

export function getTemplatesByCategory(
  categoryKey: string,
  stackKey: string,
  patternKey: string,
): Record<string, TemplateConfig> {
  const category = TEMPLATE_CATEGORIES[categoryKey];
  if (!category) return {};
  const stack = category.stacks[stackKey];
  if (!stack) return {};
  const pattern = stack.patterns[patternKey];
  if (!pattern) return {};
  return pattern.templates;
}

export function searchTemplates(
  keyword: string,
): Record<string, TemplateConfig> {
  const all = getAllTemplates();
  const results: Record<string, TemplateConfig> = {};
  const lower = keyword.toLowerCase();

  for (const [key, t] of Object.entries(all)) {
    const haystack =
      `${t.name} ${t.description} ${t.features.join(" ")}`.toLowerCase();
    if (haystack.includes(lower)) {
      results[key] = t;
    }
  }
  return results;
}

export function getRecommendedTemplates(): Record<string, TemplateConfig> {
  const all = getAllTemplates();
  const recommended: Record<string, TemplateConfig> = {};
  const keys = RECOMMENDED_TEMPLATE_KEYS;

  for (const key of keys) {
    if (all[key]) recommended[key] = all[key];
  }

  // Pad to at least 4 if not enough
  if (Object.keys(recommended).length < 4) {
    for (const key of Object.keys(all)) {
      if (!recommended[key] && Object.keys(recommended).length < 6) {
        recommended[key] = all[key];
      }
    }
  }

  return recommended;
}

export function getCategoryForTemplate(
  templateKey: string,
): CategoryConfig | undefined {
  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        if (templateKey in pattern.templates) return category;
      }
    }
  }
  return undefined;
}
