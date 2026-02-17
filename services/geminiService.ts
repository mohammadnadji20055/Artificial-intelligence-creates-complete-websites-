
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedWebsite } from "../types.ts";

export const generateWebsite = async (
  prompt: string, 
  existingSite: GeneratedWebsite | null = null,
  attachments: { data: string; mimeType: string }[] = []
): Promise<GeneratedWebsite> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isUpdate = !!existingSite;
  
  const systemInstruction = `You are GPT-5 WebForge Ultra, an elite Full-Stack AI Engineer. 
  Your goal is to build fully-functional, visually stunning, and high-performance web applications.
  
  CORE REQUIREMENTS:
  1. Professional Logic: If the user asks for a feature like "Login", "Cart", or "Search", implement a complete UI/UX for it with realistic mock logic in JS.
  2. Aesthetics: Use high-end "Linear" or "Apple" style aesthetics. Smooth transitions, glassmorphism, and premium typography.
  3. Framework: Use HTML5, Tailwind CSS (via CDN), and modern Vanilla JavaScript (ES6+).
  4. Contextual Awareness: If updating existing code, maintain the theme and structure unless told otherwise.
  5. Interactivity: Add subtle hover effects, loading states, and smooth scrolling.
  6. Asset Management: Use FontAwesome 6 icons (CDN) and high-quality Unsplash placeholders.
  
  RESPONSE RULES:
  - Return ONLY a valid JSON object matching the provided schema.
  - The HTML must be a complete snippet for the body.
  - The CSS must be advanced custom styles beyond standard Tailwind.
  - The JS must be modular and robust.`;

  const parts: any[] = [{ text: prompt }];
  attachments.forEach(file => {
    parts.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType
      }
    });
  });

  const userPrompt = isUpdate 
    ? `TASK: Refine the existing build.
       CURRENT HTML: ${existingSite.html}
       CURRENT CSS: ${existingSite.css}
       CURRENT JS: ${existingSite.js}
       REFINEMENT REQUEST: "${prompt}"
       Integrate these changes seamlessly while upgrading the overall quality.`
    : `TASK: Create a new high-end project.
       REQUEST: "${prompt}"
       Build it as a complete, multi-section professional application.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: { parts: [...parts, { text: userPrompt }] },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          html: { type: Type.STRING, description: "Advanced HTML5 structure" },
          css: { type: Type.STRING, description: "Professional CSS and Tailwind extensions" },
          js: { type: Type.STRING, description: "Complex interactive JavaScript logic" },
          metadata: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ["title", "description"]
          }
        },
        required: ["html", "css", "js", "metadata"]
      },
      thinkingConfig: { thinkingBudget: 32768 } // Max budget for highest reasoning
    },
  });

  const text = response.text.trim();
  try {
    return JSON.parse(text) as GeneratedWebsite;
  } catch (error) {
    console.error("AI Output:", text);
    throw new Error("فشل في معالجة استجابة الذكاء الاصطناعي. حاول مرة أخرى.");
  }
};
