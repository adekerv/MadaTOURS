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
  hours?: string;
  tags?: string[];
  image?: string;
}
export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
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
}
