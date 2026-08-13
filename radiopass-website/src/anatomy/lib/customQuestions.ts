import type { Question, SectionId } from '../types';
import { deleteImageBlob } from './customStore';

const STORAGE_KEY = 'frcr-anatomy-custom-questions-v1';

function readAll(): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Question[];
  } catch {
    return [];
  }
}

function writeAll(questions: Question[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch {
    // storage unavailable — custom case is still usable for this session
  }
}

export function getCustomQuestions(section: SectionId): Question[] {
  return readAll().filter((q) => q.section === section);
}

export function getAllCustomQuestions(): Question[] {
  return readAll();
}

export function saveCustomQuestion(question: Question) {
  const all = readAll();
  const idx = all.findIndex((q) => q.id === question.id);
  if (idx >= 0) all[idx] = question;
  else all.push(question);
  writeAll(all);
}

export async function deleteCustomQuestion(id: string) {
  const all = readAll();
  const target = all.find((q) => q.id === id);
  const remaining = all.filter((q) => q.id !== id);
  writeAll(remaining);
  if (target?.isCustom && target.imagePath.startsWith('idb://')) {
    await deleteImageBlob(target.imagePath.slice('idb://'.length));
  }
}

export function nextCustomQuestionNumber(section: SectionId, staticCount: number): number {
  return staticCount + getCustomQuestions(section).length + 1;
}
