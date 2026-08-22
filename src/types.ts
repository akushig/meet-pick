export type TransportMode = 'car' | 'subway' | 'bus' | 'bike' | 'walk';

export interface Participant {
  id: string;
  name: string;
  departure: string;
  departureCoord?: { lat: number; lng: number };
  departureTime: string;
  transportModes: TransportMode[];
  arrival?: string;
  arrivalCoord?: { lat: number; lng: number };
  arrivalTime?: string;
  arrivalTimeEdited?: boolean;
  arrivalTransportModes?: TransportMode[];
}

export interface TravelEstimate {
  origin: string;
  names: string[];
  modes: { mode: string; minutes: number }[];
}

export interface Place {
  name: string;
  category: string;
  address: string;
  coord: { lat: number; lng: number };
  reason: string;
  travelTimes?: TravelEstimate[];
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
  meetingEndTime?: string;
  meetingEndTimeEdited?: boolean;
  participants: Participant[];
  recommendations?: Recommendation[];
  recommendationSummary?: string;
  selectedPlace?: SelectedPlace;
  regionCount?: number;
  placesPerRegion?: number;
  createdAt: string;
  pinned?: boolean;
  pinnedAt?: string;
}
