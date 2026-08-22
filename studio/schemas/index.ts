/* Every document type the Studio knows about.
 *
 * Deliberately absent: the Structure Atlas. It has no records to hold. The
 * Atlas is a DERIVED index — buildAtlas() reconstructs every chapter, every
 * structure and every cross-reference on each load from the anatomy question
 * bank. Giving it documents here would mean inventing rows that nothing reads
 * and then watching them drift out of step with the questions they were
 * generated from. It stays derived, and it updates itself when the cases below
 * are edited.
 */
import { physicsQuestion } from './physicsQuestion'
import { anatomyCase } from './anatomyCase'
import { lesson } from './lesson'
import { page, faq } from './siteCopy'

export const schemaTypes = [page, faq, lesson, physicsQuestion, anatomyCase]
