import type { PlaceDetails } from './lib/content';
export interface Place {
  id: number;
  name: string;
  type: 'restaurant' | 'activity';
  lat: number;
  lng: number;
  location: string;
  description: string;
  descriptionFr?: string;
  access?: 'unknown' | 'open' | 'restricted';
  sources?: { url: string; title: string; checkedAt: string; fields: string[] }[];
  photoCredit?: {
    author: string;
    license: string;
    sourceUrl: string;
    licenseUrl: string;
    caption: string;
  };
  distance?: number;
  rating?: number;
  communityRating?: number;
  communityCount?: number;
  googlePlaceId?: string;
  hoursSource?: string;
  hoursUpdatedAt?: string;
  hours?: string;
  openingPeriods?: { day: number; opens: number; closes: number }[];
  tags?: string[];
  image?: string;
  details?: PlaceDetails;
  /** Set only when the listing needs a note; closed places are never sent to visitors. */
  listingStatus?: 'needs_review';
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified?: boolean;
}
export interface UserLocation {
  lat: number;
  lng: number;
  manual?: boolean;
}
export interface ExploreParams {
  filter: 'all' | 'restaurant' | 'activity';
  radius?: number;
  sortBy?: 'rating' | 'hiking' | 'entertainment';
  selectedPlaceId?: number;
  query?: string;
  town?: string;
  experience?: string;
  minRating?: number;
}
