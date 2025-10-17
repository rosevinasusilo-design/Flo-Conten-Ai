import { GoogleGenAI, GenerateContentResponse, GenerateImagesResponse, Operation, Modality, Type } from "@google/genai";
// FIX: Import CreativeBrief for the new generateFashionPhotoshoot function.
import type { ImageInput, VeoModel, AspectRatio as VideoAspectRatio, Resolution, CharacterVoice, VisualStyle, ImageAspectRatio, CreativeBrief, AdCreativeAnalysis, AdStrategy } from '../types';

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

export const analyzeCharacterImages = async (
  apiKey: string,
  images: ImageInput[]
): Promise<string> => {
    const ai = getGenAIClient(apiKey);

    const imageParts = images.map(img => ({
        inlineData: { data: img.data, mimeType: img.mimeType },
    }));

    const prompt = `Analyze the provided image(s). Describe the subjects as concisely as possible, focusing on the number of people and their apparent gender. 
    Examples:
    - If there is one image of a woman: "a woman"
    - If there is one image of a man: "a man"
    - If there are two images, one of a man and one of a woman: "a man and a woman"
    - If there are three images of women: "three women"
    
    Respond with ONLY this short descriptive phrase. Do not add any other text.`;

    const textPart = { text: prompt };

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...imageParts, textPart] },
    }));

    return response.text.trim();
};

export const generatePhotographyPrompt = async (
  apiKey: string,
  baseIdea: string
): Promise<string> => {
    const ai = getGenAIClient(apiKey);
    const prompt = `You are a world-class photography creative director. Based on the following simple idea, generate a single, detailed, and professional photography prompt for an AI image generator. The prompt should be a single paragraph.

    The prompt must include rich details about:
    - Subject and model description (if not already specified)
    - Specific clothing and style
    - The setting/background
    - The quality and style of lighting (e.g., golden hour, soft studio light, dramatic shadows)
    - Camera angle and shot type (e.g., full body, medium shot, low angle)
    - The overall mood and atmosphere of the image.

    The final output should be photorealistic and suitable for a high-fashion magazine.

    Base Idea: "${baseIdea || 'a fashionable model'}"`;

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    }));
    
    return response.text.trim();
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

export const generateStudioPhotos = async (
  apiKey: string,
  {
    modelImages,
    prompt,
    count,
  }: {
    modelImages: ImageInput[];
    prompt: string;
    count: number;
  }
): Promise<ImageInput[]> => {
  const ai = getGenAIClient(apiKey);
  
  const modelImageParts = modelImages.map(img => ({
    inlineData: { data: img.data, mimeType: img.mimeType },
  }));
  const textPart = { text: prompt };
  const allParts = [...modelImageParts, textPart];

  const imagePromises = Array(count).fill(0).map(async () => {
    const response: GenerateContentResponse = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: allParts },
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
      let reason = "Model did not generate a studio photo.";
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
  2.  Three variations of a compelling voice-over script ${voiceOverInstruction}. The scripts must sound very human, conversational, and unique, as if written by a creative content creator, not a machine. Use engaging, and sometimes casual, Bahasa Indonesia. Each script variation MUST be a maximum of 500 characters and include a strong hook, key product features, and a clear call-to-action (CTA). For reference, here is an example of the desired style: "buat ngantor, bisa dong? hang out apalagi. ke kampus juga ok. lo mau buat apa? buruan cek out sekarang. klik keranjang kuning segera ya."
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

export const analyzeProductForAdCreative = async (
  apiKey: string,
  productLink: string
): Promise<AdCreativeAnalysis> => {
  const ai = getGenAIClient(apiKey);

  const prompt = `As an expert digital marketing strategist, analyze the product from the following URL: "${productLink}".
Based on the product, its platform, and its likely target audience, generate the following content:
1. A concise product name (in Bahasa Indonesia).
2. A short, engaging product description (in Bahasa Indonesia).
3. A suggested target audience (in Bahasa Indonesia).
4. A compelling video style from this list: 'Dynamic & Fast-Paced', 'Cinematic & Elegant', 'Minimalist & Clean', 'Funny & Viral-style', 'UGC (User-Generated Content) style'.
5. An array of 3 key selling points (in Bahasa Indonesia).
6. A strong call-to-action (CTA) (in Bahasa Indonesia).

Return the result as a single, minified JSON object.`;

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          productDescription: { type: Type.STRING },
          targetAudience: { type: Type.STRING },
          videoStyle: { type: Type.STRING },
          sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
        },
        required: ["productName", "productDescription", "targetAudience", "videoStyle", "sellingPoints", "cta"],
      },
    },
  }));

  const jsonStr = response.text.trim();
  const result = JSON.parse(jsonStr);
  return result;
};


export const generateMultiSceneAdScript = async (
  apiKey: string,
  analysis: {
    productName: string;
    targetAudience: string;
    videoStyle: string;
    sellingPoints: string[];
    cta: string;
  },
  aspectRatio: VideoAspectRatio,
  adStrategy: AdStrategy
): Promise<string[]> => {
  const ai = getGenAIClient(apiKey);

  let strategyInstruction = '';
  switch (adStrategy) {
    case 'problem-solution':
      strategyInstruction = `
- **Scene 1:** Visually represent a common problem or frustration that the target audience experiences. Do not show the product yet.
- **Scene 2:** Introduce the product as the hero and the perfect solution to the problem shown in scene 1.
- **Scene 3:** Show the product in action, demonstrating its effectiveness and ease of use in solving the problem.
- **Scene 4:** Show the final, positive outcome. The character is happy and relieved, showcasing the result. End with the call to action.`;
      break;
    case 'benefit-driven':
      strategyInstruction = `
- **Scene 1:** Focus entirely on the first key selling point. Create a dynamic visual that showcases this benefit in an engaging way.
- **Scene 2:** Focus entirely on the second key selling point.
- **Scene 3:** Focus entirely on the third key selling point.
- **Scene 4:** Summarize the feeling of having all these benefits and end with a strong call to action.`;
      break;
    case 'ugc-testimonial':
      strategyInstruction = `The prompts must create a User-Generated Content (UGC) or testimonial-style video. Use phrases that suggest a real person is filming.
- **Scene 1:** A selfie-style or point-of-view shot. A character looks slightly annoyed or is dealing with a problem.
- **Scene 2:** The character introduces the product excitedly, maybe holding it up to the camera. Use phrases like "A first-person view of unboxing..." or "A phone camera shot of...".
- **Scene 3:** Quick cuts showing the product being used in a realistic, non-professional setting.
- **Scene 4:** The character is back in a selfie-style shot, looking happy and recommending the product to the viewer. Incorporate the call to action naturally.`;
      break;
    case 'unboxing':
      strategyInstruction = `The video should simulate a satisfying unboxing experience.
- **Scene 1:** A top-down or close-up shot of hands opening the product's packaging. Build anticipation.
- **Scene 2:** The product is revealed for the first time. Make it look premium and exciting. A slow pan or a dramatic reveal.
- **Scene 3:** A shot showing the key features of the product up close, right out of the box.
- **Scene 4:** The product is held or displayed proudly, ready to be used. End with the call to action.`;
      break;
    default: // 'default' case
      strategyInstruction = `The prompts must visually showcase the product in an exciting new context, highlighting its key features and appealing to the target audience. The final scene should incorporate the call to action.`;
      break;
  }

  const prompt = `You are an expert video advertising director. Based on the product info and creative direction, create a script for a short video ad with exactly 4 continuous scenes.
For each scene, provide a single, powerful, and descriptive prompt for a VEO model to generate a video clip.
The prompts should describe visuals, camera movements, and atmosphere. The product from the reference image MUST be accurately represented and be the central focus.

**Ad Strategy and Scene Structure:**
${strategyInstruction}

- Product Name: ${analysis.productName}
- Target Audience: ${analysis.targetAudience}
- Video Style: ${analysis.videoStyle}
- Key Selling Points to Highlight: ${analysis.sellingPoints.join(', ')}
- Call to Action: ${analysis.cta}
- Final output aspect ratio must be ${aspectRatio}.

Return the result as a single, minified JSON object with one key: "scenes". The value of "scenes" must be an array of exactly 4 strings, where each string is a VEO prompt.`;

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          }
        },
        required: ["scenes"],
      },
    },
  }));

  const jsonStr = response.text.trim();
  const result = JSON.parse(jsonStr);
  
  if (!result.scenes || result.scenes.length !== 4) {
    throw new Error("AI did not return a valid 4-scene script.");
  }
  return result.scenes;
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
  // The original implementation mixed API parameters into the text prompt.
  // This has been corrected to only include the narrative/animation instructions.
  if (typeof prompt === 'string') {
    let fullPrompt: string;
    
    if (imageBase64) {
        fullPrompt = `Animate the provided source image according to the detailed instructions below.`;
    } else {
        fullPrompt = `Create a video based on the following detailed instructions.`;
    }
    
    fullPrompt += `\n\n**Animation Instructions:** "${prompt}"`;
    fullPrompt += `\n\n**Visual Style:** The visual style must be ${visualStyle}.`;

    if (enableSound && characterVoice !== 'none') {
        fullPrompt += `\n**Audio:** The video must include audio with a character voice in ${characterVoice}.`;
    } else if (enableSound) {
        fullPrompt += `\n**Audio:** The video must include ambient sounds.`;
    } else {
        fullPrompt += `\n**Audio:** The video must be silent.`;
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
  
  // The resolution parameter is only supported on VEO 3.1 models.
  if (model.startsWith('veo-3.1')) {
    requestPayload.config.resolution = resolution;
  }

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