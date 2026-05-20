export interface Place {
  id: number;
  name: string;
  type: 'restaurant' | 'activity';
  lat: number;
  lng: number;
  location: string;
  description: string;
  distance?: number;
  rating?: number;
  hours?: string;
  tags?: string[];
  image?: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  manual?: boolean;
}
