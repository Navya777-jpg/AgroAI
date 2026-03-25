import { Language, AnalysisResult } from './services/gemini';

export interface ScanHistory {
  id: string;
  timestamp: number;
  image: string;
  result: AnalysisResult;
  translatedResult?: string;
  language: Language;
}

export interface WeatherData {
  condition: string;
  temp: number;
  risk: string;
  location: string;
}
