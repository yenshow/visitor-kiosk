export type VisitorInfo = {
  visitorId?: string;
  visitorFamilyName?: string;
  visitorGivenName?: string;
  visitorName?: string;
  gender?: number;
  phoneNo?: string;
  companyName?: string;
  email?: string;
  plateNo?: string;
};

export type AppointmentItem = {
  appointID: string;
  appointCode?: string;
  appointStartTime?: string;
  appointEndTime?: string;
  /** 0＝待報到（已核准）；3＝已報到；4＝已簽退 */
  appointStatus?: string;
  receptionistId?: string;
  receptionistName?: string;
  visitReasonType?: number | string;
  visitorReasonName?: string;
  visitReasonDetail?: string;
  visitorInfo?: VisitorInfo;
};

export type OrgOption = {
  orgIndexCode: string;
  orgName: string;
};

export type HostPerson = {
  personId: string;
  personName: string;
  orgIndexCode?: string;
};
