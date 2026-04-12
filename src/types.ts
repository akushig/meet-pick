export type TransportMode = 'car' | 'subway' | 'bus' | 'bike' | 'walk';

export interface Participant {
  id: string;
  name: string;
  departure: string;
  departureCoord?: { lat: number; lng: number };
  departureTime: string;
  transportModes: TransportMode[];
}

export interface Place {
  name: string;
  category: string;
  address: string;
  coord: { lat: number; lng: number };
  reason: string;
  rank?: number;
}

export interface Recommendation {
  region: string;
  regionCoord: { lat: number; lng: number };
  places: Place[];
}

export interface SelectedPlace {
  regionIndex: number;
  placeIndex: number;
}

export interface Gathering {
  id: string;
  purpose: string;
  description: string;
  meetingDate: string;
  meetingTime: string;
  participants: Participant[];
  recommendations?: Recommendation[];
  selectedPlace?: SelectedPlace;
  createdAt: string;
}
