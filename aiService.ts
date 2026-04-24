import { GoogleGenAI, Type } from "@google/genai";

const getGenAIClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({ apiKey });
};

export const matchProject = async (projectDescription: string, userProfileInfo: string) => {
  try {
    const ai = getGenAIClient();
    const prompt = `Based on the following freelancer profile summary and project description, calculate a "Match Score" out of 100 on how well suited the freelancer is for the project. Explain your reasoning briefly.

Freelancer Profile:
${userProfileInfo}

Project Description:
${projectDescription}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Match score between 0 and 100" },
            reason: { type: Type.STRING, description: "Short explanation for the score" }
          },
          required: ["score", "reason"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("AI Matching Error:", error);
    throw error;
  }
};

export const suggestDisputeResolution = async (taskDescription: string, chatHistory: string, disputeReason: string = "N/A") => {
  try {
    const ai = getGenAIClient();
    const prompt = `You are an AI mediator for a freelance platform. Review the task description, chat history, and dispute reason.
Suggest a fair resolution based on the evidence. Determine if the freelancer delivered the work as requested or if the client deserves a refund.

Task Description: ${taskDescription}

Dispute Reason/Context: ${disputeReason}

Chat History Logs: 
${chatHistory}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Brief summary of the conflict" },
            recommendation: { 
              type: Type.STRING, 
              description: "Specific recommendation: pay freelancer, refund client, or partial compromise" 
            },
            reasoning: { type: Type.STRING, description: "Why this recommendation is fair based on chat logs" }
          },
          required: ["summary", "recommendation", "reasoning"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("AI Dispute Resolution Error:", error);
    throw error;
  }
};
