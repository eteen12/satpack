export interface WeatherResult {
  location: string;
  temp_c: number;
  conditions: string;
  humidity: number;
  wind_kph: number;
}

interface OpenWeatherResponse {
  cod: number | string;
  message?: string;
  name: string;
  main: { temp: number; humidity: number };
  weather: Array<{ description: string }>;
  wind: { speed: number };
}

const FIXTURES: Record<string, WeatherResult> = {
  default: {
    location: "Cambridge, MA",
    temp_c: 11.4,
    conditions: "partly cloudy",
    humidity: 62,
    wind_kph: 14.5,
  },
  "kelowna,bc": {
    location: "Kelowna, BC",
    temp_c: 8.2,
    conditions: "light rain",
    humidity: 78,
    wind_kph: 9.1,
  },
};

export async function getCurrentWeather(args: {
  location: string;
}): Promise<WeatherResult> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn(
      "[weather] OPENWEATHER_API_KEY not set — returning fixture data",
    );
    const key = args.location.trim().toLowerCase().replace(/\s+/g, "");
    return FIXTURES[key] ?? { ...FIXTURES.default, location: args.location };
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", args.location);
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenWeather HTTP ${res.status}: ${body.slice(0, 120)}`);
  }
  const data = (await res.json()) as OpenWeatherResponse;
  if (Number(data.cod) !== 200) {
    throw new Error(`OpenWeather: ${data.message ?? "unknown error"}`);
  }
  return {
    location: data.name,
    temp_c: Math.round(data.main.temp * 10) / 10,
    conditions: data.weather[0]?.description ?? "unknown",
    humidity: data.main.humidity,
    wind_kph: Math.round(data.wind.speed * 3.6 * 10) / 10,
  };
}
