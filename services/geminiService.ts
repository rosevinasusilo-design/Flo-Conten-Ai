import { GoogleGenAI, GenerateContentResponse, GenerateImagesResponse, Operation, Modality, Type } from "@google/genai";
// FIX: Import CreativeBrief for the new generateFashionPhotoshoot function.
import type { ImageInput, VeoModel, AspectRatio as VideoAspectRatio, Resolution, CharacterVoice, VisualStyle, ImageAspectRatio, CreativeBrief } from '../types';

/**
 * A helper function to retry an async function with exponential backoff.
 * This is crucial for handling API rate limits (HTTP 429).
 * @param apiCall The async function to call.
 * @param maxRetries The maximum number of times to retry.
 * @param initialDelay The initial delay in milliseconds before the first retry.
 * @returns The result of the successful API call.
 */
const withRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000
): Promise<T> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      // Attempt the API call
      return await apiCall();
    } catch (error: any) {
      // Check if the error message indicates a rate limit error
      const isRateLimitError = error instanceof Error && 
                               (error.message.includes('got status: 429') || error.message.toLowerCase().includes('quota exceeded'));

      if (isRateLimitError && attempt < maxRetries - 1) {
        attempt++;
        // Calculate delay with exponential backoff and add random jitter
        const delay = initialDelay * (2 ** (attempt - 1));
        const jitter = Math.random() * 500; // Add up to 500ms of randomness
        const waitTime = delay + jitter;
        
        console.warn(`Rate limit exceeded. Retrying in ${Math.round(waitTime / 1000)}s... (Attempt ${attempt}/${maxRetries - 1})`);
        
        // Wait for the calculated time before the next attempt
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // If it's not a rate limit error or we've exhausted all retries, throw the error
        console.error(`API call failed after ${attempt} retries or with a non-retriable error.`, error);
        
        // When retries are exhausted for a rate limit error, throw a more user-friendly message.
        if (isRateLimitError) {
          throw new Error("API quota exceeded. Please check your billing plan and limits in your Google AI account. If the issue persists, please try again later.");
        }
        
        // FIX: Ensure a standard Error object is always thrown.
        // This prevents non-string errors (like `[object Object]`) from propagating to the UI.
        if (error instanceof Error) {
            throw error; // It's already an Error, so just re-throw it.
        } else if (error && typeof error.message === 'string') {
            // It's an object with a message property (e.g., a Supabase error).
            throw new Error(error.message);
        } else {
            // It's some other kind of object or value. Stringify it to be safe.
            try {
                throw new Error(JSON.stringify(error) || 'An unknown error occurred during the API call.');
            } catch (stringifyError) {
                throw new Error('An unknown and non-serializable error occurred during the API call.');
            }
        }
      }
    }
  }
  // This part should not be reached but is a fallback to satisfy TypeScript
  throw new Error('Exhausted all retries for API call.');
};

const getGenAIClient = (apiKey: string): GoogleGenAI => {
    if (!apiKey) {
        throw new Error("API Key is missing.");
    }
    return new GoogleGenAI({ apiKey });
};

export const generateSpeech = async (
    apiKey: string,
    text: string,
    voiceName: string
): Promise<string> => {
    const ai = getGenAIClient(apiKey);
    // FIX: Explicitly type the response to resolve an issue where TypeScript inferred it as 'unknown'.
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName },
                },
            },
        },
    }));
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
        throw new Error("Model did not return audio data.");
    }

    return base64Audio;
};

// FIX: Add missing image generation and editing functions.
export const changeImageAspectRatio = async (
  apiKey: string,
  {
    mainImage,
    aspectReferenceImage,
  }: {
    mainImage: ImageInput;
    aspectReferenceImage: ImageInput;
  }
): Promise<ImageInput> => {
  const ai = getGenAIClient(apiKey);
  const prompt = `Expand the main image to perfectly match the aspect ratio of the reference image. The reference image is a solid color block representing the target dimensions. The final output must only be the edited image, filling the new aspect ratio. Do not add any new elements unless necessary to fill the expanded space creatively.`;

  const mainImagePart = { inlineData: { data: mainImage.data, mimeType: mainImage.mimeType } };
  const aspectReferenceImagePart = { inlineData: { data: aspectReferenceImage.data, mimeType: aspectReferenceImage.mimeType } };
  const textPart = { text: prompt };

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [mainImagePart, aspectReferenceImagePart, textPart] },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  }));
  
  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

  if (imagePart?.inlineData) {
    return {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    };
  } else {
    let reason = "Model did not generate an image.";
    if (response.promptFeedback?.blockReason) {
      reason += ` Blocked due to safety policy: ${response.promptFeedback.blockReason}.`;
    } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      reason += ` Generation finished unexpectedly: ${candidate.finishReason}.`;
    }
    throw new Error(reason);
  }
};

export const editImage = async (
  apiKey: string,
  image: ImageInput,
  prompt: string
): Promise<ImageInput> => {
  const ai = getGenAIClient(apiKey);

  const imagePart = { inlineData: { data: image.data, mimeType: image.mimeType } };
  const textPart = { text: prompt };

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  }));

  const candidate = response.candidates?.[0];
  const imagePartResponse = candidate?.content?.parts?.find(p => p.inlineData);

  if (imagePartResponse?.inlineData) {
    return {
      data: imagePartResponse.inlineData.data,
      mimeType: imagePartResponse.inlineData.mimeType,
    };
  } else {
    let reason = "Model did not generate an image.";
    if (response.promptFeedback?.blockReason) {
      reason += ` Blocked due to safety policy: ${response.promptFeedback.blockReason}.`;
    } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      reason += ` Generation finished unexpectedly: ${candidate.finishReason}.`;
    }
    throw new Error(reason);
  }
};

export const generateImage = async (
  apiKey: string,
  prompt: string,
  aspectRatio: ImageAspectRatio
): Promise<ImageInput> => {
  const ai = getGenAIClient(apiKey);
  const response: GenerateImagesResponse = await withRetry(() => ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/png',
      aspectRatio: aspectRatio,
    },
  }));

  const image = response.generatedImages?.[0]?.image;

  if (image?.imageBytes) {
    return {
      data: image.imageBytes,
      mimeType: image.mimeType || 'image/png',
    };
  } else {
    throw new Error("Model did not generate an image. This could be due to a safety policy violation or an internal error.");
  }
};

export const suggestVideoPrompt = async (
  apiKey: string,
  image: ImageInput
): Promise<string> => {
  const ai = getGenAIClient(apiKey);
  const prompt = "Based on this image of a fashion model wearing a product, create a short, dynamic, one-sentence prompt for generating a video. The prompt should describe a subtle action or camera movement. Examples: 'The camera slowly zooms in on the model.', 'A gentle breeze makes the fabric sway slightly.', 'The model subtly shifts their pose.', 'Soft light flares across the scene.'";
  
  const imagePart = { inlineData: { data: image.data, mimeType: image.mimeType } };
  const textPart = { text: prompt };

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
  }));

  // Clean up the response, remove quotes if any
  let suggestedPrompt = response.text.trim();
  if (suggestedPrompt.startsWith('"') && suggestedPrompt.endsWith('"')) {
      suggestedPrompt = suggestedPrompt.substring(1, suggestedPrompt.length - 1);
  }
  return suggestedPrompt;
};

export const generateImageWithCharacterConsistency = async (
  apiKey: string,
  prompt: string,
  characterImages: ImageInput[],
  aspectRatio: ImageAspectRatio
): Promise<ImageInput> => {
  const ai = getGenAIClient(apiKey);

  const parts: any[] = [];
  
  // Add character images as input
  characterImages.forEach(img => {
    parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
  });

  // Construct the text prompt
  const finalPrompt = `**Instructions:**
1.  **Primary Goal:** Create a new scene based on the text prompt below.
2.  **Character Consistency (CRITICAL):** The characters in the new scene MUST be visually consistent with the provided reference character images. Re-draw the characters from the reference images into the new scene described by the text prompt.
3.  **Aspect Ratio:** The final output image MUST have a ${aspectRatio} aspect ratio.
4.  **Scene Details:** Follow the text prompt for the scene's composition, action, and environment.

**Text Prompt:**
${prompt}`;

  parts.push({ text: finalPrompt });

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: parts },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  }));
  
  const candidate = response.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

  if (imagePart?.inlineData) {
    return {
      data: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
    };
  } else {
    let reason = "Model did not generate an image.";
    if (response.promptFeedback?.blockReason) {
      reason += ` Blocked due to safety policy: ${response.promptFeedback.blockReason}.`;
    } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      reason += ` Generation finished unexpectedly: ${candidate.finishReason}.`;
    }
    throw new Error(reason);
  }
};

// FIX: Implement the missing generateFashionPhotoshoot function.
export const generateFashionPhotoshoot = async (
  apiKey: string,
  {
    productImage,
    brief,
  }: {
    productImage: ImageInput;
    brief: CreativeBrief;
  }
): Promise<ImageInput[]> => {
  const ai = getGenAIClient(apiKey);
  
  let finalPrompt = `Product photoshoot featuring this item.
- Scene: ${brief.prompt}
- Aspect Ratio: ${brief.aspectRatio}.
- The product must be clearly visible and naturally integrated into the scene.`;

  if (brief.modelType === 'model') {
    finalPrompt += '\n- A model should be wearing or using the product.';
  } else if (brief.modelType === 'mannequin') {
    finalPrompt += '\n- The product should be displayed on a mannequin.';
  } else { // flatLay
    finalPrompt += '\n- This should be a flat lay photograph of the product.';
  }

  const productImagePart = { inlineData: { data: productImage.data, mimeType: productImage.mimeType } };
  const textPart = { text: finalPrompt };

  // Generate 4 images in parallel as the UI suggests
  const imagePromises = Array(4).fill(0).map(async () => {
    const response: GenerateContentResponse = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [productImagePart, textPart] },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      })
    );

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(p => p.inlineData);

    if (imagePart?.inlineData) {
      return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType,
      };
    } else {
      let reason = "Model did not generate an image for photoshoot.";
      if (response.promptFeedback?.blockReason) {
        reason += ` Blocked due to safety policy: ${response.promptFeedback.blockReason}.`;
      } else if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        reason += ` Generation finished unexpectedly: ${candidate.finishReason}.`;
      }
      throw new Error(reason);
    }
  });

  return Promise.all(imagePromises);
};

export const analyzeProductLink = async (
  apiKey: string,
  productLink: string,
  voiceOverStyle: string
): Promise<{ productAnalysis: string; voiceOverScripts: string[]; videoCaption: string; hashtags: string[] }> => {
  const ai = getGenAIClient(apiKey);
  
  const voiceOverInstruction = voiceOverStyle
    ? `with a "${voiceOverStyle}" style as a reference`
    : `in three different random styles (for example: one energetic, one informative, and one humorous)`;

  const prompt = `As an expert e-commerce marketing assistant, analyze the product from the following URL: "${productLink}".

  Based on the product, its platform (detect if it's TikTok, Shopee, or Tokopedia from the URL), and its likely target audience, generate the following content in Bahasa Indonesia:
  1.  A detailed product analysis.
  2.  Three variations of a compelling voice-over script ${voiceOverInstruction}. Each script variation MUST be a maximum of 500 characters. Each variation must include a strong hook, key product features, and a clear call-to-action (CTA).
  3.  A short, SEO-optimized video caption/title specifically tailored for the detected platform (e.g., more casual for TikTok, more descriptive for Shopee/Tokopedia).
  4.  A list of relevant hashtags.
  
  Return the result as a JSON object.`;

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productAnalysis: {
            type: Type.STRING,
            description: "A detailed analysis of the product, including its features, benefits, and target audience.",
          },
          voiceOverScripts: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "An array of three different voice-over script variations, each under 500 characters.",
          },
          videoCaption: {
            type: Type.STRING,
            description: "A short, SEO-friendly caption or title for a promotional video, tailored to the source platform.",
          },
          hashtags: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "An array of relevant hashtags for the product and platform.",
          },
        },
        required: ["productAnalysis", "voiceOverScripts", "videoCaption", "hashtags"],
      },
    },
  }));

  const jsonStr = response.text.trim();
  const result = JSON.parse(jsonStr);
  return result;
};


// The existing service functions are kept below for other parts of the application.
// ... (The rest of the original services/geminiService.ts file)
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
    if (!apiKey) return false;
    try {
        const ai = getGenAIClient(apiKey);
        // A simple, lightweight call to check authentication, wrapped with retry logic.
        await withRetry(() => ai.models.list());
        return true;
    } catch (error) {
        console.error("API Key validation failed after retries:", error);
        return false;
    }
};

export const generateVideo = async (
  apiKey: string,
  { prompt, imageBase64, imageMimeType, model }: { prompt: string | object; imageBase64: string | null; imageMimeType: string | null; model: VeoModel; },
  aspectRatio: VideoAspectRatio,
  enableSound: boolean,
  resolution: Resolution,
  characterVoice: CharacterVoice,
  visualStyle: VisualStyle
): Promise<string> => {
  const ai = getGenAIClient(apiKey);

  let finalPrompt: string;
  if (typeof prompt === 'string') {
    let fullPrompt: string;
    
    if (imageBase64) {
        fullPrompt = `Animate the provided source image according to the detailed instructions below.`;
    } else {
        fullPrompt = `Create a video based on the following detailed instructions.`;
    }
    
    fullPrompt += `\n\n**Animation Instructions:** "${prompt}"`;
    fullPrompt += `\n\n**CRITICAL TECHNICAL REQUIREMENTS (MUST be followed):**`;
    
    fullPrompt += `\n- **Visual Style:** The visual style must be ${visualStyle}.`;
    fullPrompt += `\n- **Resolution:** The video resolution should be ${resolution}.`;

    if (enableSound && characterVoice !== 'none') {
        fullPrompt += `\n- **Audio:** The video must include audio with a character voice in ${characterVoice}.`;
    } else if (enableSound) {
        fullPrompt += `\n- **Audio:** The video must include ambient sounds.`;
    } else {
        fullPrompt += `\n- **Audio:** The video must be silent.`;
    }

    finalPrompt = fullPrompt;
  } else {
    finalPrompt = JSON.stringify(prompt);
  }
  
  // Base request payload
  const requestPayload: any = {
    model: model,
    prompt: finalPrompt,
    config: {
      numberOfVideos: 1,
      aspectRatio: aspectRatio,
    }
  };

  if (imageBase64 && imageMimeType) {
    requestPayload.image = {
      imageBytes: imageBase64,
      mimeType: imageMimeType
    };
  }

  console.log("Generating video with payload:", requestPayload);

  // Wrap the initial video generation call with retry logic
  let operation: Operation = await withRetry(() => ai.models.generateVideos(requestPayload));
  
  // Poll for the result
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between checks
    // Also wrap the polling call with retry logic
    operation = await withRetry(() => ai.operations.getVideosOperation({ operation: operation }));
    console.log("Polling video generation status...", operation);
  }

  if (operation.error) {
    console.error("Video generation failed with an error:", operation.error);
    throw new Error(operation.error.message || "Video generation failed due to an unknown error.");
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    console.error("Video generation finished but no download link was provided.", operation.response);
    const errorText = "Video generation failed or returned an empty result.";
    throw new Error(errorText);
  }
  
  // The URI needs the API key to be fetched.
  const keySeparator = downloadLink.includes('?') ? '&' : '?';
  const finalUrlWithKey = `${downloadLink}${keySeparator}key=${apiKey}`;
  
  // Fetch the video as a blob and return a local URL to avoid CORS and auth key exposure issues in the video tag.
  const response = await fetch(finalUrlWithKey);
  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Failed to download generated video:", response.status, errorBody);
    throw new Error(`Failed to download the generated video file. Server response: ${errorBody}`);
  }
  const videoBlob = await response.blob();
  return URL.createObjectURL(videoBlob);
};

const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

const createSilentWavBlob = (durationSeconds: number = 1): Blob => {
    const sampleRate = 24000; // Standard for speech
    const numChannels = 1;
    const numFrames = Math.round(durationSeconds * sampleRate);
    const buffer = new ArrayBuffer(44 + numFrames * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numFrames * 2, true);
    writeString(view, 8, 'WAVE');
    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Audio format 1=PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, numFrames * 2, true);

    return new Blob([view], { type: 'audio/wav' });
};

export const generateTextToSpeech = async (ai: GoogleGenAI, text: string): Promise<Blob> => {
    console.warn("TTS generation is a placeholder. Returning silent audio. Text:", text);
    // Estimate duration: 15 characters per second
    const estimatedDuration = Math.max(1, text.length / 15);
    const silentBlob = createSilentWavBlob(estimatedDuration);
    return Promise.resolve(silentBlob);
};

export const generateVideoForStory = async (
  ai: GoogleGenAI,
  model: VeoModel,
  payload: {
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config: any;
  },
  logCallback: (msg: string) => void
): Promise<Operation> => {
    const requestPayload: any = {
        model: model,
        prompt: payload.prompt,
        config: payload.config,
    };

    if (payload.image) {
        requestPayload.image = payload.image;
    }

    logCallback("Sending video generation request to the model...");
    let operation: Operation = await withRetry(() => ai.models.generateVideos(requestPayload));
    logCallback("Request received. Waiting for video processing to start...");

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        operation = await withRetry(() => ai.operations.getVideosOperation({ operation: operation }));
        logCallback("Polling video generation status...");
    }

    if (operation.error) {
        console.error("Video generation failed with an error:", operation.error);
        throw new Error(operation.error.message || "Video generation failed due to an unknown error.");
    }

    logCallback("Video processing complete.");
    return operation;
};
