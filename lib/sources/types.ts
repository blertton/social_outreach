export type SourceId = "bluesky" | "fixtures";
export interface SourcePost {
  external_id: string;
  author_id: string;
  author_handle: string;
  text: string;
  url: string | null;
  posted_at: string;
}
export interface SourceResult { posts: SourcePost[]; filtered: number; skipped: number }
export interface SourceProvider { search(query: string): Promise<SourceResult> }
