import type { LanguageModel } from "ai";
import { deepseekModel } from "src/server/ai/read-receipt";
import { getConfig } from "src/server/config";

let model: LanguageModel | undefined;

/** The DeepSeek model, with the key from the server's configuration. The key never leaves the server. */
export function getModel(): LanguageModel {
  model ??= deepseekModel(getConfig().deepseekApiKey);
  return model;
}
