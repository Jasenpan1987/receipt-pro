import { errorResponse } from "src/server/http";
import { currentUserId } from "src/server/identity";
import { getSettings, saveSettings, SettingsChangedError } from "src/server/repo/settings";
import { getStore } from "src/server/repo/store";
import { removeRule } from "src/server/rules/apply-rule";

/**
 * S-09: deletes one rule, only if the settings are still `?version=<v>` (the version the page
 * showed). Existing receipts do not change; the next run follows the remaining rules.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const version = Number(new URL(request.url).searchParams.get("version"));
  if (!Number.isInteger(version) || version < 1) {
    return errorResponse(400, "请刷新规则列表后再删除。");
  }
  try {
    const store = getStore();
    const userId = currentUserId();
    const settings = await getSettings(store, userId);
    if (settings.version !== version) {
      return errorResponse(409, "规则刚被改过，请刷新后再删除。");
    }
    const next = removeRule(settings, id);
    if (!next) {
      return errorResponse(404, "这条规则已经不在了。");
    }
    await saveSettings(store, userId, next, version);
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof SettingsChangedError) {
      return errorResponse(409, "规则刚被改过，请刷新后再删除。");
    }
    console.error(`[receipt-pro] DELETE /api/rules/${id} failed:`, error);
    return errorResponse(500, "删除失败，请重试。");
  }
}
