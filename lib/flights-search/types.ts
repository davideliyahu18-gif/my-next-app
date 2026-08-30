export type ConversationStep =
  | "awaiting_origin"
  | "awaiting_destination"
  | "awaiting_departure"
  | "awaiting_return";

export type ConversationState = {
  step: ConversationStep;
  origin?: string;
  destination?: string;
  departDate?: string;
  updatedAt: string;
};

export type FlightSearchLinks = {
  googleFlightsUrl: string;
  skyscannerUrl: string | null;
};
