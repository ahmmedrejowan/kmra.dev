/** Translated text for one app. Every field is optional; missing ones stay in English. */
export interface AppContent {
  name?: string;
  short?: string;
  tagline?: string;
  /** Group label translations (tool and task groups), keyed by the English label */
  groups?: Record<string, string>;
  tools?: Record<
    string,
    {
      name?: string;
      title?: string;
      description?: string;
      blurb?: string;
      steps?: readonly string[];
    }
  >;
  tasks?: Record<
    string,
    {
      name?: string;
      short?: string;
      title?: string;
      intro?: string;
      about?: readonly string[];
    }
  >;
}
