import React from 'react';
// Generic
export interface Option {
  value: string;
  label: string;
}

// App Structure
export type Tab = 'dashboard' | 'creativeHub' | 'videoPrompt' | 'ctGenerate' | 'fashionStudio' | 'productAnalysis' | 'ideCerita' | 'studioFoto' | 'risetYoutube';

// Image Generation & Editing
export interface ImageInput {
  data: string; // base64 encoded
  mimeType: string;
}

export type ImageAspectRatio = '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
export type ImageModel = 'gemini-2.5-flash-image' | 'imagen-4.0-generate-001';
export type ImageEditorSubTab = 'edit' | 'aspectRatio';

// FIX: Add missing types for the Fashion Studio component.
// For Fashion Studio
export type ModelType = 'model' | 'mannequin' | 'flatLay';
export type FashionAspectRatio = ImageAspectRatio;
export interface CreativeBrief {
    modelType: ModelType;
    prompt: string;
    aspectRatio: FashionAspectRatio;
}

// Video Generation
export type VeoModel = 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview' | 'veo-2.0-generate-001' | 'veo-3.0-fast-generate-preview' | 'veo-3.0-fast-generate-001' | 'veo-3.0-generate-001';
export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
export type Resolution = '720p' | '1080p';
export type CharacterVoice = 'none' | 'english' | 'bahasa-indonesia';
export type VisualStyle = 'Cinematic' | 'Realistic' | 'Anime' | 'Pixar3D' | 'Cyberpunk' | "Retro 80's";
export interface Scene {
  id: number;
  prompt: string;
  usePreviousScene: boolean;
}

// Ads Video Generator
export type AdStrategy = 'default' | 'problem-solution' | 'benefit-driven' | 'ugc-testimonial' | 'unboxing';
export interface AdCreativeAnalysis {
  productName: string;
  productDescription: string;
  targetAudience: string;
  videoStyle: string;
  sellingPoints: string[];
  cta: string;
}


// CT Story Hub
export interface StoryCharacter {
    id: string;
    name: string;
    description: string;
    clothing: string;
    expression: string;
    status: 'pending' | 'generating' | 'done' | 'error';
    imageUrl?: string;
    imageBase64?: string;
}

export interface Universe {
    characters: StoryCharacter[];
}

// Storybook
export interface StorybookPage {
    id: string;
    pageNumber: number;
    text: string;
    imagePrompt: string;
    status: 'pending-image' | 'generating-image' | 'done' | 'error';
    imageUrl?: string;
}

export interface StorybookProject {
    id: string;
    idea: string;
    pages: StorybookPage[];
    fullStoryText: string;
}

// LTX (Long-form Text to Video)
// FIX: The LtxCharacter type was incorrectly omitting `imageUrl` and `imageBase64`, causing type errors
// when trying to display character images in the UI. This has been corrected to only omit the 'status' property.
export type LtxCharacter = Omit<StoryCharacter, 'status'>;
export type LtxTransition = 'none' | 'crossfade';
export type LtxSceneStatus = 'pending' | 'generating-image' | 'image-done' | 'generating-video' | 'done' | 'error';

export interface LtxScene {
    id: string;
    sceneNumber: number;
    status: LtxSceneStatus;
    transition: LtxTransition;
    description: string;
    imagePrompt: string;
    videoPrompt: string;
    audioPrompt: string;
    imageUrl?: string;
    imageBase64?: string;
    imageFileName?: string;
    videoUrl?: string;
    videoFileName?: string;
    audioUrl?: string;
    audioFileName?: string;
}

export interface LtxProject {
    title: string;
    category: string;
    genre: string;
    visualStyle: string;
    aspectRatio: string;
    resolution: '720p' | '1080p';
    videoModel: string;
    duration: string;
    durationUnit: 'seconds' | 'minutes';
    characters: LtxCharacter[];
    scenes: LtxScene[];
}

export const ASSET_STYLES = ['Cinematic', 'Photorealistic', 'Anime', 'Documentary', 'Hand-drawn', '3D Animation', 'Vlog', 'Corporate'];

// Story Weaver
export type StorySceneStatus = 'pending' | 'generating-image' | 'image-done' | 'generating-video' | 'done' | 'error';
export interface StoryScene {
    id: string;
    prompt: string;
    status: StorySceneStatus;
    imageUrl?: string;
    imageBase64?: string;
    imageFileName?: string;
    videoUrl?: string;
    videoFileName?: string;
    audioUrl?: string;
    audioFileName?: string;
}

// For UniverseHub Concept Variations
export interface ImageStudioResultData {
    id: string;
    prompt: string;
    negativePrompt: string;
    imageUrl: string;
    imageBase64: string;
    seed: number;
}


// Shared Props for Forms in CT Story
import { GoogleGenAI } from '@google/genai';

export type LogType = 'info' | 'error' | 'warning' | 'status';
export type Status = 'Idle' | 'Running' | 'Done' | 'Error';
export type MediaItem = {
    type: 'image' | 'video' | 'audio';
    previewUrl: string; // data URL
    prompt: string;
    model: string;
    sourceComponent: string;
    base64?: string;
    mimeType?: string;
}

export interface SharedFormProps {
    addLog: (message: string, type: LogType) => void;
    getNextApiKey: () => string | null;
    logUsage: (type: 'text' | 'images' | 'videos' | 'audio') => void;
    universe: Universe;
    setUniverse: React.Dispatch<React.SetStateAction<Universe>>;
    executeApiCallWithKeyRotation: <T>(
        apiCall: (ai: GoogleGenAI) => Promise<T>,
        description: string
    ) => Promise<[T, { apiKey: string | null }]>;
    addToMediaLibrary: (item: MediaItem) => void;
    runningRef: React.MutableRefObject<boolean>;
    setStatus: (status: Status) => void;
    setModalVideoUrl?: (url: string) => void;
    setModalImageUrl?: (url: string) => void;
    getFileSaveDirectory: (type: 'images' | 'videos' | 'projects') => Promise<string | null>;
}