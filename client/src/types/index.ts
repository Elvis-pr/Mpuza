/**
 * Shared TypeScript types for the MPUZA frontend.
 *
 * These mirror the exact shapes returned by the backend API
 * (server/routes/opportunities.js / server/supabase.js) so the
 * frontend always stays in sync with the data contract.
 */

export interface Skill {
  id: string;
  name: string;
  category: string;
  levelOptions: string[];
}

/** A student profile for the matching endpoint. */
export interface StudentProfile {
  id?: string;
  skills: { name: string; proficiency: string; category: string }[];
  year?: string;
  location?: string;
}

/** A single job / internship opportunity (curated OR live external). */
export interface Opportunity {
  id: string;
  title: string;
  company: string;
  type: 'internship' | 'fulltime';
  location: string;
  description: string;
  requirements: string[];
  pay: string;
  deadline: string;
  posted_at?: string;
  category?: string;
  tags?: string[];
  /** Live external jobs carry apply URL + source */
  url?: string;
  source?: string;
  external?: boolean;
}

/** A career resource / hub entry. */
export interface CareerResource {
  id: string;
  name: string;
  category: string;
  url: string;
  icon?: string;
}

/** Grouped opportunities returned by GET /api/opportunities */
export interface OpportunityGrouped {
  internship: Opportunity[];
  fulltime: Opportunity[];
  total: number;
  resources: CareerResource[];
}

/** Response from GET /api/opportunities */
export interface OpportunitiesResponse {
  success: boolean;
  total: number;
  grouped: OpportunityGrouped;
  message?: string;
}

/** Response from GET /api/opportunities/match */
export interface MatchResponse {
  success: boolean;
  matched: Opportunity[];
  stats: Record<string, unknown>;
  profile: { id: string; skillsCount: number; year: string } | null;
  message?: string;
}

/** Filter/pagination state for opportunities */
export type Filter = 'all' | 'internship' | 'fulltime';

export type RegionFilter = 'all' | 'rwanda';

export interface OpportunityFilters {
  q: string;
  type: Filter;
  region: RegionFilter;
}
