import { PROJECT_URL, request } from './api';

export interface ProjectProgress {
  project_name: string;
  project_status: string;
  total_entries: number;
  completed_entries: number;
  overdue_entries: number;
  completion_percentage: number;
  upcoming_deadlines: Array<{
    id: string;
    summary: string;
    due_date: string;
    status: string;
    priority: string;
  }>;
  recent_activity: Array<{
    id: string;
    summary: string;
    status: string;
    created_at: string;
    due_date: string;
  }>;
}

export interface ProgressResponse {
  success: boolean;
  data?: ProjectProgress[];
  message?: string;
}

export async function getProjectProgress(): Promise<ProgressResponse> {
  return request<ProgressResponse>(`${PROJECT_URL}/service/progress`);
}
