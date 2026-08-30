export type FlightPriceOffer = {
  id: string;
  priceTotal: string;
  currency: string;
  outbound: {
    departAt: string;
    arriveAt: string;
    carrier: string;
    stops: number;
  };
  inbound: {
    departAt: string;
    arriveAt: string;
    carrier: string;
    stops: number;
  } | null;
};

export type HotelPriceOffer = {
  hotelId: string;
  name: string;
  rating: string | null;
  priceTotal: string;
  currency: string;
};
