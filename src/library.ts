// The Spec library, bundled at build time so the app works offline.

import libraryJson from '../data/spec-library.json';
import exampleJson from '../fixtures/ballroom.loadsheet.json';
import { ShowFileSchema, type ShowFile } from './schema/show-file';
import { indexByName, SpecLibrarySchema } from './schema/spec-library';

// CI validates the file, so a failure here means a broken build, not bad user input.
export const library = SpecLibrarySchema.parse(libraryJson);
export const libraryByName = indexByName(library);

/** The Ballroom sample show, for the "Load example" button. */
export function exampleShow(): ShowFile {
  return ShowFileSchema.parse(structuredClone(exampleJson));
}
