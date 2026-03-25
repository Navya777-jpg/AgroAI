import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getRecommendations } from "../constants/recommendations";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export type Language = 'en' | 'ta' | 'te';

export interface AnalysisResult {
  crop: string;
  healthStatus: string;
  disease: string;
  severity: 'Healthy' | 'Medium' | 'Severe';
  confidence: number;
  symptoms: string;
  treatment: string[];
  prevention: string;
  rawMarkdown: string;
  focusArea?: { x: number, y: number, width: number, height: number };
  fertilizers?: string[];
  organic?: string[];
  chemical?: string[];
}

const SYSTEM_INSTRUCTION = `You are an expert agricultural scientist. Analyze the provided image of a crop.
Provide a structured analysis in the following format:

Crop: [Name]
Health Status: [Healthy/Diseased]
Disease/Pest: [Name or None]
Severity: [Healthy/Medium/Severe]
Confidence: [Percentage]
Focus Area: [x, y, width, height] (Normalized 0-100, where the disease is most visible)

## Symptoms Observed:
[Bullet points]

Treatment Steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Prevention:
[Description]

Be precise and professional. If the crop is healthy, state it clearly.`;

export async function analyzeImage(base64Image: string): Promise<AnalysisResult> {
  const model = "gemini-3-flash-preview";
  
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image.split(',')[1] || base64Image,
    },
  };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: SYSTEM_INSTRUCTION },
          imagePart
        ]
      }
    ],
    config: {
      temperature: 0.4,
    }
  });

  const text = response.text || "";
  const result = parseAnalysis(text);
  
  // Add recommendations based on disease
  const recommendations = getRecommendations(result.disease || result.healthStatus);
  return {
    ...result,
    fertilizers: recommendations.fertilizers,
    organic: recommendations.organic,
    chemical: result.severity === 'Severe' ? recommendations.chemical : []
  };
}

export async function translateText(text: string, targetLang: Language): Promise<string> {
  if (targetLang === 'en') return text;

  const langName = targetLang === 'ta' ? 'Tamil' : 'Telugu';
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the following agricultural analysis into ${langName}. Keep the structure and headers exactly as they are.
    
    Text to translate:
    ${text}`,
  });

  return response.text || text;
}

export async function translateAnalysis(analysis: AnalysisResult, targetLang: Language): Promise<AnalysisResult> {
  if (targetLang === 'en') return analysis;

  const langName = targetLang === 'ta' ? 'Tamil' : 'Telugu';
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the following agricultural analysis data into ${targetLang === 'ta' ? 'Tamil' : 'Telugu'}.
    Return a JSON object with the following fields translated:
    - crop
    - healthStatus
    - disease
    - symptoms
    - treatment (array of strings)
    - prevention
    - fertilizers (array of strings)
    - organic (array of strings)
    - chemical (array of strings)
    - rawMarkdown (The full markdown report)

    Original Data:
    ${JSON.stringify({
      crop: analysis.crop,
      healthStatus: analysis.healthStatus,
      disease: analysis.disease,
      symptoms: analysis.symptoms,
      treatment: analysis.treatment,
      prevention: analysis.prevention,
      fertilizers: analysis.fertilizers,
      organic: analysis.organic,
      chemical: analysis.chemical,
      rawMarkdown: analysis.rawMarkdown
    })}

    Ensure the JSON is valid and only contains these fields.`,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const translatedData = JSON.parse(response.text || "{}");
    return {
      ...analysis,
      ...translatedData
    };
  } catch (err) {
    console.error("Translation parse failed", err);
    return analysis;
  }
}

function parseAnalysis(text: string): AnalysisResult {
  const lines = text.split('\n');
  const getVal = (key: string) => {
    const line = lines.find(l => l.toLowerCase().startsWith(key.toLowerCase()));
    return line ? line.split(':')[1]?.trim() : '';
  };

  const severityRaw = getVal('Severity:');
  let severity: 'Healthy' | 'Medium' | 'Severe' = 'Healthy';
  if (severityRaw.toLowerCase().includes('severe')) severity = 'Severe';
  else if (severityRaw.toLowerCase().includes('medium')) severity = 'Medium';

  const confidenceRaw = getVal('Confidence:');
  const confidence = parseInt(confidenceRaw.replace(/[^0-9]/g, '')) || 85;

  const focusAreaRaw = getVal('Focus Area:');
  let focusArea = undefined;
  if (focusAreaRaw) {
    const parts = focusAreaRaw.split(',').map(p => parseInt(p.trim()));
    if (parts.length === 4) {
      focusArea = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  // Extract sections
  const symptomsMatch = text.match(/## Symptoms Observed:([\s\S]*?)(?=Treatment Steps:|$)/i);
  const treatmentMatch = text.match(/Treatment Steps:([\s\S]*?)(?=## Prevention:|$)/i);
  const preventionMatch = text.match(/## Prevention:([\s\S]*?)$/i);

  const treatmentSteps = treatmentMatch ? 
    treatmentMatch[1].split('\n').filter(l => l.trim().match(/^\d\./)).map(l => l.replace(/^\d\.\s*/, '').trim()) : 
    [];

  return {
    crop: getVal('Crop:'),
    healthStatus: getVal('Health Status:'),
    disease: getVal('Disease/Pest:'),
    severity,
    confidence,
    symptoms: symptomsMatch ? symptomsMatch[1].trim() : '',
    treatment: treatmentSteps,
    prevention: preventionMatch ? preventionMatch[1].trim() : '',
    rawMarkdown: text,
    focusArea
  };
}
