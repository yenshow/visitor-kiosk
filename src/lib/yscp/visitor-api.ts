import { artemisPostSecure } from "./artemis-client";
import { toYscpVisitorNames } from "@/lib/kiosk/visitor-fields";

export type YscpApiResult<T> = {
  code: string;
  msg: string;
  data: T;
};

export const assertYscpOk = <T>(
  result: YscpApiResult<T>,
  fallbackMsg: string,
): T => {
  if (String(result?.code) !== "0") {
    throw new Error(result?.msg || fallbackMsg);
  }
  return result.data;
};

export type VisitorInfo = {
  visitorId?: string;
  visitorFamilyName?: string;
  visitorGivenName?: string;
  visitorName?: string;
  gender?: number;
  phoneNo?: string;
  companyName?: string;
  email?: string;
  /** 車牌；部分 YSCP 版本欄位名可能不同 */
  plateNo?: string;
};

export type AppointmentItem = {
  appointID: string;
  appointCode?: string;
  appointStartTime?: string;
  appointEndTime?: string;
  appointStatus?: string;
  receptionistName?: string;
  visitReasonType?: number | string;
  visitorReasonName?: string;
  visitReasonDetail?: string;
  visitorInfo?: VisitorInfo;
};

export type AppointmentListData = {
  total: number;
  pageNo: number;
  pageSize: number;
  list: AppointmentItem[];
};

export type AppointResult = {
  appointRecordId?: string;
  visitorId?: string;
  AppointCode?: string;
  qrCodeImage?: string;
  watchListInfo?: unknown[];
};

export type RegisterResult = {
  appointRecordId?: string;
  visitorId?: string;
  qrCodeImage?: string;
};

/** 在廠簽到記錄（getVistorRegisterRecord；實際欄位多在 visitorBaseInfo） */
export type VisitorRegisterRecord = {
  recordId?: string;
  appointRecordId?: string;
  registerTime?: string;
  visitingTime?: string;
  visitorStatus?: string | number;
  visitorBaseInfo?: Record<string, unknown>;
  visitorInfo?: Record<string, unknown>;
  VisitorInfo?: Record<string, unknown>;
  [key: string]: unknown;
};

export type VisitorRegisterRecordListData = {
  total?: number;
  totalNum?: number;
  pageNo?: number;
  pageSize?: number;
  list?: VisitorRegisterRecord[];
  rows?: VisitorRegisterRecord[];
  records?: VisitorRegisterRecord[];
};

const optionalTrim = (value?: string): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

export const createAppointment = async (body: {
  receptionistId: string;
  appointStartTime: string;
  appointEndTime: string;
  visitReasonType: number;
  visitReasonDetail?: string;
  visitorInfo: Pick<
    VisitorInfo,
    | "visitorFamilyName"
    | "visitorGivenName"
    | "companyName"
    | "phoneNo"
    | "email"
    | "gender"
    | "plateNo"
  >;
}): Promise<AppointResult> => {
  const path = "/artemis/api/visitor/v2/appointment";
  const info = body.visitorInfo;
  const plateNo = optionalTrim(info.plateNo);
  const { data } = await artemisPostSecure<YscpApiResult<AppointResult>>(path, {
    receptionistId: body.receptionistId,
    appointStartTime: body.appointStartTime,
    appointEndTime: body.appointEndTime,
    visitReasonType: body.visitReasonType,
    visitReasonDetail: body.visitReasonDetail ?? "",
    visitorInfoList: [
      {
        VisitorInfo: {
          ...toYscpVisitorNames(info),
          gender: info.gender ?? 0,
          companyName: info.companyName ?? "",
          phoneNo: info.phoneNo ?? "",
          email: info.email ?? "",
          ...(plateNo ? { plateNo } : {}),
        },
      },
    ],
  });

  return assertYscpOk(data, "建立預約失敗");
};

export const getAutomaticApproval = async (): Promise<number | null> => {
  try {
    const path = "/artemis/api/visitor/v1/visitorConfig/automaticApproval";
    const { data } = await artemisPostSecure<
      YscpApiResult<{ automaticApproval?: number }>
    >(path, {});
    const payload = assertYscpOk(data, "讀取自動審核設定失敗");
    return typeof payload?.automaticApproval === "number"
      ? payload.automaticApproval
      : null;
  } catch {
    return null;
  }
};

export const listAppointments = async (params: {
  appointCode?: string;
  phoneNo?: string;
  appointStartTime: string;
  appointEndTime: string;
  /** 不傳則不篩選狀態（簽退查密碼時需要） */
  appointState?: number | string;
}): Promise<AppointmentListData> => {
  const path = "/artemis/api/visitor/v1/appointment/appointmentlist";
  const body: Record<string, unknown> = {
    pageNo: 1,
    pageSize: 50,
    appointStartTime: params.appointStartTime,
    appointEndTime: params.appointEndTime,
  };
  if (params.appointState !== undefined) body.appointState = params.appointState;
  if (params.appointCode) body.appointCode = params.appointCode;
  if (params.phoneNo) body.phoneNo = params.phoneNo;

  const { data } = await artemisPostSecure<YscpApiResult<AppointmentListData>>(
    path,
    body,
  );
  return assertYscpOk(data, "查詢預約失敗");
};

/**
 * 查詢在廠中（已簽到）的訪客登記記錄。
 * 注意：官方路徑拼寫為 getVistorRegisterRecord（少一個 i）。
 * 注意：此環境 YSCP 可能忽略 phone／visitorId 篩選，呼叫端需自行過濾。
 */
export const getVisitorRegisterRecords = async (params: {
  visitStartTime: string;
  visitEndTime: string;
}): Promise<VisitorRegisterRecordListData> => {
  const path = "/artemis/api/visitor/v1/register/getVistorRegisterRecord";
  const body: Record<string, unknown> = {
    pageNo: 1,
    pageSize: 50,
    visitStartTime: params.visitStartTime,
    visitEndTime: params.visitEndTime,
    visitorStatus: "0",
    sortField: "visitingTime",
    orderType: "1",
  };

  const { data } = await artemisPostSecure<
    YscpApiResult<VisitorRegisterRecordListData | VisitorRegisterRecord[]>
  >(path, body);
  const payload = assertYscpOk(data, "查詢在廠記錄失敗");

  if (Array.isArray(payload)) {
    return { total: payload.length, list: payload };
  }

  const list =
    payload.list ?? payload.rows ?? payload.records ?? [];
  const totalNum = payload.totalNum;

  return {
    total: totalNum ?? payload.total ?? list.length,
    pageNo: payload.pageNo,
    pageSize: payload.pageSize,
    list,
  };
};

/** 訪客離場簽退，YSCP 會撤銷門禁／通道／電梯權限 */
export const visitorCheckOut = async (
  appointRecordId: string,
): Promise<void> => {
  const path = "/artemis/api/visitor/v1/visitor/out";
  const { data } = await artemisPostSecure<YscpApiResult<unknown>>(path, {
    appointRecordId,
  });
  assertYscpOk(data, "簽退失敗");
};

/** 報到：寫入 YSCP 時空的姓／名補 "-"。 */
export const registerCheckIn = async (body: {
  appointId: string;
  visitorId: string;
  visitStartTime: string;
  visitEndTime: string;
  visitPurposeType?: number;
  visitorInfo?: VisitorInfo;
}): Promise<RegisterResult> => {
  const path = "/artemis/api/visitor/v1/registerment";
  const info = body.visitorInfo ?? {};
  const phoneNo = optionalTrim(info.phoneNo);
  const plateNo = optionalTrim(info.plateNo);
  const companyName = optionalTrim(info.companyName);

  const { data } = await artemisPostSecure<YscpApiResult<RegisterResult>>(path, {
    appointId: body.appointId,
    visitorId: body.visitorId,
    visitStartTime: body.visitStartTime,
    visitEndTime: body.visitEndTime,
    visitPurposeType: body.visitPurposeType ?? 0,
    visitorInfoList: [
      {
        VisitorInfo: {
          visitorId: body.visitorId,
          ...toYscpVisitorNames(info),
          gender: info.gender ?? 0,
          ...(phoneNo ? { phoneNo } : {}),
          ...(plateNo ? { plateNo } : {}),
          ...(companyName ? { companyName } : {}),
        },
      },
    ],
  });

  return assertYscpOk(data, "簽到失敗");
};

export const reapplyAuth = async (visitorId: string): Promise<void> => {
  const path = "/artemis/api/visitor/v1/auth/reapplication";
  const { data } = await artemisPostSecure<YscpApiResult<unknown>>(path, {
    personIds: visitorId,
    ImmediateDownload: 0,
  });
  assertYscpOk(data, "權限下發失敗");
};
