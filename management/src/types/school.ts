// types/school.ts - 学校・学年・クラス・日次データの型定義

export type HierarchyMode = "class" | "department";

export interface School {
  id: string;
  name: string;
  createdAt?: string;
  hierarchyMode?: HierarchyMode;
}

export interface Grade {
  id: string;
  name: string;
  order: number;
}

export interface Department {
  id: string;
  name: string;
  order?: number;
}

export interface Class {
  id: string;
  name: string;
  schoolName?: string;
  displaySettings?: DisplaySettings;
}

export interface DisplaySettings {
  ads: Ad[];
  quietHours: QuietHour[];
}

export interface Ad {
  id: string;
  url: string;
  type: "image" | "video";
  duration_sec?: number;
  link_url?: string;
}

export interface QuietHour {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface Schedule {
  time: string;
  content: string;
  location?: string;
  display_start?: string;
  display_end?: string;
  _source?: string;
}

export interface Notice {
  text: string;
  is_highlight?: boolean;
  play_sound?: boolean;
  display_start?: string;
  display_end?: string;
  _source?: string;
}

export interface Assignment {
  deadline: string; // YYYY-MM-DD
  subject: string;
  task: string;
  display_start?: string;
  display_end?: string;
  _source?: string;
}

export interface DailyData {
  date: string; // YYYY-MM-DD
  schedules?: Schedule[];
  notices?: Notice[];
  assignments?: Assignment[];
  ads?: Ad[];
  quietHours?: QuietHour[];
}

export interface Device {
  id: string;
  name: string;
  gradeId: string;
  classId: string;
  status: "active" | "inactive";
  lastSeen?: string;
  deviceTokenHash?: string;
}
