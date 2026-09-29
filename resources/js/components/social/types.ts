export type Connection = {
  follower_id: string;
  following_id: string;
  display_name: string;
  status: 'pending' | 'accepted' | 'declined';
};
export type Meetup = {
  id: number;
  creator_id: string;
  display_name: string;
  title: string;
  description: string;
  place_id?: number;
  location: string;
  starts_at: string;
  expires_at: string;
  price: number;
  capacity: number;
  status: 'live' | 'cancelled' | 'expired';
  applications: {
    user_id: string;
    display_name: string;
    status: 'pending' | 'accepted' | 'declined';
  }[];
};
export type SocialData = {
  people: { user_id: string; display_name: string }[];
  connections: Connection[];
  activity: {
    id: number;
    user_id: string;
    display_name: string;
    place_name: string;
    place_id: number;
    kind: 'checkin' | 'favorite' | 'plan';
  }[];
  blocked: { blocked_id: string; display_name: string }[];
  events: Meetup[];
  reports: { event_id: number; user_id: string; reason: string }[];
};
export type SocialAction = (action: string, payload: object) => Promise<boolean>;
