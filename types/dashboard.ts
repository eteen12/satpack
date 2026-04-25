export type CallStatus = "paid" | "failed" | "fulfilled";

export interface CallRow {
  id: string;
  service_id: string;
  sats_paid: number;
  status: CallStatus;
  payment_hash: string | null;
  created_at: string;
}

export interface ServiceRollup {
  service_id: string;
  calls: number;
  sats: number;
}

export interface DashboardStats {
  total_sats: number;
  total_calls: number;
  by_service: ServiceRollup[];
  recent: CallRow[];
}
