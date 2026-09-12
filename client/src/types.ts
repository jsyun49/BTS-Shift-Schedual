export type Role = 'admin' | 'worker';

export interface CurrentUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  contact: string | null;
  color: string;
  mustChangePassword: boolean;
}

export interface WorkerSummary {
  id: number;
  name: string;
  role: Role;
  color: string;
}

export interface AdminUserView extends WorkerSummary {
  username: string;
  contact: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface ShiftType {
  id: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  color: string;
  is_off: number;
  is_active: number;
}

export interface ScheduleEntry {
  id: number;
  user_id: number;
  date: string;
  shift_type_id: number;
  created_by: number;
  updated_at: string;
  user_name: string;
  user_color: string;
  shift_type_name: string;
  shift_type_color: string;
  shift_is_off: number;
  start_time: string | null;
  end_time: string | null;
}

export interface MonthSchedulesResponse {
  schedules: ScheduleEntry[];
  understaffedDates: string[];
  minStaffPerDay: number;
}

export type SwapStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface SwapRequestView {
  id: number;
  requester_id: number;
  target_id: number;
  schedule_id: number;
  target_schedule_id: number | null;
  requested_shift_type_id: number | null;
  status: SwapStatus;
  created_at: string;
  resolved_at: string | null;
  requester_name: string;
  requester_color: string;
  target_name: string;
  target_color: string;
  schedule_date: string;
  schedule_shift_type_id: number;
  schedule_shift_type_name: string;
  requested_shift_type_name: string | null;
  requested_shift_type_color: string | null;
  // Legacy fields from the old 1:1 trade model — unused by newly created requests.
  target_schedule_date: string | null;
  target_schedule_shift_type_id: number | null;
  target_schedule_shift_type_name: string | null;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: string;
  message: string;
  is_read: number;
  related_id: number | null;
  created_at: string;
}

export interface StatsResponse {
  month: string;
  shiftTypes: string[];
  stats: {
    userId: number;
    name: string;
    color: string;
    totalWorkDays: number;
    offDays: number;
    byShiftType: Record<string, number>;
  }[];
}

export interface ApiErrorBody {
  error?: string;
}
