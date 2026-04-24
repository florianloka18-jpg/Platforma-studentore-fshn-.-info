export type Role = 'STUDENT' | 'TEACHER';

export interface User {
  id: number;
  name: string;
  surname?: string;
  email: string;
  role: Role;
  phone?: string;
  bio?: string;
  class_code?: string;
  profile_photo?: string;
  program?: string;
  year?: string;
  group_name?: string;
  study_type?: string;
  is_class_admin?: boolean;
  is_confirmed?: boolean;
  email_verified?: boolean;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number;
  content: string;
  timestamp: string;
  sender_name?: string;
  sender_role?: string;
  sender_photo?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  deadline: string;
  materials?: string;
  max_points: number;
  submission_type: 'FILE' | 'TEXT' | 'BOTH';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  teacher_id: number;
  teacher_name?: string;
  created_at: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name?: string;
  content?: string;
  points?: number;
  feedback?: string;
  file_path?: string;
  status: 'SUBMITTED' | 'PENDING' | 'GRADED';
  is_late: boolean;
  submitted_at: string;
  graded_at?: string;
  assignment_title?: string;
}

export interface Test {
  id: number;
  title: string;
  description: string;
  test_date?: string;
  duration: number;
  total_points: number;
  teacher_id: number;
  status: 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'IN_GRADING' | 'PUBLISHED';
  created_at: string;
}

export interface Question {
  id: number;
  test_id: number;
  content: string;
  type: 'MCQ' | 'OPEN';
  options?: string; // JSON string
  correct_answer?: string;
  points: number;
}

export interface TestAttempt {
  id: number;
  test_id: number;
  user_id: number;
  student_name?: string;
  test_title?: string;
  start_time: string;
  end_time?: string;
  status: 'STARTED' | 'SUBMITTED' | 'GRADED';
  total_score: number;
  feedback?: string;
}

export interface TestAnswer {
  id: number;
  attempt_id: number;
  question_id: number;
  answer_text: string;
  points_awarded: number;
  is_correct?: boolean;
  question_text?: string;
  question_type?: string;
  options?: string;
  max_points?: number;
  correct_answer?: string;
}

export interface PersonalNote {
  id: number | string;
  user_id: number | string;
  title?: string;
  content: string;
  color?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
