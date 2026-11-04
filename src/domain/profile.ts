export type TempSensitivity = 'cold' | 'normal' | 'hot';

export interface StyleProfile {
  styleTags: string[];
  favoriteColorIds: string[];
  avoidColorIds: string[];
  tempSensitivity: TempSensitivity;
}

export interface Sizes {
  top?: string;
  bottom?: string;
  shoes?: string;
  dress?: string;
}

export const DEFAULT_STYLE_PROFILE: StyleProfile = {
  styleTags: [],
  favoriteColorIds: [],
  avoidColorIds: [],
  tempSensitivity: 'normal',
};
