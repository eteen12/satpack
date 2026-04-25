export type ServiceParams = Record<string, string>;

export interface Service {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: "GET" | "POST";
  price_sats: number;
  params: ServiceParams;
  example: string;
  returns: string;
}

export interface Catalog {
  marketplace: string;
  version: string;
  services: Service[];
}
