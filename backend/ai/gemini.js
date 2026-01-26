import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { calculateScores } from "./scoreCalculator.js";

export async function analyzeScreenshot(imagePath) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not set");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const MODEL_NAME = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    const imageBase64 = fs.readFileSync(imagePath).toString("base64");

    const result = await model.generateContent([
        {
            text: `
You are an expert UX/UI auditor. Analyze this webpage screenshot for a professional design audit.

Evaluate the design based on these specific dimensions:
1. Usability (Ease of use, interaction patterns)
2. Navigation (Menu structure, wayfinding)
3. Clarity (Readability, content hierarchy, value prob)
4. Accessibility (Contrast, text size, spacing - WCAG compliance)
5. Aesthetics (Visual polish, modern feel, consistency)

For every issue you identify, return a JSON object with:
- title: Short punchy title
- description: Clear explanation of the issue
- severity: Critical | High | Medium | Low
- category: Usability | Navigation | Clarity | Accessibility | Aesthetics

Return the result as valid JSON:
{
  "issues": [
    {
      "title": "...",
      "description": "...",
      "severity": "High",
      "category": "Usability"
    }
  ],
  "summary": "A 2-3 sentence executive summary of the page's UX.",
  "positive_highlights": ["List of 2-3 things done well"]
}

IMPORTANT:
Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.
Do not include trailing commas.
The response must be parseable by JSON.parse().
`
        },
        {
            inlineData: {
                mimeType: "image/png",
                data: imageBase64
            }
        }
    ]);

    const responseText = result.response.text();
    let aiData;

    try {
        aiData = JSON.parse(responseText);
    } catch (e) {
        console.error("Failed to parse Gemini JSON:", responseText);
        return null;
    }

    // Calculate scores based on the issues found
    const { breakdown, overall } = calculateScores(aiData.issues || []);

    return {
        ...aiData,
        scores: breakdown, // Detailed breakdown
        score: overall     // Single integer score (0-100)
    };
}
