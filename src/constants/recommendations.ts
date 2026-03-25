export interface AgriculturalRecommendations {
  fertilizers: string[];
  organic: string[];
  chemical: string[];
}

export const RECOMMENDATIONS_MAP: Record<string, AgriculturalRecommendations> = {
  "Blast": {
    fertilizers: ["NPK (17:17:17)", "Potassium Sulfate"],
    organic: ["Neem oil spray", "Pseudomonas fluorescens"],
    chemical: ["Tricyclazole", "Carbendazim"]
  },
  "Leaf Spot": {
    fertilizers: ["NPK (10:10:10)", "Urea"],
    organic: ["Bordeaux mixture", "Compost tea"],
    chemical: ["Mancozeb", "Chlorothalonil"]
  },
  "Rust": {
    fertilizers: ["Potash", "NPK (15:15:15)"],
    organic: ["Sulfur dust", "Garlic extract"],
    chemical: ["Propiconazole", "Tebuconazole"]
  },
  "Aphids": {
    fertilizers: ["Balanced NPK", "Seaweed extract"],
    organic: ["Neem oil", "Insecticidal soap"],
    chemical: ["Imidacloprid", "Malathion"]
  },
  "Blight": {
    fertilizers: ["Calcium Nitrate", "NPK (12:12:17)"],
    organic: ["Copper fungicides", "Trichoderma viride"],
    chemical: ["Metalaxyl", "Mancozeb"]
  },
  "Powdery Mildew": {
    fertilizers: ["Potassium-rich fertilizer", "NPK (10:20:10)"],
    organic: ["Baking soda spray", "Milk-water solution"],
    chemical: ["Myclobutanil", "Sulfur"]
  },
  "Mealybugs": {
    fertilizers: ["NPK (20:20:20)", "Fish emulsion"],
    organic: ["Alcohol rub", "Neem oil"],
    chemical: ["Buprofezin", "Acetamiprid"]
  },
  "Root Rot": {
    fertilizers: ["Phosphorus-rich fertilizer", "Bone meal"],
    organic: ["Trichoderma harzianum", "Bio-slurry"],
    chemical: ["Fosetyl-Al", "Captan"]
  },
  "Downy Mildew": {
    fertilizers: ["NPK (15:15:30)", "Magnesium Sulfate"],
    organic: ["Copper hydroxide", "Garlic spray"],
    chemical: ["Azoxystrobin", "Dimethomorph"]
  },
  "Healthy": {
    fertilizers: ["NPK (19:19:19)", "Organic Compost"],
    organic: ["Vermicompost", "Seaweed extract"],
    chemical: []
  }
};

export function getRecommendations(disease: string): AgriculturalRecommendations {
  // Try to find a match in the keys
  const key = Object.keys(RECOMMENDATIONS_MAP).find(k => 
    disease.toLowerCase().includes(k.toLowerCase())
  );
  
  if (key) {
    return RECOMMENDATIONS_MAP[key];
  }
  
  // Default for unknown diseased state
  if (disease.toLowerCase() === 'none' || disease.toLowerCase() === 'healthy') {
    return RECOMMENDATIONS_MAP["Healthy"];
  }

  return {
    fertilizers: ["General NPK (19:19:19)", "Organic Compost"],
    organic: ["Neem cake", "Vermicompost"],
    chemical: ["Broad-spectrum fungicide (if severe)"]
  };
}
