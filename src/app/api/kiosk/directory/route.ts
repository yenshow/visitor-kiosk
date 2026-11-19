import { jsonError, jsonOk } from "@/lib/kiosk/api-helpers";
import { guardAdminAction } from "@/lib/kiosk/admin-guard";
import { writeAudit } from "@/lib/kiosk/audit";
import {
  createHost,
  createOrg,
  deleteHost,
  deleteOrg,
  getDirectory,
} from "@/lib/kiosk/directory";

export const GET = async (request: Request) => {
  const { denied } = await guardAdminAction(request, "directory.get");
  if (denied) return denied;

  try {
    return jsonOk(await getDirectory());
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "讀取人員目錄失敗",
      500,
    );
  }
};

type DirectoryBody = {
  action?: string;
  orgIndexCode?: string;
  orgName?: string;
  personId?: string;
  personName?: string;
};

export const POST = async (request: Request) => {
  const { ip, denied } = await guardAdminAction(request, "directory.post");
  if (denied) return denied;

  try {
    const body = (await request.json()) as DirectoryBody;
    const action = String(body.action ?? "").trim();

    if (action === "createOrg") {
      await createOrg(String(body.orgName ?? ""));
    } else if (action === "deleteOrg") {
      await deleteOrg(String(body.orgIndexCode ?? ""));
    } else if (action === "createHost") {
      await createHost({
        orgIndexCode: String(body.orgIndexCode ?? ""),
        personName: String(body.personName ?? ""),
      });
    } else if (action === "deleteHost") {
      await deleteHost(String(body.personId ?? ""));
    } else {
      return jsonError("未知的人員目錄操作");
    }

    const directory = await getDirectory();
    await writeAudit({ action: `directory.${action}`, result: "ok", ip });
    return jsonOk(directory);
  } catch (error) {
    await writeAudit({
      action: "directory.post",
      result: "error",
      ip,
      detail: error instanceof Error ? error.message : "fail",
    });
    return jsonError(
      error instanceof Error ? error.message : "更新人員目錄失敗",
      500,
    );
  }
};
