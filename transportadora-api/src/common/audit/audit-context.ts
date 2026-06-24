export type AuditActor = {
  id?: string | null;
  sub?: string | null;
};

export function auditUserId(actor?: AuditActor | null) {
  return actor?.id || actor?.sub || null;
}
