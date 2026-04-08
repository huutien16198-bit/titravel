export interface WPSite {
  id: string;
  site: string;
  username: string;
  applicationPassword: string;
  name: string;
}

export interface PostData {
  title: string;
  content: string;
  status: 'publish' | 'draft' | 'future' | 'private';
  categories?: number[];
  tags?: number[];
  slug?: string;
  featured_media?: number;
  meta?: Record<string, any>;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'error' | 'success';
  message: string;
  site?: string;
}

export interface BulkJob {
  keyword: string;
  category: string;
  tags: string;
  count: number;
}
