/* The overlay, as the browser sees it. Mirrors server/lib/overlay.mjs — the
   server is the authority on the shape; this is the reading end of it. */

export interface OverlayImage {
  assetId?: string;
  version?: number;
  filename?: string;
  replacedAt?: string;
  /** Soft delete. Set = the film is shown nowhere, but nothing is destroyed. */
  removedAt?: string | null;
  previous?: { assetId?: string; sourcePath?: string } | null;
  /** Keep the crop and rotation that belonged to the film being replaced.
   *  Off by default: an uploaded image is already the film, with no printed
   *  question stem to cut away. */
  keepGeometry?: boolean;
}

export interface OverlayLabel {
  /** Shown to a candidate in the Question Bank. Default true. */
  visible?: boolean;
  /** This structure association feeds the Atlas. Default true.
   *  Deliberately separate from `visible`: hiding a label from the question
   *  is a presentation choice, and must not silently delete the anatomy. */
  inAtlas?: boolean;
}

export interface OverlayAtlas {
  /** Whole film in or out of the Atlas. Default true. */
  include?: boolean;
  description?: string;
  modality?: string;
  plane?: string;
  sequence?: string;
}

export interface OverlayRelationship {
  target: string;
  neighbour: string;
  text: string;
}

export interface QuestionOverlay {
  questionId: string;
  updatedAt?: string;
  /** The annotation editor's document, exactly as it already existed for the
   *  browser-only override. Reusing that shape means the whole existing
   *  editor — markers, arrow geometry, crop, orientation, answers — becomes
   *  persistent and shared without being re-modelled. */
  edit?: import('../questionEdits').QuestionEdit;
  image?: OverlayImage | null;
  labels?: Record<string, OverlayLabel>;
  answers?: Record<string, { officialAnswer?: string }>;
  atlas?: OverlayAtlas;
  relationships?: OverlayRelationship[];
}

export interface ContentOverlay {
  rev: number;
  updatedAt: string | null;
  questions: Record<string, QuestionOverlay>;
}

export interface ContentState {
  overlay: ContentOverlay;
  /** False when the deployment has no API, or has one with no editor
   *  password set. The site is fully usable either way; only editing stops. */
  editingConfigured: boolean;
  /** Whether the API answered at all. False on a plain static host. */
  online: boolean;
  error: string | null;
}

export interface AuditEntry {
  action: string;
  questionId: string;
  detail: string | null;
  at: string;
}

export const EMPTY_OVERLAY: ContentOverlay = { rev: 0, updatedAt: null, questions: {} };
